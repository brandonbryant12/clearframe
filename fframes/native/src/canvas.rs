//! Author-drawn vector scenes. A `canvas` beat (or any beat's `art` layer) is a list of
//! shapes, paths, text, icons, images and groups, each with an entrance, optional keyframed
//! moves, an ambient loop and an exit. It is how a film shows a metaphor, map, mechanism or
//! illustration the fixed blocks cannot. Every value is a pure function of scene seconds and
//! prepared props, so seeking backwards reproduces the same frame.
use super::*;
use kurbo::{BezPath, ParamCurveArclen, PathEl, Shape};
use std::collections::HashMap;
use std::f32::consts::{PI, TAU};
use std::sync::Mutex;

#[path = "canvas_effects.rs"]
mod effects;
#[path = "canvas_geometry.rs"]
mod geometry;
#[path = "canvas_mosaic.rs"]
mod mosaic;
#[path = "canvas_print.rs"]
pub(crate) mod print;
use geometry::*;

pub(crate) const MAX_ELEMENTS: usize = 600;
const TYPES: &[&str] = &[
    "rect",
    "circle",
    "ellipse",
    "line",
    "path",
    "poly",
    "text",
    "icon",
    "image",
    "group",
    "meter",
    "spotlight",
    "particles",
    "solid",
];
const ENTERS: &[&str] = &[
    "fade", "pop", "rise", "drop", "left", "right", "grow", "grow-x", "grow-y", "draw", "wipe", "wipe-up", "type",
    "scramble", "blur", "none", "assemble",
];
const EXITS: &[&str] = &["fade", "shrink", "fall", "lift", "undraw", "wipe", "blur", "none", "scatter"];
const LOOPS: &[&str] = &["spin", "pulse", "float", "sway", "orbit", "dash", "blink", "level", "rock"];
const TOKENS: &[&str] =
    &["bg", "surface", "ink", "muted", "accent", "accent2", "positive", "negative", "line", "wash", "wash2", "none"];

fn finite(v: &Value) -> bool {
    match v {
        Value::Number(n) => n.as_f64().is_some_and(f64::is_finite),
        Value::Array(a) => a.iter().all(finite),
        Value::Object(o) => o.values().all(finite),
        _ => true,
    }
}

// Quantitative paths can follow a shared time coordinate without easing each data interval.
fn stroke_reveal(local: f32, duration: f32, ease: &str) -> f32 {
    if duration <= 0.0 {
        return 1.0;
    }
    if ease == "linear" { motion::clamp01(local / duration) } else { motion::out_cubic(local / duration) }
}
fn paint_ok(v: Option<&Value>) -> bool {
    match v {
        None => true,
        Some(Value::String(s)) => TOKENS.contains(&s.as_str()) || crate::design::parse(s).is_some(),
        Some(Value::Object(g)) => {
            let stops = g.get("gradient").and_then(Value::as_array);
            stops.is_some_and(|s| {
                (2..=4).contains(&s.len())
                    && s.iter().all(|c| {
                        c.as_str().is_some_and(|c| c != "none" && paint_ok(Some(&Value::String(c.to_owned()))))
                    })
            })
        }
        _ => false,
    }
}

/// Structural checks so a hand-written job cannot reach an undrawable state. The catalog
/// gives the friendlier, author-facing messages first.
pub(crate) fn validate_elements(elements: &[Value], depth: usize, count: &mut usize) -> Result<(), &'static str> {
    if depth > 4 {
        return Err("canvas groups nest at most four levels");
    }
    for el in elements {
        *count += 1;
        if *count > MAX_ELEMENTS {
            return Err("canvas supports at most 600 elements");
        }
        if !el.is_object() || !finite(el) {
            return Err("canvas elements must be objects with finite numbers");
        }
        let kind = s(el, "type");
        if !TYPES.contains(&kind) {
            return Err("unknown canvas element type");
        }
        let enter = s(el, "enter");
        if !enter.is_empty() && !ENTERS.contains(&enter) {
            return Err("unknown canvas entrance");
        }
        if el.get("drawEase").is_some()
            && (enter != "draw" || !["out", "linear"].contains(&s(el, "drawEase")))
        {
            return Err("drawEase needs enter draw and must be out or linear");
        }
        let exit = s(el, "exit");
        if !exit.is_empty() && !EXITS.contains(&exit) {
            return Err("unknown canvas exit");
        }
        if let Some(l) = el.get("loop") {
            if !LOOPS.contains(&s(l, "type")) || f(l, "period", 4.0) <= 0.05 {
                return Err("canvas loops need a known type and a positive period");
            }
        }
        if !paint_ok(el.get("fill")) || !paint_ok(el.get("stroke")) {
            return Err("canvas colors must be palette tokens, #rrggbb or a gradient of tokens");
        }
        for key in ["at", "dur", "exitAt", "exitDur"] {
            if num(el, key).is_some_and(|v| v < 0.0) {
                return Err("canvas times must be nonnegative");
            }
        }
        if f(el, "opacity", 1.0) < 0.0 || f(el, "opacity", 1.0) > 1.0 {
            return Err("canvas opacity must be 0–1");
        }
        if el.get("tilt").is_some_and(|t| t.as_array().is_none_or(|a| a.len() != 2)) {
            return Err("canvas tilt is [x, y] degrees");
        }
        if el.get("material").is_some_and(|m| !effects::material_ok(m)) {
            return Err("canvas material is a preset name or {map, depth, soften, flow, grain, angle}");
        }
        if el.get("print").is_some_and(|p| p != &Value::Bool(false) && !print::ok(p)) {
            return Err(
                "canvas print is benday|halftone|engraving|newsprint|letterpress or {screen, cell, angle, tone, axis, register, wear, ink}",
            );
        }
        if el.get("along").is_some_and(|route| path_info(s(route, "d")).is_none()) {
            return Err("canvas along needs parseable path data");
        }
        if let Some(m) = el.get("morph") {
            validate_elements(std::slice::from_ref(&m["from"]), depth + 1, count)?;
        }
        if let Some(echo) = el.get("echo") {
            if !echo.is_object()
                || !(1.0..=24.0).contains(&n(echo, "count", 6.0))
                || n(echo, "lag", 0.0) < 0.0
                || echo.get("to").is_some_and(|t| !paint_ok(Some(t)))
            {
                return Err("canvas echo needs count 1–24, a nonnegative lag and a palette colour");
            }
        }
        match kind {
            "path" => {
                if path_info(s(el, "d")).is_none() {
                    return Err("canvas path data could not be parsed");
                }
            }
            "poly" => {
                if points(el).len() < 2 || points(el).len() > 400 {
                    return Err("canvas poly needs 2–400 points");
                }
            }
            "icon" => {
                if !crate::icons::supported(s(el, "name")) {
                    return Err("unsupported native icon");
                }
            }
            "meter" => {
                if !["", "bars", "mirror", "ring", "wave"].contains(&s(el, "style"))
                    || f(el, "w", 0.0) <= 0.0
                    || f(el, "h", 0.0) <= 0.0
                {
                    return Err("canvas meter needs w, h and style bars|mirror|ring|wave");
                }
            }
            "solid" => {
                if !["", "tetra", "cube", "octa", "icosa", "dodeca", "globe"].contains(&s(el, "shape"))
                    || f(el, "size", 120.0) <= 0.0
                {
                    return Err("canvas solid needs size and shape tetra|cube|octa|icosa|dodeca|globe");
                }
            }
            "particles" => {
                if !["", "dust", "embers", "rain", "snow", "bubbles", "stars", "warp"].contains(&s(el, "kind"))
                    || f(el, "w", 0.0) <= 0.0
                    || f(el, "h", 0.0) <= 0.0
                    || !(1.0..=400.0).contains(&n(el, "count", 40.0))
                {
                    return Err(
                        "canvas particles need w, h, count 1–400 and kind dust|embers|rain|snow|bubbles|stars|warp",
                    );
                }
            }
            "text" => {
                if s(el, "text").chars().count() > 240 && el.get("count").is_none() {
                    return Err("canvas text is limited to 240 characters");
                }
            }
            "image" => {
                if s(el, "file").is_empty() {
                    return Err("canvas images need a prepared file");
                }
            }
            "group" => validate_elements(arr(el, "children"), depth + 1, count)?,
            _ => {}
        }
    }
    Ok(())
}

pub(crate) fn validate(props: &Value) -> Result<(), &'static str> {
    let finite = |v: &Value| v.as_f64().is_some_and(f64::is_finite);
    for key in ["view", "viewFrom"] {
        let view = arr(props, key);
        let ok = match view.len() {
            0 => true,
            2 => key == "view" && view.iter().all(|v| v.as_f64().is_some_and(|v| v.is_finite() && v >= 16.0)),
            4 => {
                view.iter().all(finite)
                    && view[2].as_f64().unwrap_or(0.0) >= 16.0
                    && view[3].as_f64().unwrap_or(0.0) >= 16.0
            }
            _ => false,
        };
        if !ok {
            return Err("canvas view must be [width, height] or a camera rect [x, y, width, height]");
        }
    }
    let mut count = 0;
    validate_elements(arr(props, "elements"), 0, &mut count)?;
    if count == 0 {
        return Err("canvas needs at least one element");
    }
    Ok(())
}

#[derive(Clone, Copy, Default)]
struct Pose {
    dx: f32,
    dy: f32,
    sx: f32,
    sy: f32,
    rotate: f32,
    alpha: f32,
    /// Turn of the element's plane in space (degrees about its x and y axes), drawn as an
    /// orthographic projection: a card, a window or a page tilting toward the light.
    tx: f32,
    ty: f32,
}
impl Pose {
    fn identity() -> Self {
        Pose { sx: 1.0, sy: 1.0, alpha: 1.0, ..Default::default() }
    }
}

/// The keyframed pose at `now`: (x, y, scale, rotate, opacity, scaleX, scaleY). Each key
/// starts at its time and eases from the previous state; a zero-length key is a cut.
fn keyed(el: &Value, now: f32) -> (f32, f32, f32, f32, f32, f32, f32) {
    let mut key_pose = (0.0f32, 0.0f32, 1.0f32, 0.0f32, 1.0f32, 1.0f32, 1.0f32);
    for key in arr(el, "keys") {
        let start = f(key, "at", 0.0);
        if now < start {
            break;
        }
        let dur = f(key, "dur", crate::constants::get().canvas.key);
        let k = if dur <= 1e-3 { 1.0 } else { ease(s(key, "ease"), (now - start) / dur) };
        let prev = key_pose;
        key_pose = (
            num(key, "x").map_or(prev.0, |v| prev.0 + (v - prev.0) * k),
            num(key, "y").map_or(prev.1, |v| prev.1 + (v - prev.1) * k),
            num(key, "scale").map_or(prev.2, |v| prev.2 + (v - prev.2) * k),
            num(key, "rotate").map_or(prev.3, |v| prev.3 + (v - prev.3) * k),
            num(key, "opacity").map_or(prev.4, |v| prev.4 + (v - prev.4) * k),
            num(key, "scaleX").map_or(prev.5, |v| prev.5 + (v - prev.5) * k),
            num(key, "scaleY").map_or(prev.6, |v| prev.6 + (v - prev.6) * k),
        );
    }
    key_pose
}

/// The plane's tilt at `now`: the static `tilt: [x, y]` (degrees), then each key's `tiltX` /
/// `tiltY` eased from the state before it.
fn keyed_tilt(el: &Value, now: f32) -> (f32, f32) {
    let base = arr(el, "tilt");
    let mut t = (
        base.first().and_then(Value::as_f64).unwrap_or(0.0) as f32,
        base.get(1).and_then(Value::as_f64).unwrap_or(0.0) as f32,
    );
    for key in arr(el, "keys") {
        let start = f(key, "at", 0.0);
        if now < start {
            break;
        }
        let dur = f(key, "dur", crate::constants::get().canvas.key);
        let k = if dur <= 1e-3 { 1.0 } else { ease(s(key, "ease"), (now - start) / dur) };
        t = (
            num(key, "tiltX").map_or(t.0, |v| t.0 + (v - t.0) * k),
            num(key, "tiltY").map_or(t.1, |v| t.1 + (v - t.1) * k),
        );
    }
    t
}

/// The affine image of a plane turned `tx` degrees about its horizontal axis and `ty` about its
/// vertical one, seen orthographically: x' = x·cos ty, y' = y·cos tx + x·sin tx·sin ty.
pub(crate) fn tilt_matrix(tx: f32, ty: f32) -> [f32; 4] {
    let (a, b) = (tx.to_radians(), ty.to_radians());
    [b.cos(), a.sin() * b.sin(), 0.0, a.cos()]
}

/// A depth driven by keys `{at, z, dur, ease}` from `start`: each key eases from the value
/// before it (keys arrive sorted by time).
fn keyed_z(keys: &[Value], start: f32, t: f32) -> f32 {
    let mut v = start;
    for k in keys {
        let at = f(k, "at", 0.0);
        if t < at {
            break;
        }
        let span = f(k, "dur", 1.2);
        let q = if span <= 1e-3 { 1.0 } else { ease(s(k, "ease"), (t - at) / span) };
        v += (f(k, "z", v) - v) * q;
    }
    v
}

fn ease(name: &str, x: f32) -> f32 {
    match name {
        "linear" => motion::clamp01(x),
        "in" => motion::in_cubic(x),
        "out" => motion::out_quart(x),
        "spring" => motion::spring(x),
        _ => motion::in_out_cubic(x),
    }
}

impl<'a, 'c, 'm> Draw<'a, 'c, 'm> {
    /// A palette token, hex color or gradient object as an SVG paint.
    fn paint(&self, value: Option<&Value>, fallback: &str, defs: &mut Vec<Svgr<'a>>) -> String {
        let p = &self.p;
        let token = |name: &str| -> String {
            match name {
                "bg" => p.bg.clone(),
                "surface" => p.surface.clone(),
                "ink" => p.ink.clone(),
                "muted" => p.muted.clone(),
                "accent" => p.accent.clone(),
                "accent2" => p.accent2.clone(),
                "positive" => p.positive.clone(),
                "negative" => p.negative.clone(),
                "line" => p.line(),
                "wash" => p.wash(&p.accent),
                "wash2" => p.wash(&p.accent2),
                "none" => "none".into(),
                hex if crate::design::parse(hex).is_some() => hex.to_owned(),
                _ => fallback.to_owned(),
            }
        };
        match value {
            Some(Value::String(name)) => token(name),
            Some(Value::Object(g)) => {
                let stops: Vec<String> = g
                    .get("gradient")
                    .and_then(Value::as_array)
                    .map(|s| s.iter().filter_map(Value::as_str).map(token).collect())
                    .unwrap_or_default();
                if stops.len() < 2 {
                    return token(fallback);
                }
                let id = self.uid("grad");
                let last = (stops.len() - 1) as f32;
                // `fade` dissolves the final stop to transparent: soft glows without an edge.
                let fade = g.get("fade").and_then(Value::as_bool).unwrap_or(false);
                let nodes: Vec<_> = stops
                    .iter()
                    .enumerate()
                    .map(|(i, c)| {
                        let opacity = if fade && i + 1 == stops.len() { 0.0 } else { 1.0 };
                        fframes::svgr!(<stop offset={i as f32 / last} stop-color={c.clone()} stop-opacity={opacity} />)
                    })
                    .collect();
                if g.get("radial").and_then(Value::as_bool).unwrap_or(false) {
                    defs.push(fframes::svgr!(<radialGradient id={id.clone()} cx="0.5" cy="0.5" r="0.5">{nodes}</radialGradient>));
                } else {
                    let angle = g.get("angle").and_then(Value::as_f64).unwrap_or(90.0) as f32 * PI / 180.0;
                    let (dx, dy) = (angle.cos() * 0.5, angle.sin() * 0.5);
                    defs.push(fframes::svgr!(<linearGradient id={id.clone()} x1={0.5 - dx} y1={0.5 - dy} x2={0.5 + dx} y2={0.5 + dy}>{nodes}</linearGradient>));
                }
                format!("url(#{id})")
            }
            _ => token(fallback),
        }
    }

    /// Draw a canvas element list. `inherited` is the entrance time children fall back to.
    pub(crate) fn elements(
        &self,
        list: &[Value],
        inherited: f32,
        stagger: f32,
        defs: &mut Vec<Svgr<'a>>,
    ) -> Vec<Svgr<'a>> {
        self.elements_at(list, inherited, stagger, defs, self.t)
    }
    /// Elements as they are at scene time `now` (echo trails draw earlier moments).
    fn elements_at(
        &self,
        list: &[Value],
        inherited: f32,
        stagger: f32,
        defs: &mut Vec<Svgr<'a>>,
        now: f32,
    ) -> Vec<Svgr<'a>> {
        list.iter()
            .enumerate()
            .map(|(i, el)| {
                let at = inherited + i as f32 * stagger;
                match el.get("echo") {
                    Some(echo) => self.echoed(el, echo, at, defs, now),
                    None => self.element(el, at, defs, now),
                }
            })
            .collect()
    }

    /// Copies behind an element: earlier moments of its motion (`lag`, a trail) and/or
    /// stepped offsets (`step`, a fanned stack or spiral), fading and shifting toward `to`.
    fn echoed(&self, el: &Value, echo: &Value, at: f32, defs: &mut Vec<Svgr<'a>>, now: f32) -> Svgr<'a> {
        let count = (n(echo, "count", 6.0) as usize).clamp(1, 24);
        let lag = f(echo, "lag", 0.0).max(0.0);
        let fade = f(echo, "fade", 0.72).clamp(0.0, 1.0);
        let step = echo.get("step");
        let (sx, sy, sr, ss) = step.map_or((0.0, 0.0, 0.0, 0.0), |st| {
            (f(st, "x", 0.0), f(st, "y", 0.0), f(st, "rotate", 0.0), f(st, "scale", 0.0))
        });
        let target = echo
            .get("to")
            .and_then(Value::as_str)
            .map(|t| self.paint(Some(&Value::String(t.to_owned())), "accent", defs));
        let (bx, by, bw, bh) = bounds(el);
        let (ox, oy) = el
            .get("origin")
            .and_then(Value::as_array)
            .filter(|o| o.len() == 2)
            .map(|o| (o[0].as_f64().unwrap_or(0.0) as f32, o[1].as_f64().unwrap_or(0.0) as f32))
            .unwrap_or((bx + bw / 2.0, by + bh / 2.0));
        let mut base = el.clone();
        if let Some(o) = base.as_object_mut() {
            o.remove("echo");
        }
        let mut copies = vec![];
        for i in (1..=count).rev() {
            let mut copy = base.clone();
            let k = i as f32 / count as f32;
            if let (Some(to), Some(o)) = (&target, copy.as_object_mut()) {
                for key in ["fill", "stroke"] {
                    if let Some(Value::String(color)) = o.get(key) {
                        let from = self.paint(Some(&Value::String(color.clone())), "accent", defs);
                        if from != "none" {
                            o.insert(key.into(), Value::String(crate::design::mix(&from, to, k)));
                        }
                    }
                }
            }
            if let Some(o) = copy.as_object_mut() {
                o.insert("opacity".into(), serde_json::json!(f(el, "opacity", 1.0) * fade.powi(i as i32)));
            }
            let node = self.element(&copy, at, defs, now - lag * i as f32);
            let fi = i as f32;
            let offset = sx.abs() + sy.abs() + sr.abs() + ss.abs() > 1e-6;
            copies.push(if offset {
                fframes::svgr!(<g transform={format!("translate({} {}) translate({ox} {oy}) rotate({}) scale({}) translate({} {})", sx * fi, sy * fi, sr * fi, (1.0 + ss * fi).max(0.01), -ox, -oy)}>{node}</g>)
            } else { node });
        }
        copies.push(self.element(&base, at, defs, now));
        fframes::svgr!(<g>{copies}</g>)
    }

    fn element(&self, el: &Value, default_at: f32, defs: &mut Vec<Svgr<'a>>, now: f32) -> Svgr<'a> {
        // A material paints the shape itself, so the shape is drawn white and the filter reads
        // only its form (and the flowing stripes laid over it).
        let whitened;
        let el = if el.get("material").is_some() && s(el, "type") != "group" {
            whitened = effects::whitened(el);
            &whitened
        } else {
            el
        };
        // Stepped time ("on twos"): the element updates `fps` times a second, a handmade feel.
        let now = match num(el, "fps") {
            Some(q) if q > 0.0 => (now * q).floor() / q,
            _ => now,
        };
        // Morph from the previous beat's element with the same id, across the cut.
        if let Some(m) = el.get("morph") {
            let dur = f(m, "dur", 0.8).max(0.01);
            if now < dur {
                let mixed = self.morphed(&m["from"], el, motion::in_out_cubic(now / dur), defs);
                return self.element(&mixed, 0.0, defs, now);
            }
        }
        // Depth: `z` is the element's distance (0 is the picture plane), authored as seen
        // before the camera moves. As the camera flies forward (`dolly`), near layers grow
        // faster than far ones around the camera centre; an element it has passed is gone.
        let (cam_z, focus) = self.depth.get();
        let persp = match num(el, "z") {
            Some(z) => {
                let dz = 1.0 + z - cam_z;
                if dz < 0.12 {
                    return fframes::svgr!(<g />);
                }
                // (scale against the authored view, distance to the lens, fade near the lens)
                Some(((1.0 + z) / dz, dz, motion::clamp01((dz - 0.12) / 0.3)))
            }
            None => None,
        };
        let kind = s(el, "type");
        let at = f(el, "at", default_at);
        let enter = match s(el, "enter") {
            "" => match kind {
                "line" | "path" | "poly" if el.get("fill").is_none_or(|f| f == "none") => "draw",
                "solid" => "draw",
                "text" => "rise",
                "icon" | "circle" => "pop",
                _ => "fade",
            },
            other => other,
        };
        let text_len = s(el, "text").chars().count() as f32;
        // Defaults mirror `canvasTimes` in fframes/production.mjs, which writes explicit
        // times into prepared jobs so scene settling can be scheduled exactly.
        let c = &crate::constants::get().canvas;
        let default_dur = match enter {
            "draw" => c.draw,
            "assemble" => c.draw * 1.3,
            "type" => (text_len * c.type_per_char).clamp(c.type_min, c.type_max),
            "grow" | "grow-x" | "grow-y" | "wipe" | "wipe-up" => c.grow,
            "scramble" => c.scramble,
            "none" => 0.0,
            _ => self.m.duration(),
        };
        let dur = f(el, "dur", default_dur).max(0.0);
        let local = now - at;
        if local < 0.0 {
            return fframes::svgr!(<g />);
        }
        let exit = s(el, "exit");
        let exit_at = num(el, "exitAt");
        let exit_dur = f(el, "exitDur", self.m.duration());
        let q = match exit_at {
            Some(e) if !exit.is_empty() && exit != "none" => {
                if exit_dur <= 0.0 {
                    if now >= e { 1.0 } else { 0.0 }
                } else {
                    motion::in_cubic((now - e) / exit_dur)
                }
            }
            Some(e) if exit == "none" && now >= e => 1.0,
            _ => 0.0,
        };
        if q >= 1.0 {
            return fframes::svgr!(<g />);
        }

        // Entrance progress: opacity never overshoots; travel may spring.
        let e = if dur <= 0.0 { Enter::DONE } else { self.m.enter_over(local, dur) };
        let grow = if dur <= 0.0 { 1.0 } else { self.m.grow(local, dur) };
        let (bx, by, bw, bh) = bounds(el);
        let origin = el
            .get("origin")
            .and_then(Value::as_array)
            .filter(|o| o.len() == 2)
            .map(|o| (o[0].as_f64().unwrap_or(0.0) as f32, o[1].as_f64().unwrap_or(0.0) as f32))
            .unwrap_or(match enter {
                "grow-x" => (bx, by + bh / 2.0),
                "grow-y" => (bx + bw / 2.0, by + bh),
                _ => (bx + bw / 2.0, by + bh / 2.0),
            });
        let mut pose = Pose::identity();
        pose.rotate = f(el, "rotate", 0.0);
        pose.alpha = f(el, "opacity", 1.0);
        (pose.tx, pose.ty) = keyed_tilt(el, now);
        let distance = self.m.distance(f(el, "dist", 48.0));
        match enter {
            "fade" | "blur" => pose.alpha *= e.alpha,
            "pop" => {
                let k = 0.55 + 0.45 * self.m.pop(local * self.m.duration() / dur.max(0.01));
                pose.sx *= k;
                pose.sy *= k;
                pose.alpha *= e.alpha;
            }
            "rise" => {
                pose.dy += distance * (1.0 - e.travel);
                pose.alpha *= e.alpha;
            }
            "drop" => {
                pose.dy -= distance * (1.0 - e.travel);
                pose.alpha *= e.alpha;
            }
            "left" => {
                pose.dx -= distance * (1.0 - e.travel);
                pose.alpha *= e.alpha;
            }
            "right" => {
                pose.dx += distance * (1.0 - e.travel);
                pose.alpha *= e.alpha;
            }
            "grow" => {
                pose.sx *= grow;
                pose.sy *= grow;
            }
            "grow-x" => pose.sx *= grow,
            "grow-y" => pose.sy *= grow,
            _ => {}
        }
        // Keyframed moves: each key starts at its time and eases from the previous state.
        // (x, y, scale, rotate, opacity, scaleX, scaleY)
        let key_pose = keyed(el, now);
        // Motion blur on a fast keyed move: how far the element travelled while the shutter
        // (lens `blur`) was open, as a blur along each axis.
        let shutter = crate::lens::Lens::from(&self.b.lens).blur;
        let smear = if shutter > 0.0 && !arr(el, "keys").is_empty() {
            let before = keyed(el, now - shutter / self.f.fps as f32);
            (((key_pose.0 - before.0).abs() * 0.5).min(36.0), ((key_pose.1 - before.1).abs() * 0.5).min(36.0))
        } else {
            (0.0, 0.0)
        };
        pose.dx += key_pose.0;
        pose.dy += key_pose.1;
        pose.sx *= key_pose.2 * key_pose.5;
        pose.sy *= key_pose.2 * key_pose.6;
        pose.rotate += key_pose.3;
        pose.alpha *= key_pose.4.clamp(0.0, 1.0);
        // Parallax: a layer at `depth` < 1 sits farther away, so it follows the camera by
        // (1 - depth) of its travel from `depthRef` (the view centre where it was drawn).
        let depth = num(el, "depth").or_else(|| num(el, "z").map(|z| 1.0 / (1.0 + z.max(-0.85))));
        if let (Some(depth), Some((cx, cy))) = (depth, self.camera.get()) {
            let r = arr(el, "depthRef");
            if r.len() == 2 {
                // A foreground layer (z < 0) has depth above 1: it outruns the camera.
                let k = 1.0 - depth.clamp(0.0, 4.0);
                pose.dx += k * (cx - r[0].as_f64().unwrap_or(0.0) as f32);
                pose.dy += k * (cy - r[1].as_f64().unwrap_or(0.0) as f32);
            }
        }
        // Travel along a path: the element's origin rides the outline, optionally turning.
        if let Some(route) = el.get("along") {
            if let Some(info) = path_info(s(route, "d")) {
                if let Some(contour) = info.points.iter().find(|c| c.len() > 1) {
                    let start = f(route, "at", at);
                    let span = f(route, "dur", crate::constants::get().canvas.along).max(0.001);
                    // A looping route repeats every `dur` seconds (eased per lap) after it starts.
                    let lap = if route.get("loop").and_then(Value::as_bool).unwrap_or(false) && now > start {
                        ((now - start) / span).fract()
                    } else {
                        (now - start) / span
                    };
                    let k = ease(nonempty(s(route, "ease"), "inOut"), lap);
                    if let Some(((px, py), angle)) = along(contour, k) {
                        pose.dx += px - origin.0;
                        pose.dy += py - origin.1;
                        if route.get("rotate").and_then(Value::as_bool).unwrap_or(false) {
                            pose.rotate += angle.to_degrees();
                        }
                    }
                }
            }
        }
        // Ambient loop after the entrance, eased in so it never jumps.
        let mut dash_shift = 0.0;
        if let Some(l) = el.get("loop") {
            let start = at + dur;
            let lt = (now - start).max(0.0);
            let period = f(l, "period", 4.0).max(0.05);
            let ramp = motion::in_out_cubic(lt / 0.8);
            let phase = TAU * lt / period;
            match s(l, "type") {
                "spin" => pose.rotate += 360.0 * f(l, "amount", 1.0) * lt / period,
                // A bare stroke (a street, a route) throbs in brightness: scaling it would make
                // it crawl and change length.
                "pulse" if matches!(kind, "line" | "path" | "poly") && el.get("fill").is_none_or(|v| v == "none") => {
                    let depth = (f(l, "amount", 0.06) * 3.0).min(0.7);
                    pose.alpha *= 1.0 - depth * ramp * (0.5 + 0.5 * phase.sin());
                }
                "pulse" => {
                    let k = 1.0 + f(l, "amount", 0.06) * ramp * phase.sin();
                    pose.sx *= k;
                    pose.sy *= k;
                }
                "float" => pose.dy += f(l, "amount", 10.0) * ramp * phase.sin(),
                "sway" => pose.rotate += f(l, "amount", 4.0) * ramp * phase.sin(),
                // The plane rocks in space: a floating window or card turning gently.
                "rock" => {
                    let a = f(l, "amount", 8.0) * ramp;
                    pose.ty += a * phase.sin();
                    pose.tx += 0.35 * a * phase.cos();
                }
                "orbit" => {
                    let a = f(l, "amount", 12.0) * ramp;
                    pose.dx += a * phase.cos() - a;
                    pose.dy += a * phase.sin();
                }
                "dash" => dash_shift = -lt / period,
                "blink" => pose.alpha *= 1.0 - f(l, "amount", 0.5).clamp(0.0, 1.0) * ramp * (0.5 - 0.5 * phase.cos()),
                // Pulse with the narration's measured loudness.
                "level" => {
                    let k = 1.0 + f(l, "amount", 0.12) * self.level(now);
                    pose.sx *= k;
                    pose.sy *= k;
                }
                _ => {}
            }
        }
        // Exit.
        if q > 0.0 {
            match exit {
                "fade" | "blur" | "undraw" | "wipe" => pose.alpha *= 1.0 - q,
                "shrink" => {
                    let k = 1.0 - 0.45 * q;
                    pose.sx *= k;
                    pose.sy *= k;
                    pose.alpha *= 1.0 - q;
                }
                "fall" => {
                    pose.dy += distance * q;
                    pose.alpha *= 1.0 - q;
                }
                "lift" => {
                    pose.dy -= distance * q;
                    pose.alpha *= 1.0 - q;
                }
                _ => {}
            }
        }
        if pose.alpha <= 0.001 {
            return fframes::svgr!(<g />);
        }

        let draw = if enter == "draw" { stroke_reveal(local, dur, s(el, "drawEase")) } else { 1.0 };
        let draw = if exit == "undraw" { draw * (1.0 - q) } else { draw };
        let mosaic = el.get("mosaic").filter(|m| m.as_bool() == Some(true) || m.is_object());
        let shape = match mosaic {
            Some(spec) if matches!(kind, "rect" | "circle" | "ellipse" | "path" | "poly" | "line") => {
                let stroked = matches!(kind, "line" | "path" | "poly");
                let fill = self.paint(el.get("fill"), if stroked { "none" } else { "accent" }, defs);
                let stroke = self.paint(el.get("stroke"), if stroked { "ink" } else { "none" }, defs);
                let assemble =
                    if enter == "assemble" { if dur <= 0.0 { 1.0 } else { motion::clamp01(local / dur) } } else { 1.0 };
                let scatter = if exit == "scatter" { q } else { 0.0 };
                let defaults = Value::Object(Default::default());
                self.mosaic(
                    el,
                    if spec.is_object() { spec } else { &defaults },
                    &fill,
                    &stroke,
                    draw,
                    assemble,
                    scatter,
                    now,
                )
            }
            _ => self.shape(
                el,
                draw,
                dash_shift,
                if enter == "type" { motion::clamp01(local / dur.max(0.001)) } else { 1.0 },
                local,
                defs,
                now,
            ),
        };
        // Worn ink lets the paper through in specks: any element can be printed tired.
        let shape = match el.get("print").and_then(print::Spec::parse).filter(|p| p.wear > 0.0) {
            Some(spec) => {
                use std::hash::{Hash, Hasher};
                let mut h = std::collections::hash_map::DefaultHasher::new();
                el.to_string().hash(&mut h);
                self.worn(shape, spec.wear, h.finish(), (bx, by, bw, bh))
            }
            None => shape,
        };

        // Wipes reveal through a growing clip over the element bounds.
        let wipe = match (enter, exit) {
            ("wipe", _) if grow < 1.0 => Some((grow, false, false)),
            ("wipe-up", _) if grow < 1.0 => Some((grow, true, false)),
            (_, "wipe") if q > 0.0 => Some((1.0 - q, false, true)),
            _ => None,
        };
        let shape = match wipe {
            Some((p, _, _)) if p <= 0.001 => return fframes::svgr!(<g />),
            Some((p, up, leaving)) => {
                let id = self.uid("wipe");
                let pad = 8.0 + f(el, "width", 0.0);
                let (cx, cy, cw, ch) = if up {
                    (bx - pad, by - pad + (bh + 2.0 * pad) * (1.0 - p), bw + 2.0 * pad, (bh + 2.0 * pad) * p)
                } else if leaving {
                    (bx - pad + (bw + 2.0 * pad) * (1.0 - p), by - pad, (bw + 2.0 * pad) * p, bh + 2.0 * pad)
                } else {
                    (bx - pad, by - pad, (bw + 2.0 * pad) * p, bh + 2.0 * pad)
                };
                fframes::svgr!(<g>
                    <defs><clipPath id={id.clone()}><rect x={cx} y={cy} width={cw.max(0.0)} height={ch.max(0.0)} /></clipPath></defs>
                    <g clip-path={format!("url(#{id})")}>{shape}</g>
                </g>)
            }
            None => shape,
        };
        let shape = match el.get("material") {
            Some(m) => self.material(m, shape, now, (bx, by, bw, bh)),
            None => shape,
        };
        let shape = self.shine(el, shape, now, at + dur, (bx, by, bw, bh));
        let shape = self.tilt_shade(shape, (pose.tx, pose.ty), (bx, by, bw, bh));
        // Focus: blur in or out, an authored or keyed `blur`, and depth of field (distance
        // from the focus plane as a circle of confusion on screen; elements without `z` are
        // overlays and stay sharp).
        let mut blur = match (enter, exit) {
            ("blur", _) if e.alpha < 1.0 => 14.0 * (1.0 - e.alpha),
            (_, "blur") if q > 0.0 => 14.0 * q,
            _ => 0.0,
        };
        let mut authored = f(el, "blur", 0.0);
        for key in arr(el, "keys") {
            let start = f(key, "at", 0.0);
            if now < start {
                break;
            }
            if let Some(v) = num(key, "blur") {
                let span = f(key, "dur", crate::constants::get().canvas.key);
                let k = if span <= 1e-3 { 1.0 } else { ease(s(key, "ease"), (now - start) / span) };
                authored += (v - authored) * k;
            }
        }
        blur += authored.max(0.0);
        // Depth of field softens places, never words: type in depth stays readable through a
        // rack focus (an authored `blur` still applies).
        if let (Some((p, dz, _)), Some((fz, aperture)), false) = (persp, focus, s(el, "type") == "text") {
            let df = (1.0 + fz - cam_z).max(0.12);
            blur += (36.0 * aperture * (1.0 / dz - 1.0 / df).abs() / p.max(0.05)).min(80.0);
        }
        let (sx, sy) = smear;
        let shape = if sx > 0.6 || sy > 0.6 {
            let id = self.uid("smear");
            let pad = 3.0 * sx.max(sy) + 20.0;
            fframes::svgr!(<g>
                <defs><filter id={id.clone()} filterUnits="userSpaceOnUse" x={bx - pad - bw * 0.5} y={by - pad - bh * 0.5} width={bw * 2.0 + 2.0 * pad} height={bh * 2.0 + 2.0 * pad}><feGaussianBlur stdDeviation={format!("{sx:.2} {sy:.2}")} /></filter></defs>
                <g filter={format!("url(#{id})")}>{shape}</g>
            </g>)
        } else {
            shape
        };
        let shape = if blur > 0.05 {
            let id = self.uid("blur");
            let pad = 3.0 * blur + 20.0;
            fframes::svgr!(<g>
                <defs><filter id={id.clone()} filterUnits="userSpaceOnUse" x={bx - pad - bw * 0.5} y={by - pad - bh * 0.5} width={bw * 2.0 + 2.0 * pad} height={bh * 2.0 + 2.0 * pad}><feGaussianBlur stdDeviation={blur} /></filter></defs>
                <g filter={format!("url(#{id})")}>{shape}</g>
            </g>)
        } else {
            shape
        };
        let shape = self.depth_light(el, shape, (bx, by, bw, bh));
        let shape = match s(el, "blend") {
            "" | "normal" => shape,
            mode => fframes::svgr!(<g mix-blend-mode={mode.to_owned()}>{shape}</g>),
        };
        let identity = pose.dx.abs() < 1e-3
            && pose.dy.abs() < 1e-3
            && (pose.sx - 1.0).abs() < 1e-4
            && (pose.sy - 1.0).abs() < 1e-4
            && pose.rotate.abs() < 1e-3
            && pose.tx.abs() < 1e-3
            && pose.ty.abs() < 1e-3;
        let alpha = pose.alpha.clamp(0.0, 1.0);
        let placed = if identity && alpha >= 0.999 { shape } else { self.posed(shape, &pose, origin, identity, alpha) };
        // `subject: true`: the frame audit refuses type printed over this element (a drawn
        // product, a hero object), as it does for 3D solids.
        let placed = if el.get("subject").and_then(Value::as_bool) == Some(true) {
            let id = self.uid("subject");
            fframes::svgr!(<g id={id}>{placed}</g>)
        } else {
            placed
        };
        match persp {
            Some((p, _, fade)) => {
                let (gx, gy) = self.offset.get();
                let (cx, cy) = self.camera.get().unwrap_or_else(|| self.view_centre());
                let (cx, cy) = (cx - gx, cy - gy);
                fframes::svgr!(<g opacity={fade} transform={format!("translate({cx} {cy}) scale({p}) translate({} {})", -cx, -cy)}>{placed}</g>)
            }
            None => placed,
        }
    }

    /// The element's own pose (entrance, keys, loops) as one transform.
    fn posed(&self, shape: Svgr<'a>, pose: &Pose, origin: (f32, f32), identity: bool, alpha: f32) -> Svgr<'a> {
        let (ox, oy) = origin;
        let transform = if identity {
            "translate(0 0)".to_owned()
        } else {
            let [ma, mb, mc, md] = tilt_matrix(pose.tx, pose.ty);
            format!(
                "translate({} {}) rotate({}) matrix({ma} {mb} {mc} {md} 0 0) scale({} {}) translate({} {})",
                ox + pose.dx,
                oy + pose.dy,
                pose.rotate,
                // A negative scale mirrors (a reflection); only a zero scale is degenerate.
                if pose.sx.abs() < 0.0001 { 0.0001 } else { pose.sx },
                if pose.sy.abs() < 0.0001 { 0.0001 } else { pose.sy },
                -ox,
                -oy
            )
        };
        fframes::svgr!(<g opacity={alpha} transform={transform}>{shape}</g>)
    }

    /// Where perspective converges without a world camera: the middle of the authored view.
    fn view_centre(&self) -> (f32, f32) {
        let view = arr(self.props(), "view");
        let env = &self.b.environment;
        match view.len() {
            2 => (view[0].as_f64().unwrap_or(0.0) as f32 / 2.0, view[1].as_f64().unwrap_or(0.0) as f32 / 2.0),
            _ => (env.width / 2.0, env.height / 2.0),
        }
    }

    /// A light sweep across the element (`shine`): a soft band, masked to the element's own
    /// shape, travels across it once (or every `every` seconds), like a title catching light.
    fn shine(
        &self,
        el: &Value,
        shape: Svgr<'a>,
        now: f32,
        settled: f32,
        (bx, by, bw, bh): (f32, f32, f32, f32),
    ) -> Svgr<'a> {
        let Some(sh) = el.get("shine").filter(|v| v.is_object() || v.as_bool() == Some(true)) else { return shape };
        let span = f(sh, "dur", 1.1).max(0.05);
        let mut u = now - f(sh, "at", settled);
        if let Some(every) = num(sh, "every").filter(|_| u > 0.0) {
            u %= every.max(span);
        }
        let progress = u / span;
        if !(0.0..1.0).contains(&progress) {
            return shape;
        }
        let q = motion::in_out_cubic(progress);
        let pad = 8.0 + f(el, "width", 0.0);
        let (x0, y0, w0, h0) = (bx - pad, by - pad, bw + 2.0 * pad, bh + 2.0 * pad);
        let band = (w0 * f(sh, "width", 0.35)).max(8.0);
        let angle = f(sh, "angle", 20.0);
        let lean = h0 * angle.to_radians().tan().abs();
        let cx = x0 - band - lean + (w0 + 2.0 * band + 2.0 * lean) * q;
        let cy = y0 + h0 / 2.0;
        let color = self.paint(sh.get("color").or(Some(&Value::String("#ffffff".into()))), "#ffffff", &mut vec![]);
        let alpha = f(sh, "opacity", 0.85).clamp(0.0, 1.0);
        let (mask, grad) = (self.uid("shine-mask"), self.uid("shine"));
        fframes::svgr!(<g>
            {shape.clone()}
            <defs>
                <mask id={mask.clone()} mask-type="alpha" maskUnits="userSpaceOnUse" x={x0} y={y0} width={w0} height={h0}>{shape}</mask>
                <linearGradient id={grad.clone()} gradientUnits="userSpaceOnUse" x1={cx - band / 2.0} y1={cy} x2={cx + band / 2.0} y2={cy} gradientTransform={format!("rotate({angle} {cx} {cy})")}>
                    <stop offset="0" stop-color={color.clone()} stop-opacity="0" />
                    <stop offset="0.5" stop-color={color.clone()} stop-opacity={alpha} />
                    <stop offset="1" stop-color={color} stop-opacity="0" />
                </linearGradient>
            </defs>
            <rect x={x0} y={y0} width={w0} height={h0} fill={format!("url(#{grad})")} mask={format!("url(#{mask})")} />
        </g>)
    }

    /// A turned plane is lit unevenly: the edge turned toward the viewer catches a little light
    /// and the far edge falls into shade, which is what makes an orthographic tilt read as depth.
    fn tilt_shade(&self, shape: Svgr<'a>, (tx, ty): (f32, f32), (bx, by, bw, bh): (f32, f32, f32, f32)) -> Svgr<'a> {
        let (gx, gy) = (ty.to_radians().sin(), tx.to_radians().sin());
        let turn = gx.abs().max(gy.abs());
        if turn < 0.03 {
            return shape;
        }
        let len = (gx * gx + gy * gy).sqrt().max(1e-6);
        let (ux, uy) = (gx / len, gy / len);
        let (cx, cy) = (bx + bw / 2.0, by + bh / 2.0);
        let reach = 0.5 * (bw * ux.abs() + bh * uy.abs());
        let (mask, grad) = (self.uid("tilt-mask"), self.uid("tilt-shade"));
        let pad = 4.0;
        fframes::svgr!(<g>
            {shape.clone()}
            <defs>
                <mask id={mask.clone()} mask-type="alpha" maskUnits="userSpaceOnUse" x={bx - pad} y={by - pad} width={bw + 2.0 * pad} height={bh + 2.0 * pad}>{shape}</mask>
                <linearGradient id={grad.clone()} gradientUnits="userSpaceOnUse" x1={cx - ux * reach} y1={cy - uy * reach} x2={cx + ux * reach} y2={cy + uy * reach}>
                    <stop offset="0" stop-color="#ffffff" stop-opacity={0.10 * turn} />
                    <stop offset="0.45" stop-color="#ffffff" stop-opacity="0" />
                    <stop offset="1" stop-color="#000000" stop-opacity={0.24 * turn} />
                </linearGradient>
            </defs>
            <rect x={bx - pad} y={by - pad} width={bw + 2.0 * pad} height={bh + 2.0 * pad} fill={format!("url(#{grad})")} mask={format!("url(#{mask})")} />
        </g>)
    }

    /// Depth and light: `shadow` (a soft drop shadow) and `glow` (the element's light bleeding
    /// outward, in its own colour or `color`). `true` takes the defaults; an object tunes
    /// `blur`, `opacity`, `dx`, `dy` and `color`. On a group, one filter serves every child.
    fn depth_light(&self, el: &Value, shape: Svgr<'a>, (bx, by, bw, bh): (f32, f32, f32, f32)) -> Svgr<'a> {
        let on = |key: &str| el.get(key).filter(|v| v.as_bool() == Some(true) || v.is_object());
        let (shadow, glow) = (on("shadow"), on("glow"));
        if shadow.is_none() && glow.is_none() {
            return shape;
        }
        let opt = |v: Option<&Value>, key: &str, default: f32| {
            v.and_then(|v| v.get(key)).and_then(Value::as_f64).map_or(default, |x| x as f32)
        };
        let color = |v: Option<&Value>, fallback: &str| {
            let token = v.and_then(|v| v.get("color")).cloned().unwrap_or(Value::String(fallback.to_owned()));
            self.paint(Some(&token), fallback, &mut vec![])
        };
        let mut prims = vec![];
        let mut reach = 20.0f32;
        let mut top = "SourceGraphic";
        if let Some(sh) = shadow {
            let (dx, dy, blur) =
                (opt(Some(sh), "dx", 0.0), opt(Some(sh), "dy", 8.0), opt(Some(sh), "blur", 12.0).max(0.0));
            reach = reach.max(blur * 3.0 + dx.abs().max(dy.abs()) + 20.0);
            prims.push(fframes::svgr!(<feDropShadow dx={dx} dy={dy} stdDeviation={blur} flood-color={color(Some(sh), "#000000")} flood-opacity={opt(Some(sh), "opacity", 0.45).clamp(0.0, 1.0)} result="shadowed" />));
            top = "shadowed";
        }
        let merge = if let Some(g) = glow {
            let blur = opt(Some(g), "blur", 14.0).max(0.0);
            reach = reach.max(blur * 4.5 + 30.0);
            let alpha = opt(Some(g), "opacity", 0.85).clamp(0.0, 1.0) * 1.6;
            if g.get("color").is_some() {
                prims.push(fframes::svgr!(<feGaussianBlur in="SourceAlpha" stdDeviation={blur} result="soft" />));
                prims.push(fframes::svgr!(<feFlood flood-color={color(Some(g), "accent")} result="tint" />));
                prims.push(fframes::svgr!(<feComposite in="tint" in2="soft" operator="in" result="tinted" />));
                prims.push(fframes::svgr!(<feComponentTransfer in="tinted" result="glow"><feFuncA type="linear" slope={alpha} /></feComponentTransfer>));
            } else {
                prims.push(fframes::svgr!(<feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="soft" />));
                prims.push(fframes::svgr!(<feComponentTransfer in="soft" result="glow"><feFuncA type="linear" slope={alpha} /></feComponentTransfer>));
            }
            fframes::svgr!(<feMerge><feMergeNode in="glow" /><feMergeNode in={top.to_owned()} /></feMerge>)
        } else {
            fframes::svgr!(<feMerge><feMergeNode in={top.to_owned()} /></feMerge>)
        };
        prims.push(merge);
        let id = self.uid("light");
        fframes::svgr!(<g>
            <defs><filter id={id.clone()} filterUnits="userSpaceOnUse" x={bx - reach} y={by - reach} width={bw + 2.0 * reach} height={bh + 2.0 * reach}>{prims}</filter></defs>
            <g filter={format!("url(#{id})")}>{shape}</g>
        </g>)
    }

    /// The element's geometry and paint at a draw-on fraction.
    fn shape(
        &self,
        el: &Value,
        draw: f32,
        dash_shift: f32,
        reveal: f32,
        local: f32,
        defs: &mut Vec<Svgr<'a>>,
        now: f32,
    ) -> Svgr<'a> {
        let kind = s(el, "type");
        let filled_default = if matches!(kind, "line" | "path" | "poly") { "none" } else { "accent" };
        let fill = self.paint(el.get("fill"), filled_default, defs);
        let has_stroke = el.get("stroke").is_some();
        // Lines and open outlines draw in ink by default; a filled shape has no outline unless asked.
        let filled = el.get("fill").is_some_and(|v| v != "none");
        let outlined = kind == "line" || (matches!(kind, "path" | "poly") && !filled);
        let stroke = self.paint(el.get("stroke"), if outlined { "ink" } else { "none" }, defs);
        let width = f(el, "width", if matches!(kind, "line" | "path" | "poly") { 6.0 } else { 4.0 });
        let length = stroke_length(el);
        // During a draw-on the fill follows the outline in; strokeless shapes simply fade.
        let drawing = draw < 0.999 && length > 0.0 && (stroke != "none" || matches!(kind, "line" | "path" | "poly"));
        let fill_alpha = if draw < 0.999 && fill != "none" { motion::clamp01((draw - 0.55) / 0.45) } else { 1.0 };
        let custom_dash = arr(el, "dash")
            .iter()
            .filter_map(Value::as_f64)
            .map(|v| v.max(0.0).to_string())
            .collect::<Vec<_>>()
            .join(" ");
        let (dasharray, dashoffset) = if drawing {
            (format!("{} {}", length.max(0.001), length * 2.0 + 10.0), length * (1.0 - draw))
        } else if !custom_dash.is_empty() {
            let period: f32 = arr(el, "dash").iter().filter_map(Value::as_f64).sum::<f64>() as f32;
            (custom_dash, dash_shift * period)
        } else {
            ("none".to_owned(), 0.0)
        };
        let cap = nonempty(s(el, "cap"), "round").to_owned();
        let join = nonempty(s(el, "join"), "round").to_owned();
        if let Some(rough) = el.get("rough").filter(|r| r.is_object()) {
            if matches!(kind, "rect" | "circle" | "ellipse" | "line" | "path" | "poly") {
                return self.rough_shape(el, rough, &fill, &stroke, width, draw, now);
            }
        }
        // Printed: the colour plate (fill and screen) off register under the key line.
        if let Some(spec) = el.get("print").and_then(print::Spec::parse) {
            if matches!(kind, "rect" | "circle" | "ellipse" | "path" | "poly")
                && (spec.screen != print::Screen::None || spec.register != (0.0, 0.0))
            {
                return self.printed(el, &spec, draw, dash_shift, reveal, local, defs, now);
            }
        }
        match kind {
            "rect" => {
                let r = f(el, "r", 0.0);
                fframes::svgr!(<g>
                    <rect x={f(el, "x", 0.0)} y={f(el, "y", 0.0)} width={f(el, "w", 0.0).max(0.0)} height={f(el, "h", 0.0).max(0.0)} rx={r} ry={r} fill={fill.clone()} fill-opacity={fill_alpha} stroke="none" />
                    {if stroke != "none" || drawing { fframes::svgr!(<rect x={f(el, "x", 0.0)} y={f(el, "y", 0.0)} width={f(el, "w", 0.0).max(0.0)} height={f(el, "h", 0.0).max(0.0)} rx={r} ry={r} fill="none" stroke={if has_stroke { stroke.clone() } else { fill.clone() }} stroke-width={width} stroke-dasharray={dasharray.clone()} stroke-dashoffset={dashoffset} stroke-linecap={cap.clone()} stroke-linejoin={join.clone()} />) } else { fframes::svgr!(<g />) }}
                </g>)
            }
            "circle" | "ellipse" => {
                let (cx, cy) = (f(el, "cx", 0.0), f(el, "cy", 0.0));
                let (rx, ry) = if kind == "circle" {
                    (f(el, "r", 0.0), f(el, "r", 0.0))
                } else {
                    (f(el, "rx", 0.0), f(el, "ry", 0.0))
                };
                fframes::svgr!(<g>
                    <ellipse cx={cx} cy={cy} rx={rx.max(0.0)} ry={ry.max(0.0)} fill={fill.clone()} fill-opacity={fill_alpha} stroke="none" />
                    {if stroke != "none" || drawing { fframes::svgr!(<ellipse cx={cx} cy={cy} rx={rx.max(0.0)} ry={ry.max(0.0)} fill="none" stroke={if has_stroke { stroke.clone() } else { fill.clone() }} stroke-width={width} stroke-dasharray={dasharray.clone()} stroke-dashoffset={dashoffset} stroke-linecap={cap.clone()} />) } else { fframes::svgr!(<g />) }}
                </g>)
            }
            "line" | "path" | "poly" => {
                let d = match kind {
                    "line" => format!(
                        "M {} {} L {} {}",
                        f(el, "x1", 0.0),
                        f(el, "y1", 0.0),
                        f(el, "x2", 0.0),
                        f(el, "y2", 0.0)
                    ),
                    "poly" => {
                        let pts = points(el);
                        let mut d = pts
                            .iter()
                            .enumerate()
                            .map(|(i, (x, y))| format!("{} {x} {y}", if i == 0 { "M" } else { "L" }))
                            .collect::<Vec<_>>()
                            .join(" ");
                        if el.get("closed").and_then(Value::as_bool).unwrap_or(false) {
                            d.push_str(" Z");
                        }
                        d
                    }
                    _ => path_info(s(el, "d")).map(|p| p.d.clone()).unwrap_or_default(),
                };
                let mut nodes = vec![];
                if fill != "none" {
                    nodes.push(fframes::svgr!(<path d={d.clone()} fill={fill.clone()} fill-opacity={fill_alpha} stroke="none" />));
                }
                if stroke != "none" {
                    nodes.push(fframes::svgr!(<path d={d} fill="none" stroke={stroke.clone()} stroke-width={width} stroke-dasharray={dasharray} stroke-dashoffset={dashoffset} stroke-linecap={cap} stroke-linejoin={join} />));
                    // Arrowheads ride the draw-on tip; a start head appears with the stroke.
                    let heads = s(el, "arrow");
                    let outline = outline(el);
                    let head = f(el, "head", width * 3.2 + 6.0);
                    let mut tips = vec![];
                    if (heads == "end" || heads == "both") && draw > 0.02 {
                        tips.push(along(&outline, draw));
                    }
                    if (heads == "start" || heads == "both") && draw > 0.02 {
                        let reversed: Vec<_> = outline.iter().rev().copied().collect();
                        tips.push(along(&reversed, 1.0));
                    }
                    for ((x, y), angle) in tips.into_iter().flatten() {
                        nodes.push(fframes::svgr!(<path d={arrowhead(x, y, angle, head)} fill="none" stroke={stroke.clone()} stroke-width={width} stroke-linecap="round" stroke-linejoin="round" />));
                    }
                }
                fframes::svgr!(<g>{nodes}</g>)
            }
            "text" => self.canvas_text(el, &fill, reveal, local),
            "icon" => {
                let size = f(el, "size", 64.0);
                let color = self.paint(el.get("stroke").or(el.get("fill")), "accent", defs);
                crate::icons::render(
                    s(el, "name"),
                    f(el, "x", 0.0) - size / 2.0,
                    f(el, "y", 0.0) - size / 2.0,
                    size,
                    &color,
                )
            }
            "image" => self.canvas_image(el),
            "meter" => self.meter(el, &fill, now),
            "particles" => self.particles(el, &fill, now),
            // Tagged so the frame audit can find type printed over the object (a globe carries
            // its own labels).
            "solid" if s(el, "shape") != "globe" => {
                let id = self.uid("subject");
                fframes::svgr!(<g id={id}>{self.solid(el, draw, now, defs)}</g>)
            }
            "solid" => self.solid(el, draw, now, defs),
            "spotlight" => {
                // A dimming field with a window: everything outside the target recedes.
                let (x, y, w, h) = bounds(el);
                let r = if el.get("r").is_some() && el.get("cx").is_some() {
                    f(el, "r", 0.0)
                } else {
                    f(el, "radius", 24.0)
                };
                let hole = if el.get("cx").is_some() {
                    let (cx, cy) = (f(el, "cx", 0.0), f(el, "cy", 0.0));
                    format!("M {} {cy} a {r} {r} 0 1 0 {} 0 a {r} {r} 0 1 0 {} 0 Z", cx - r, 2.0 * r, -2.0 * r)
                } else {
                    format!("M {x} {} h {w} v {h} h {} Z", y, -w)
                };
                let d = format!("M -20000 -20000 H 20000 V 20000 H -20000 Z {hole}");
                let color = self.paint(el.get("fill"), "bg", defs);
                fframes::svgr!(<path d={d} fill={color} fill-opacity={f(el, "dim", 0.72)} fill-rule="evenodd" />)
            }
            "group" => {
                let at = f(el, "at", 0.0);
                // `shift` runs the children on another clock: a world beat carries earlier beats'
                // drawings forward, already finished and still looping, at their own times.
                let now = now + f(el, "shift", 0.0);
                let (x, y) = (f(el, "x", 0.0), f(el, "y", 0.0));
                let outer = self.offset.get();
                self.offset.set((outer.0 + x, outer.1 + y));
                let children = self.elements_at(arr(el, "children"), at, f(el, "stagger", 0.0), defs, now);
                self.offset.set(outer);
                if x.abs() < 1e-4 && y.abs() < 1e-4 {
                    fframes::svgr!(<g>{children}</g>)
                } else {
                    fframes::svgr!(<g transform={format!("translate({x} {y})")}>{children}</g>)
                }
            }
            _ => fframes::svgr!(<g />),
        }
    }

    fn canvas_text(&self, el: &Value, fill: &str, reveal: f32, local: f32) -> Svgr<'a> {
        let font = text_font(el);
        // Sizes are in the canvas's own units: a world label can be under a unit tall.
        let mut size = f(el, "size", 48.0).max(0.2);
        let mut tracking = f(el, "tracking", 0.0) * size;
        let mut value = s(el, "text").to_owned();
        if let Some(count) = el.get("count") {
            let (from, to) = (n(count, "from", 0.0), n(count, "to", 0.0));
            let decimals = n(count, "decimals", 0.0) as usize;
            let current =
                from + (to - from) * self.m.grow(local, f(count, "dur", crate::constants::get().canvas.count)) as f64;
            value = format_number(current, decimals, s(count, "prefix"), s(count, "suffix"));
        }
        if el.get("upper").and_then(Value::as_bool).unwrap_or(false) {
            value = value.to_uppercase();
        }
        if reveal < 1.0 {
            let chars = value.chars().count();
            value = value.chars().take((chars as f32 * reveal).ceil() as usize).collect();
        }
        // Decode: each character cycles through glyphs of the text itself until it locks,
        // left to right. Hash-driven, so every frame is reproducible.
        if s(el, "enter") == "scramble" {
            let dur = f(el, "dur", 0.9).max(0.01);
            let pool: Vec<char> = value.chars().filter(|c| c.is_alphanumeric()).collect();
            let chars: Vec<char> = value.chars().collect();
            let tick = (local * 18.0).floor() as u64;
            value = chars
                .iter()
                .enumerate()
                .map(|(i, &c)| {
                    let lock = dur * (0.25 + 0.75 * i as f32 / chars.len().max(1) as f32);
                    if local >= lock || !c.is_alphanumeric() || pool.is_empty() {
                        c
                    } else {
                        let h =
                            (i as u64).wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ tick.wrapping_mul(0xC2B2_AE3D_27D4_EB4F);
                        pool[(h >> 33) as usize % pool.len()]
                    }
                })
                .collect();
        }
        let (x, y) = (f(el, "x", 0.0), f(el, "y", 0.0));
        let align = match s(el, "anchor") {
            "middle" => Align::Center,
            "end" => Align::Right,
            _ => Align::Left,
        };
        if let Some(width) = num(el, "width") {
            // Wrapped text: `y` is the first baseline; the box is `width` wide.
            let style = Style {
                font,
                size,
                leading: f(el, "leading", 1.15),
                tracking: f(el, "tracking", 0.0),
                upper: false,
                balance: true,
            };
            let layout = self.fit(&value, style, width.max(1.0), f(el, "height", size * 8.0).max(size));
            let left = match align {
                Align::Center => x - width / 2.0,
                Align::Right => x - width,
                Align::Left => x,
            };
            return self.draw(&layout, left, y - layout.baseline, width, align, fill);
        }
        // `fit`: the widest a single line may be. A long title shrinks to fit instead of
        // running off the frame; the final text decides, so a decode or reveal never jumps.
        if let Some(fit) = num(el, "fit") {
            let full = if el.get("upper").and_then(Value::as_bool).unwrap_or(false) {
                s(el, "text").to_uppercase()
            } else {
                s(el, "text").to_owned()
            };
            let natural = text::measure(font, &full, size, tracking);
            if natural > fit && natural > 0.0 {
                size *= fit / natural;
                tracking *= fit / natural;
            }
        }
        let w = text::measure(font, &value, size, tracking);
        let final_w = if el.get("count").is_some() {
            let count = &el["count"];
            text::measure(
                font,
                &format_number(
                    n(count, "to", 0.0),
                    n(count, "decimals", 0.0) as usize,
                    s(count, "prefix"),
                    s(count, "suffix"),
                ),
                size,
                tracking,
            )
            .max(w)
        } else {
            w
        };
        // Counters keep their final anchor so a centred number never drifts while counting.
        let left = match align {
            Align::Center => x - final_w / 2.0 + (final_w - w) / 2.0,
            Align::Right => x - w,
            Align::Left => x,
        };
        self.run(value, left, y, font, size, tracking, fill)
    }

    fn canvas_image(&self, el: &Value) -> Svgr<'a> {
        let key = s(el, "file");
        let image = self
            .ctx
            .get_image(key)
            .map(|i| i.href())
            .unwrap_or_else(|| panic!("missing or undecodable prepared image: {key}"));
        let (x, y, w, h) = (f(el, "x", 0.0), f(el, "y", 0.0), f(el, "w", 0.0).max(1.0), f(el, "h", 0.0).max(1.0));
        let r = f(el, "r", 0.0);
        let contain = s(el, "fit") == "contain";
        let aspect = if contain { "xMidYMid meet" } else { "xMidYMid slice" };
        let id = self.uid("cimg");
        // Printed pictures: the photo becomes paper and a screen whose dots (or lines) follow
        // its darkness, in the palette's ink.
        let spec = el
            .get("print")
            .and_then(print::Spec::parse)
            .or_else(|| print::Spec::parse(&Value::String(s(el, "treatment").into())))
            .filter(|p| p.screen != print::Screen::None);
        let img = match spec {
            Some(spec) => {
                let (iw, ih) = (image.width.max(1) as f32, image.height.max(1) as f32);
                let k = if contain { (w / iw).min(h / ih) } else { (w / iw).max(h / ih) };
                let place = (x + (w - iw * k) / 2.0, y + (h - ih * k) / 2.0, iw * k, ih * k);
                let mut defs = vec![];
                let paper = self.paint(el.get("fill"), if el.get("treatment").is_some() { "bg" } else { "none" }, &mut defs);
                let ink = self.paint(spec.ink.as_ref(), "ink", &mut defs);
                let printed = self.printed_picture(&image, place, (x, y, w, h), &spec, &paper, &ink, true);
                fframes::svgr!(<g><defs>{defs}</defs>{printed}</g>)
            }
            None => {
                let img =
                    fframes::svgr!(<image x={x} y={y} width={w} height={h} preserveAspectRatio={aspect} href={image} />);
                self.treat(img, s(el, "treatment"))
            }
        };
        fframes::svgr!(<g>
            <defs><clipPath id={id.clone()}><rect x={x} y={y} width={w} height={h} rx={r} ry={r} /></clipPath></defs>
            <g clip-path={format!("url(#{id})")}>{img}</g>
        </g>)
    }

    /// Palette-matched image treatments shared by canvas images and plates.
    pub(crate) fn treat(&self, image: Svgr<'a>, treatment: &str) -> Svgr<'a> {
        let rgb = |hex: &str| crate::design::parse(hex).unwrap_or([0.0, 0.0, 0.0]);
        match treatment {
            "mono" => {
                let id = self.uid("mono");
                fframes::svgr!(<g>
                    <defs><filter id={id.clone()} color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0" /></filter></defs>
                    <g filter={format!("url(#{id})")}>{image}</g>
                </g>)
            }
            "duotone" => {
                // Luminance mapped from the palette's darkest to its accent: every photo or
                // generated plate adopts the film's colors.
                let (dark, light) = if self.p.dark {
                    (self.p.bg.clone(), self.p.accent.clone())
                } else {
                    (self.p.ink.clone(), self.p.bg.clone())
                };
                let (a, b) = (rgb(&dark), rgb(&light));
                let table = |i: usize| format!("{} {}", a[i], b[i]);
                let id = self.uid("duo");
                fframes::svgr!(<g>
                    <defs><filter id={id.clone()} color-interpolation-filters="sRGB">
                        <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0" />
                        <feComponentTransfer>
                            <feFuncR type="table" tableValues={table(0)} />
                            <feFuncG type="table" tableValues={table(1)} />
                            <feFuncB type="table" tableValues={table(2)} />
                        </feComponentTransfer>
                    </filter></defs>
                    <g filter={format!("url(#{id})")}>{image}</g>
                </g>)
            }
            "tint" => {
                let id = self.uid("tint");
                let [r, g, b] = rgb(&self.p.accent);
                // Desaturate, then multiply by the accent (lifted toward white so shadows keep detail).
                let lift = |c: f32| 0.35 + 0.65 * c;
                let m = format!(
                    "{r0} {g0} {b0} 0 0 {r1} {g1} {b1} 0 0 {r2} {g2} {b2} 0 0 0 0 0 1 0",
                    r0 = 0.2126 * lift(r),
                    g0 = 0.7152 * lift(r),
                    b0 = 0.0722 * lift(r),
                    r1 = 0.2126 * lift(g),
                    g1 = 0.7152 * lift(g),
                    b1 = 0.0722 * lift(g),
                    r2 = 0.2126 * lift(b),
                    g2 = 0.7152 * lift(b),
                    b2 = 0.0722 * lift(b)
                );
                fframes::svgr!(<g>
                    <defs><filter id={id.clone()} color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values={m} /></filter></defs>
                    <g filter={format!("url(#{id})")}>{image}</g>
                </g>)
            }
            "blur" | "soft" => {
                let id = self.uid("iblur");
                let amount = if treatment == "blur" { 18.0 } else { 6.0 };
                fframes::svgr!(<g>
                    <defs><filter id={id.clone()} x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation={amount} /></filter></defs>
                    <g filter={format!("url(#{id})")}>{image}</g>
                </g>)
            }
            _ => image,
        }
    }

    /// The `canvas` block: author coordinates are the frame (1920×1080 landscape) unless a
    /// `view` is given, which is fitted into the content area below the header.
    pub(super) fn canvas(&self) -> Svgr<'a> {
        let p = self.props();
        self.camera_rect(p);
        let cam_z = keyed_z(arr(p, "dolly"), 0.0, self.t);
        let focus = p
            .get("focus")
            .filter(|v| v.is_object())
            .map(|fo| (keyed_z(arr(fo, "keys"), f(fo, "z", 0.0), self.t), f(fo, "aperture", 1.0)));
        self.depth.set((cam_z, focus));
        self.collect_occluders(arr(p, "elements"), p.get("mosaic").is_some());
        let mut defs = vec![];
        let nodes = self.elements(arr(p, "elements"), self.b.cue_seconds, f(p, "stagger", 0.0), &mut defs);
        let body = fframes::svgr!(<g><defs>{defs}</defs>{nodes}</g>);
        self.fit_view(body, p)
    }

    /// For every mosaic element, the outlines of the filled mosaic shapes drawn after it (in
    /// the same coordinates: group offsets applied). A later shape knocks its outline out of
    /// the earlier mosaic, whose rows then bend around it (`halo`).
    fn collect_occluders(&self, list: &[Value], canvas_mosaic: bool) {
        // (element, group offset, clock shift) for every leaf, in drawing order.
        let mut flat: Vec<(&Value, f32, f32, f32)> = vec![];
        fn walk<'v>(list: &'v [Value], dx: f32, dy: f32, shift: f32, out: &mut Vec<(&'v Value, f32, f32, f32)>) {
            for el in list {
                if s(el, "type") == "group" {
                    let (gx, gy, gs) = (f(el, "x", 0.0), f(el, "y", 0.0), f(el, "shift", 0.0));
                    walk(arr(el, "children"), dx + gx, dy + gy, shift + gs, out);
                } else {
                    out.push((el, dx, dy, shift));
                }
            }
        }
        walk(list, 0.0, 0.0, 0.0, &mut flat);
        let is_mosaic = |el: &Value| {
            let m = el.get("mosaic").filter(|m| m.as_bool() == Some(true) || m.is_object()).is_some()
                || (canvas_mosaic && el.get("mosaic").is_none());
            m && matches!(s(el, "type"), "rect" | "circle" | "ellipse" | "path" | "poly")
                && el.get("fill").is_some_and(|f| f != "none")
        };
        // A later shape cuts in from the moment it enters until it leaves.
        let present = |el: &Value, shift: f32| {
            let now = self.t + shift;
            now >= f(el, "at", 0.0) && num(el, "exitAt").is_none_or(|e| now < e)
        };
        let mut map = self.occluders.borrow_mut();
        map.clear();
        for (i, &(el, ex, ey, _)) in flat.iter().enumerate() {
            if !is_mosaic(el) {
                continue;
            }
            let later: Vec<Vec<(f32, f32)>> = flat[i + 1..]
                .iter()
                .filter(|(o, _, _, shift)| {
                    is_mosaic(o)
                        && present(o, *shift)
                        && o.get("mosaic").and_then(|m| m.get("knockout")).is_none_or(|k| k != false)
                })
                .flat_map(|(o, dx, dy, _)| {
                    contours_of(o)
                        .into_iter()
                        .filter(|(_, closed)| *closed)
                        .map(|(c, _)| c.into_iter().map(|(x, y)| (x + dx - ex, y + dy - ey)).collect::<Vec<_>>())
                        .collect::<Vec<_>>()
                })
                .collect();
            if !later.is_empty() {
                map.insert(el as *const Value as usize, later);
            }
        }
    }

    /// Place author coordinates in the frame. A `[w, h]` view is fitted into the content area;
    /// `"auto"` fits the drawing's own bounds (at rest) with a margin, enlarging small drawings
    /// up to 2× so a sketch drawn at any scale fills the space it has.
    /// The world camera at this frame: a rect [x, y, w, h] framed across the whole frame. It
    /// travels in from `viewFrom` (from `viewAt`, over `viewDur`), drifts in by `viewDrift`
    /// while it holds, and may start the next beat's move early (`viewNext: {to, at, dur}`),
    /// so it lands on the next line instead of after it. Both beats evaluate the same curve
    /// across the cut, so the move is continuous.
    pub(crate) fn camera_rect(&self, p: &Value) -> Option<[f32; 4]> {
        let cam = self.camera_at(p, self.t)?;
        self.camera.set(Some((cam[0] + cam[2] / 2.0, cam[1] + cam[3] / 2.0)));
        Some(cam)
    }

    /// The camera rect at scene seconds `t` (a pure function, for motion blur).
    fn camera_at(&self, p: &Value, t: f32) -> Option<[f32; 4]> {
        let to = rect4(arr(p, "view"))?;
        let beat_end = self.b.frames as f32 / self.f.fps as f32;
        let from = rect4(arr(p, "viewFrom"));
        let arrive = if from.is_some() { f(p, "viewAt", 0.0) + f(p, "viewDur", 1.2) } else { 0.0 };
        let next = p.get("viewNext").filter(|v| v.is_object());
        let hold_end = next.map_or(beat_end, |n| f(n, "at", beat_end));
        let span = (hold_end - arrive).max(0.1);
        let d = f(p, "viewDrift", 0.0) * motion::in_out_cubic(motion::clamp01((t - arrive) / span));
        let held = [to[0] + to[2] * d / 2.0, to[1] + to[3] * d / 2.0, to[2] * (1.0 - d), to[3] * (1.0 - d)];
        let mut cam = match from {
            Some(from) => {
                let q =
                    motion::in_out_cubic(motion::clamp01((t - f(p, "viewAt", 0.0)) / f(p, "viewDur", 1.2).max(0.01)));
                travel(from, held, q)
            }
            None => held,
        };
        if let (Some(n), Some(next_to)) = (next, next.and_then(|n| rect4(arr(n, "to")))) {
            let at = f(n, "at", beat_end);
            if t > at {
                let q = motion::in_out_cubic(motion::clamp01((t - at) / f(n, "dur", 1.2).max(0.01)));
                cam = travel(cam, next_to, q);
            }
        }
        Some(cam)
    }

    pub(crate) fn fit_view(&self, body: Svgr<'a>, p: &Value) -> Svgr<'a> {
        let a = self.area;
        if let Some(cam) = self.camera_rect(p) {
            let env = &self.b.environment;
            let (w, h) = (env.width, env.height);
            let place = |c: [f32; 4]| {
                let k = (w / c[2]).min(h / c[3]);
                (k, (w - c[2] * k) / 2.0 - c[0] * k, (h - c[3] * k) / 2.0 - c[1] * k)
            };
            let (k, ox, oy) = place(cam);
            let moved = fframes::svgr!(<g transform={format!("translate({ox} {oy}) scale({k})")}>{body}</g>);
            // Motion blur: how far the picture travelled while the shutter was open, as a
            // Gaussian along each axis (zooms smear toward the edges, so they add to both).
            let shutter = crate::lens::Lens::from(&self.b.lens).blur;
            let before = (shutter > 0.0).then(|| self.camera_at(p, self.t - shutter / self.f.fps as f32)).flatten();
            if let Some(prev) = before {
                let (kp, px, py) = place(prev);
                let (wx, wy) = ((w / 2.0 - ox) / k, (h / 2.0 - oy) / k);
                let (dx, dy) = ((wx * kp + px - w / 2.0).abs(), (wy * kp + py - h / 2.0).abs());
                let zoom = (k / kp - 1.0).abs() * w * 0.2;
                let (bx, by) = (((dx + zoom) * 0.5).min(40.0), ((dy + zoom * h / w) * 0.5).min(40.0));
                if bx > 0.6 || by > 0.6 {
                    let id = self.uid("mblur");
                    return fframes::svgr!(<g>
                        <defs><filter id={id.clone()} filterUnits="userSpaceOnUse" x="0" y="0" width={w} height={h}>
                            <feGaussianBlur stdDeviation={format!("{bx:.2} {by:.2}")} />
                        </filter></defs>
                        <g filter={format!("url(#{id})")}>{moved}</g>
                    </g>);
                }
            }
            return moved;
        }
        let (x0, y0, vw, vh) = if s(p, "view") == "auto" {
            let mut acc: Option<(f32, f32, f32, f32)> = None;
            for el in arr(p, "elements") {
                if matches!(s(el, "type"), "spotlight") {
                    continue;
                }
                let (x, y, w, h) = bounds(el);
                acc = Some(match acc {
                    None => (x, y, x + w, y + h),
                    Some((l, t, r, b)) => (l.min(x), t.min(y), r.max(x + w), b.max(y + h)),
                });
            }
            let Some((l, t, r, b)) = acc else { return body };
            let pad = 0.04 * (r - l).max(b - t);
            (l - pad, t - pad, (r - l + 2.0 * pad).max(16.0), (b - t + 2.0 * pad).max(16.0))
        } else {
            let view = arr(p, "view");
            if view.len() != 2 {
                return body;
            }
            (0.0, 0.0, view[0].as_f64().unwrap_or(1.0) as f32, view[1].as_f64().unwrap_or(1.0) as f32)
        };
        let k = (a.w / vw).min(a.h / vh).min(if s(p, "view") == "auto" { 2.0 } else { f32::MAX });
        let (ox, oy) = (a.x + (a.w - vw * k) / 2.0 - x0 * k, a.y + (a.h - vh * k) / 2.0 - y0 * k);
        fframes::svgr!(<g transform={format!("translate({ox} {oy}) scale({k})")}>{body}</g>)
    }

    /// A beat's `art` layer, drawn under or over its block in frame coordinates.
    pub(crate) fn art(&self, layer: &str) -> Svgr<'a> {
        let Some(art) = self.b.art.as_ref() else { return fframes::svgr!(<g />) };
        let list = arr(art, layer);
        if list.is_empty() {
            return fframes::svgr!(<g />);
        }
        let mut defs = vec![];
        let nodes = self.elements(list, self.b.cue_seconds, 0.0, &mut defs);
        fframes::svgr!(<g><defs>{defs}</defs>{nodes}</g>)
    }
}

/// A camera rect from JSON `[x, y, w, h]`.
fn rect4(v: &[Value]) -> Option<[f32; 4]> {
    (v.len() == 4).then(|| std::array::from_fn(|i| v[i].as_f64().unwrap_or(0.0) as f32))
}

/// Camera between two rects at progress `q`: the centre moves linearly and the zoom
/// interpolates in log space, so a push-in keeps a constant pace.
fn travel(from: [f32; 4], to: [f32; 4], q: f32) -> [f32; 4] {
    let lerp = |a: f32, b: f32| a + (b - a) * q;
    let (w0, w1) = (from[2].max(1.0), to[2].max(1.0));
    let w = w0 * (w1 / w0).powf(q);
    let h = w * lerp(from[3] / w0, to[3] / w1);
    // A real zoom turns about one point that stays put on screen, the point both rects agree
    // on. Interpolating the centre linearly while the width moves exponentially swings the
    // target off frame mid-zoom. Pans (nearly equal widths) travel straight.
    if (w1 / w0).ln().abs() > 0.15 {
        let fixed = |a0: f32, a1: f32| (a0 * w1 - a1 * w0) / (w1 - w0);
        let (fx, fy) = (fixed(from[0], to[0]), fixed(from[1], to[1]));
        let k = w / w0;
        return [fx - (fx - from[0]) * k, fy - (fy - from[1]) * k, w, h];
    }
    let (cx, cy) =
        (lerp(from[0] + from[2] / 2.0, to[0] + to[2] / 2.0), lerp(from[1] + from[3] / 2.0, to[1] + to[3] / 2.0));
    [cx - w / 2.0, cy - h / 2.0, w, h]
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn paths_parse_measure_and_reject_garbage() {
        let info = path_info("M 0 0 L 300 400").unwrap();
        assert!((info.length - 500.0).abs() < 0.5, "{}", info.length);
        assert_eq!(info.bounds, (0.0, 0.0, 300.0, 400.0));
        let arc = path_info("M 0 0 A 100 100 0 0 1 200 0").unwrap();
        assert!((arc.length - PI * 100.0).abs() < 1.0, "semicircle {}", arc.length);
        assert!(!arc.d.contains('A'), "arcs are normalized to curves");
        assert!(path_info("M 0 0 L nope").is_none());
        assert!(path_info("<script>").is_none());
    }
    #[test]
    fn zooms_turn_about_the_point_both_views_share() {
        // From the whole map to a window at (900, 500): the window keeps its place on screen.
        let (from, to) = ([0.0, 0.0, 1920.0, 1080.0], [880.0, 488.75, 40.0, 22.5]);
        let at = |c: [f32; 4]| ((900.0 - c[0]) / c[2], (500.0 - c[1]) / c[3]);
        let (a, b) = (at(from), at(to));
        for q in [0.25, 0.5, 0.75] {
            let (u, v) = at(travel(from, to, q));
            assert!((u - a.0).abs() < 0.02 && (v - a.1).abs() < 0.02, "{q}: {u},{v} vs {a:?} {b:?}");
        }
        let end = travel(from, to, 1.0);
        assert!((end[0] - to[0]).abs() < 0.5 && (end[2] - to[2]).abs() < 0.5);
    }
    #[test]
    fn arrow_tips_follow_the_outline() {
        let pts = vec![(0.0, 0.0), (100.0, 0.0), (100.0, 100.0)];
        let ((x, y), angle) = along(&pts, 0.25).unwrap();
        assert!((x - 50.0).abs() < 1e-3 && y.abs() < 1e-3 && angle.abs() < 1e-3);
        let ((x, y), angle) = along(&pts, 1.0).unwrap();
        assert!((x - 100.0).abs() < 1e-3 && (y - 100.0).abs() < 1e-3 && (angle - PI / 2.0).abs() < 1e-3);
    }
    #[test]
    fn quantitative_strokes_share_linear_time_and_preserve_existing_easing() {
        assert_eq!(stroke_reveal(0.5, 2.0, "linear"), 0.25);
        assert_eq!(stroke_reveal(-1.0, 2.0, "linear"), 0.0);
        assert_eq!(stroke_reveal(3.0, 2.0, "linear"), 1.0);
        assert_eq!(stroke_reveal(0.5, 2.0, ""), motion::out_cubic(0.25));
        assert_eq!(stroke_reveal(0.5, 2.0, "out"), motion::out_cubic(0.25));
        assert!(validate(&serde_json::json!({"elements":[{"type":"line","x2":10,"y2":20,"enter":"draw","drawEase":"linear"}]})).is_ok());
        assert!(validate(&serde_json::json!({"elements":[{"type":"line","x2":10,"y2":20,"enter":"fade","drawEase":"linear"}]})).is_err());
    }
    #[test]
    fn every_canvas_effect_is_a_pure_function_of_the_frame() {
        let job = serde_json::json!({"version":2,"width":1920,"height":1080,"fps":30,"frames":90,"beats":[
            {"id":"a","block":"canvas","frames":90,"start_frame":0,"cue_seconds":0,"levels":[0,10,40,80,60,30,20,50,90,70],"props":{"elements":[
                {"type":"circle","cx":300,"cy":300,"r":40,"fill":"accent","rough":{"amount":3,"boil":8},"at":0,"dur":1},
                {"type":"path","d":"M 100 800 C 500 400 900 400 1300 800","stroke":"ink","rough":{},"at":0.2,"dur":1},
                {"type":"line","x1":100,"y1":700,"x2":900,"y2":300,"stroke":"accent","enter":"draw","drawEase":"linear","at":0.1,"dur":1.7},
                {"type":"circle","cx":100,"cy":800,"r":20,"fill":"accent2","at":0,"dur":0.3,"fps":12,
                 "along":{"d":"M 100 800 C 500 400 900 400 1300 800","at":0,"dur":2,"loop":true},"echo":{"count":5,"lag":0.08,"to":"accent"}},
                {"type":"rect","x":1500,"y":200,"w":200,"h":200,"at":0,"dur":0,"morph":{"from":{"type":"circle","cx":1400,"cy":300,"r":60},"dur":1}},
                {"type":"meter","x":600,"y":900,"w":600,"h":100,"style":"mirror","at":0,"dur":0},
                {"type":"spotlight","cx":960,"cy":540,"r":120,"at":0.5,"dur":0.4},
                {"type":"text","text":"Decode 2026","x":200,"y":150,"size":48,"enter":"scramble","at":0,"dur":1.2},
                {"type":"text","text":"PRO","x":900,"y":500,"size":200,"material":"thermal","at":0,"dur":0},
                {"type":"rect","x":1200,"y":600,"w":400,"h":260,"r":20,"fill":"surface","tilt":[12,-20],
                 "keys":[{"at":0,"tiltY":70,"dur":0},{"at":0,"tiltY":-20,"dur":1}],"loop":{"type":"rock","period":3,"amount":6},"at":0,"dur":0}]}}]});
        let film = crate::Film::from_json(&serde_json::to_vec(&job).unwrap()).unwrap();
        let ctx = FFramesContext {
            time_base: fframes::TimeBase { fps: 30, sample_rate: 48000 },
            current_video_size: fframes::VideoSize { width: 1920, height: 1080 },
            duration_in_frames: 90,
            mode: fframes::FFramesMode::Renderer,
            scenes: None,
            media_source: None,
            font_source: None,
            abort_signal: None,
        };
        let render = |i| format!("{:?}", fframes::Scene::render_frame(&film.beats[0], Frame::new(i, i, 30), &ctx));
        let (early, late) = (render(7), render(40));
        assert_ne!(early, late, "the scene must animate");
        assert_eq!(early, render(7), "seeking back reproduces the frame exactly, boil and scramble included");
        assert_eq!(render(88), render(88));
    }
    #[test]
    fn a_tilted_plane_is_an_orthographic_turn() {
        assert_eq!(tilt_matrix(0.0, 0.0), [1.0, 0.0, 0.0, 1.0]);
        let [a, b, c, d] = tilt_matrix(0.0, 60.0);
        assert!(
            (a - 0.5).abs() < 1e-5 && b.abs() < 1e-6 && c == 0.0 && (d - 1.0).abs() < 1e-6,
            "turning about y narrows x"
        );
        let [_, b, _, d] = tilt_matrix(30.0, 30.0);
        assert!(b > 0.2 && (d - 0.866).abs() < 1e-3, "both turns shear and shorten");
    }
    #[test]
    fn validation_rejects_unknown_types_colors_and_oversized_scenes() {
        let ok = serde_json::json!({"elements":[{"type":"circle","cx":10,"cy":10,"r":5,"fill":"accent"}]});
        assert!(validate(&ok).is_ok());
        for bad in [
            serde_json::json!({"elements":[]}),
            serde_json::json!({"elements":[{"type":"script"}]}),
            serde_json::json!({"elements":[{"type":"rect","fill":"url(#x)"}]}),
            serde_json::json!({"elements":[{"type":"path","d":"M 0 0 Q"}]}),
            serde_json::json!({"elements":[{"type":"icon","name":"../x.svg"}]}),
            serde_json::json!({"elements":[{"type":"rect","material":"plasma"}]}),
            serde_json::json!({"elements":[{"type":"rect","tilt":[10]}]}),
            serde_json::json!({"elements":[{"type":"rect","enter":"explode"}]}),
            serde_json::json!({"view":[0,10],"elements":[{"type":"rect"}]}),
        ] {
            assert!(validate(&bad).is_err(), "{bad}");
        }
        let many: Vec<_> = (0..601).map(|_| serde_json::json!({"type":"rect"})).collect();
        assert!(validate(&serde_json::json!({"elements":many})).is_err());
    }
}
