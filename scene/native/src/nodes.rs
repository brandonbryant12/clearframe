//! Native elements: the canvas element dialect (rect, circle, ellipse, line, path, poly, text,
//! icon, image, group, particles, spotlight) evaluated and drawn directly with Skia, plus node
//! types only the engine draws: `video` (footage as a GPU texture), `shader` (an SkSL
//! material), `code` (an editor whose lines keep their identity across edits) and particle
//! systems in the thousands. Entrances, keys, travel along routes, loops and exits follow the
//! canvas block's rules; every value is a pure function of layer seconds, so seeking any
//! direction reproduces the frame.
//!
//! Elements can be attached to other elements by id (`attach: {to, dx, dy}`, a callout riding a
//! moving actor) and ride another element's route (`along: {path: id}`, a packet on a wire).
use crate::design::{self, Palette};
use crate::fonts;
use crate::geometry::*;
use crate::materials;
use crate::media::Media;
use crate::motion::{self, Enter, MotionStyle};
use crate::paint::{self, Fill};
use crate::text::{self, Font, Style};
use serde_json::Value;
use skia_safe::{
    self as sk, BlendMode, Canvas, ClipOp, Matrix, Paint, PaintCap, PaintJoin, PaintStyle, Point, RRect, Rect,
    SamplingOptions, TileMode, color_filters, dash_path_effect, image_filters,
};
use std::collections::HashMap;
use std::f32::consts::TAU;
use std::sync::Arc;

pub const TYPES: &[&str] = &[
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
    "particles",
    "spotlight",
    "video",
    "shader",
    "code",
    "connector",
];
pub const ENTERS: &[&str] = &[
    "fade", "pop", "rise", "drop", "left", "right", "grow", "grow-x", "grow-y", "draw", "wipe", "wipe-up", "type",
    "scramble", "blur", "none",
];
pub const EXITS: &[&str] = &["fade", "shrink", "fall", "lift", "undraw", "wipe", "blur", "none"];
pub const LOOPS: &[&str] = &["spin", "pulse", "float", "sway", "orbit", "dash", "blink", "rock"];
/// Canvas features the native evaluator does not draw. A plan using them is refused with the
/// element named, so nothing silently disappears; they remain available in `canvas`/`art`.
pub const BLOCK_ONLY: &[&str] = &["rough", "print", "mosaic", "morph", "solid", "meter", "level"];
pub const PARTICLE_KINDS: &[&str] = &["dust", "embers", "rain", "snow", "bubbles", "stars", "burst", "stream", "field"];
pub const MAX_PARTICLES: f32 = 4000.0;

fn finite(v: &Value) -> bool {
    match v {
        Value::Number(n) => n.as_f64().is_some_and(f64::is_finite),
        Value::Array(a) => a.iter().all(finite),
        Value::Object(o) => o.values().all(finite),
        _ => true,
    }
}

/// Structural checks for native elements (the plan compiler gives author-facing messages first).
pub fn validate(elements: &[Value], depth: usize, count: &mut usize) -> Result<(), String> {
    if depth > 6 {
        return Err("native groups nest at most six levels".into());
    }
    for el in elements {
        *count += 1;
        if *count > crate::plan::MAX_ELEMENTS {
            return Err(format!("a native layer holds at most {} elements", crate::plan::MAX_ELEMENTS));
        }
        if !el.is_object() || !finite(el) {
            return Err("elements must be objects with finite numbers".into());
        }
        let kind = s(el, "type");
        let name = el.get("id").and_then(Value::as_str).unwrap_or(kind);
        if !TYPES.contains(&kind) {
            return Err(format!("{name}: unknown native element type {kind:?}"));
        }
        for key in BLOCK_ONLY {
            if el.get(*key).is_some() || (s(el, "loop") == *key) || el.get("loop").is_some_and(|l| s(l, "type") == *key)
            {
                return Err(format!("{name}: `{key}` is drawn by the canvas block, not native layers"));
            }
        }
        let enter = s(el, "enter");
        if !enter.is_empty() && !ENTERS.contains(&enter) {
            return Err(format!("{name}: entrance {enter:?} is not native"));
        }
        let exit = s(el, "exit");
        if !exit.is_empty() && !EXITS.contains(&exit) {
            return Err(format!("{name}: exit {exit:?} is not native"));
        }
        if let Some(l) = el.get("loop") {
            if !LOOPS.contains(&s(l, "type")) || f(l, "period", 4.0) <= 0.05 {
                return Err(format!("{name}: loops need a known type and a positive period"));
            }
        }
        if !paint::paint_ok(el.get("fill")) || !paint::paint_ok(el.get("stroke")) {
            return Err(format!("{name}: colours are palette tokens, #rrggbb or a gradient of tokens"));
        }
        for key in ["at", "dur", "exitAt", "exitDur"] {
            if num(el, key).is_some_and(|v| v < 0.0) {
                return Err(format!("{name}: times must be nonnegative"));
            }
        }
        if !(0.0..=1.0).contains(&f(el, "opacity", 1.0)) {
            return Err(format!("{name}: opacity is 0–1"));
        }
        if let Some(m) = el.get("material") {
            let preset = m.as_str().or_else(|| m.get("name").and_then(Value::as_str)).unwrap_or("");
            if !materials::NAMES.contains(&preset) {
                return Err(format!("{name}: material is one of {}", materials::NAMES.join(", ")));
            }
        }
        if let Some(route) = el.get("along") {
            let ok = match route.get("path").and_then(Value::as_str) {
                Some(id) => !id.is_empty(),
                None => path_info(s(route, "d")).is_some(),
            };
            if !ok {
                return Err(format!("{name}: along needs path data `d` or a `path` element id"));
            }
        }
        if let Some(a) = el.get("attach") {
            if a.get("to").and_then(Value::as_str).is_none_or(str::is_empty) {
                return Err(format!("{name}: attach needs `to`, the id of an earlier element"));
            }
        }
        match kind {
            "path" if path_info(s(el, "d")).is_none() => return Err(format!("{name}: path data could not be parsed")),
            "poly" if !(2..=2000).contains(&points(el).len()) => {
                return Err(format!("{name}: poly needs 2–2000 points"));
            }
            "icon" if !crate::icons::supported(s(el, "name")) => {
                return Err(format!("{name}: unknown icon {:?}", s(el, "name")));
            }
            "image" | "video" if s(el, "file").is_empty() => return Err(format!("{name}: needs a prepared file")),
            "video" if f(el, "w", 0.0) <= 0.0 || f(el, "h", 0.0) <= 0.0 => {
                return Err(format!("{name}: footage needs w and h"));
            }
            "shader" if el.get("material").is_none() => return Err(format!("{name}: shader needs a material")),
            "particles" => {
                let k = if s(el, "kind").is_empty() { "dust" } else { s(el, "kind") };
                if !PARTICLE_KINDS.contains(&k) || !(1.0..=MAX_PARTICLES).contains(&f(el, "count", 40.0)) {
                    return Err(format!("{name}: particles are {} with count 1–4000", PARTICLE_KINDS.join("|")));
                }
                if k == "stream" && el.get("path").and_then(Value::as_str).is_none() {
                    return Err(format!("{name}: a stream needs `path`, the id of a route element"));
                }
            }
            "code" => validate_code(el).map_err(|m| format!("{name}: {m}"))?,
            "connector" => {
                if s(el, "from").is_empty() || s(el, "to").is_empty() {
                    return Err(format!("{name}: a connector joins `from` and `to`, ids of earlier elements"));
                }
                if !["", "curve", "straight", "elbow"].contains(&s(el, "route")) {
                    return Err(format!("{name}: connector route is curve, straight or elbow"));
                }
            }
            "text" if s(el, "text").chars().count() > 400 && el.get("count").is_none() => {
                return Err(format!("{name}: text is limited to 400 characters"));
            }
            "group" => validate(arr(el, "children"), depth + 1, count)?,
            _ => {}
        }
    }
    Ok(())
}

fn validate_code(el: &Value) -> Result<(), String> {
    let lines = arr(el, "lines");
    if lines.is_empty() || lines.len() > 400 {
        return Err("code needs 1–400 lines".into());
    }
    let ids: Vec<&str> = lines.iter().map(|l| s(l, "id")).collect();
    if ids.iter().any(|i| i.is_empty()) || ids.iter().collect::<std::collections::HashSet<_>>().len() != ids.len() {
        return Err("every code line needs a unique id".into());
    }
    let steps = arr(el, "steps");
    if steps.is_empty() {
        return Err("code needs at least one step".into());
    }
    let mut last = -1.0;
    for st in steps {
        let at = f(st, "at", 0.0);
        if at < last {
            return Err("code steps must be in time order".into());
        }
        last = at;
        for key in ["show", "add", "remove", "focus"] {
            for id in arr(st, key) {
                if !id.as_str().is_some_and(|i| ids.contains(&i)) {
                    return Err(format!("code step names unknown line {id}"));
                }
            }
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------------- camera

/// The layer camera at one moment: the point looked at, zoom, roll, dolly depth and focus.
#[derive(Clone, Copy, Debug)]
pub struct Camera {
    pub look: (f32, f32),
    pub look0: (f32, f32),
    pub zoom: f32,
    pub rotate: f32,
    pub z: f32,
    /// Focus plane depth and aperture (0 = everything sharp).
    pub focus: (f32, f32),
    pub view: (f32, f32),
}

pub fn ease(name: &str, x: f32) -> f32 {
    match name {
        "linear" => motion::clamp01(x),
        "in" => motion::in_cubic(x),
        "out" => motion::out_quart(x),
        "spring" => motion::spring(x),
        _ => motion::in_out_cubic(x),
    }
}

impl Camera {
    pub fn at(spec: &Value, t: f32, view: (f32, f32)) -> Camera {
        let start = (f(spec, "x", view.0 / 2.0), f(spec, "y", view.1 / 2.0));
        let mut c = Camera {
            look: start,
            look0: start,
            zoom: f(spec, "zoom", 1.0),
            rotate: f(spec, "rotate", 0.0),
            z: f(spec, "z", 0.0),
            focus: (0.0, 0.0),
            view,
        };
        for key in arr(spec, "keys") {
            let at = f(key, "at", 0.0);
            if t < at {
                break;
            }
            let dur = f(key, "dur", 1.2);
            let k = if dur <= 1e-3 { 1.0 } else { ease(s(key, "ease"), (t - at) / dur) };
            let lerp = |from: f32, key_name: &str| num(key, key_name).map_or(from, |v| from + (v - from) * k);
            c.look = (lerp(c.look.0, "x"), lerp(c.look.1, "y"));
            c.zoom = lerp(c.zoom, "zoom").max(0.01);
            c.rotate = lerp(c.rotate, "rotate");
            c.z = lerp(c.z, "z");
        }
        if let Some(focus) = spec.get("focus") {
            let mut fz = f(focus, "z", 0.0);
            let mut ap = f(focus, "aperture", 0.0);
            for key in arr(focus, "keys") {
                let at = f(key, "at", 0.0);
                if t < at {
                    break;
                }
                let dur = f(key, "dur", 1.2);
                let k = if dur <= 1e-3 { 1.0 } else { ease(s(key, "ease"), (t - at) / dur) };
                fz += (f(key, "z", fz) - fz) * k;
                ap += (f(key, "aperture", ap) - ap) * k;
            }
            c.focus = (fz, ap.max(0.0));
        }
        c
    }
    #[cfg(test)]
    pub fn identity(view: (f32, f32)) -> Camera {
        Camera::at(&Value::Null, 0.0, view)
    }
    /// The view transform for an element at depth `z` (0 = picture plane, positive = farther),
    /// with its perspective scale and distance to the lens; `None` once the camera has
    /// passed it. Far layers follow pans by 1/(1+z) of the travel (parallax).
    pub fn matrix(&self, z: f32) -> Option<(Matrix, f32, f32)> {
        let dz = 1.0 + z - self.z;
        if dz < 0.12 {
            return None;
        }
        let p = (1.0 + z) / dz;
        let depth = 1.0 / (1.0 + z.max(-0.85));
        let target =
            (self.look0.0 + depth * (self.look.0 - self.look0.0), self.look0.1 + depth * (self.look.1 - self.look0.1));
        let mut m = Matrix::translate((self.view.0 / 2.0, self.view.1 / 2.0));
        m.pre_rotate(self.rotate, None);
        m.pre_scale((self.zoom * p, self.zoom * p), None);
        m.pre_translate((-target.0, -target.1));
        Some((m, p, dz))
    }
}

// ---------------------------------------------------------------------------------- scope

/// A piece of native type as drawn, in output pixels: for the frame audit.
#[derive(Clone, Debug)]
pub struct TextMark {
    pub text: String,
    pub rect: Rect,
    /// Cap/x height on screen, in pixels of a 1080-line frame.
    pub size: f32,
    pub alpha: f32,
}

pub struct Scope<'a> {
    pub palette: Palette,
    pub motion: MotionStyle,
    pub fps: f32,
    pub media: &'a mut Media,
    pub camera: Camera,
    /// Output pixels per layer unit (for decode sizes and the audit).
    pub pixel: f32,
    pub origins: HashMap<String, (f32, f32)>,
    pub routes: HashMap<String, Arc<PathInfo>>,
    pub texts: Vec<TextMark>,
    pub errors: Vec<String>,
    /// Seconds this motion-blur sample sits from the frame's own time: footage stays on the
    /// frame's decoded picture across the shutter instead of blending two source frames.
    pub sample: f32,
    /// The placement pass: positions and routes are recorded, nothing is drawn.
    pub locating: bool,
    /// Group nesting: the camera and depth apply once, at the layer's top level.
    pub depth: u32,
    /// Opacity of type: below 1 while an outgoing beat runs on under a dissolve (its words
    /// clear first; only the pictures cross), as in the block layer.
    pub words: f32,
}

impl Scope<'_> {
    fn fill(&self, v: Option<&Value>, fallback: &str) -> Fill {
        Fill::resolve(&self.palette, v, fallback)
    }
    fn color(&self, v: Option<&Value>, fallback: &str) -> Option<String> {
        match v {
            Some(Value::String(t)) => paint::token(&self.palette, t, fallback),
            _ => paint::token(&self.palette, fallback, "ink"),
        }
    }
}

#[derive(Clone, Copy)]
struct Pose {
    dx: f32,
    dy: f32,
    sx: f32,
    sy: f32,
    rotate: f32,
    alpha: f32,
    tx: f32,
    ty: f32,
}

fn keyed(el: &Value, now: f32) -> [f32; 8] {
    // x, y, scale, rotate, opacity, scaleX, scaleY, blur
    let mut p = [0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 1.0, f(el, "blur", 0.0)];
    const KEYS: [&str; 8] = ["x", "y", "scale", "rotate", "opacity", "scaleX", "scaleY", "blur"];
    for key in arr(el, "keys") {
        let start = f(key, "at", 0.0);
        if now < start {
            break;
        }
        let dur = f(key, "dur", crate::constants::get().canvas.key);
        let k = if dur <= 1e-3 { 1.0 } else { ease(s(key, "ease"), (now - start) / dur) };
        for (i, name) in KEYS.iter().enumerate() {
            if let Some(v) = num(key, name) {
                p[i] += (v - p[i]) * k;
            }
        }
    }
    p
}

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

fn measure_el(el: &Value) -> f32 {
    let size = f(el, "size", 48.0);
    let value = if el.get("count").is_some() {
        let c = &el["count"];
        crate::numbers::format_number(
            f(c, "to", 0.0) as f64,
            f(c, "decimals", 0.0) as usize,
            s(c, "prefix"),
            s(c, "suffix"),
        )
    } else if flag(el, "upper") {
        s(el, "text").to_uppercase()
    } else {
        s(el, "text").to_owned()
    };
    let w = fonts::measure(fonts::element_font(el), &value, size, f(el, "tracking", 0.0) * size);
    num(el, "fit").map_or(w, |fit| w.min(fit))
}

pub fn element_bounds(el: &Value) -> (f32, f32, f32, f32) {
    bounds(el, &measure_el)
}

/// Draw a layer's `list` at layer time `now`. Every element is placed first (twice, so an
/// element can follow one listed after it), then drawn in order: a connector can sit under
/// the actors it joins, and a label can ride an element drawn later.
pub fn draw(canvas: &Canvas, scope: &mut Scope, list: &[Value], inherited: f32, stagger: f32, now: f32) {
    let errors = scope.errors.len();
    scope.locating = true;
    for _ in 0..2 {
        draw_list(canvas, scope, list, inherited, stagger, now);
    }
    scope.locating = false;
    scope.errors.truncate(errors);
    draw_list(canvas, scope, list, inherited, stagger, now);
}

fn draw_list(canvas: &Canvas, scope: &mut Scope, list: &[Value], inherited: f32, stagger: f32, now: f32) {
    for (i, el) in list.iter().enumerate() {
        element(canvas, scope, el, inherited + i as f32 * stagger, now);
    }
}

/// A connector as a path between the current positions of two earlier elements, inset by
/// `gap` at each end: it follows them as they move, and packets can ride it by its id.
fn connector_path(scope: &Scope, el: &Value) -> Option<Value> {
    let offset = |key: &str| {
        let a = arr(el, key);
        (
            a.first().and_then(Value::as_f64).unwrap_or(0.0) as f32,
            a.get(1).and_then(Value::as_f64).unwrap_or(0.0) as f32,
        )
    };
    let (a, b) = (scope.origins.get(s(el, "from"))?, scope.origins.get(s(el, "to"))?);
    let (fo, to) = (offset("fromOffset"), offset("toOffset"));
    let (mut x1, mut y1, mut x2, mut y2) = (a.0 + fo.0, a.1 + fo.1, b.0 + to.0, b.1 + to.1);
    let len = (x2 - x1).hypot(y2 - y1).max(1e-3);
    let (ux, uy) = ((x2 - x1) / len, (y2 - y1) / len);
    let (g1, g2) = (f(el, "gapFrom", f(el, "gap", 0.0)), f(el, "gapTo", f(el, "gap", 0.0)));
    if g1 + g2 < len * 0.9 {
        x1 += ux * g1;
        y1 += uy * g1;
        x2 -= ux * g2;
        y2 -= uy * g2;
    }
    let d = match s(el, "route") {
        "straight" => format!("M {x1} {y1} L {x2} {y2}"),
        "elbow" => {
            let mx = (x1 + x2) / 2.0;
            format!("M {x1} {y1} L {mx} {y1} L {mx} {y2} L {x2} {y2}")
        }
        _ => {
            // A gentle arc: the control point sits off the midpoint by `bend` of the length.
            let bend = f(el, "bend", 0.18) * len;
            let (mx, my) = ((x1 + x2) / 2.0 - uy * bend, (y1 + y2) / 2.0 + ux * bend);
            format!("M {x1} {y1} Q {mx} {my} {x2} {y2}")
        }
    };
    let mut out = el.clone();
    let o = out.as_object_mut()?;
    o.insert("type".into(), "path".into());
    o.insert("d".into(), d.into());
    for k in ["from", "to", "route", "bend", "gap", "gapFrom", "gapTo", "fromOffset", "toOffset"] {
        o.remove(k);
    }
    Some(out)
}

/// Colour keys: `keys: [{at, fill|stroke: token, dur, ease}]` ease the paint from the colour
/// before (a state change: a component turning red, a node lighting up).
fn keyed_paint(scope: &Scope, el: &Value, now: f32) -> Option<Value> {
    let keys = arr(el, "keys");
    if !keys.iter().any(|k| k.get("fill").is_some() || k.get("stroke").is_some()) {
        return None;
    }
    let mut out = el.clone();
    for (field, fallback) in [("fill", "accent"), ("stroke", "ink")] {
        let mut color = match el.get(field) {
            Some(Value::String(t)) => paint::token(&scope.palette, t, fallback),
            None if keys.iter().any(|k| k.get(field).is_some()) => paint::token(&scope.palette, fallback, "ink"),
            _ => continue,
        };
        let mut changed = false;
        for key in keys {
            let start = f(key, "at", 0.0);
            if now < start {
                break;
            }
            let Some(target) = key.get(field).and_then(Value::as_str) else { continue };
            let dur = f(key, "dur", crate::constants::get().canvas.key);
            let k = if dur <= 1e-3 { 1.0 } else { ease(s(key, "ease"), (now - start) / dur) };
            let to = paint::token(&scope.palette, target, fallback);
            color = match (color, to) {
                (Some(a), Some(b)) => Some(design::mix(&a, &b, k)),
                (None, b) if k >= 1.0 => b,
                (a, _) => a,
            };
            changed = true;
        }
        if changed {
            out[field] = color.map_or(Value::String("none".into()), Value::String);
        }
    }
    Some(out)
}

fn element(canvas: &Canvas, scope: &mut Scope, el: &Value, default_at: f32, now: f32) {
    let now = match num(el, "fps") {
        Some(q) if q > 0.0 => (now * q).floor() / q,
        _ => now,
    };
    let joined;
    let el = if s(el, "type") == "connector" {
        match connector_path(scope, el) {
            Some(path) => {
                joined = path;
                &joined
            }
            None => {
                scope.errors.push(format!(
                    "{}: connector joins {:?} and {:?}; both must be drawn earlier in this layer",
                    s(el, "id"),
                    s(el, "from"),
                    s(el, "to")
                ));
                return;
            }
        }
    } else {
        el
    };
    let recoloured;
    let el = match keyed_paint(scope, el, now) {
        Some(v) => {
            recoloured = v;
            &recoloured
        }
        None => el,
    };
    let kind = s(el, "type");
    if kind == "path" {
        if let (Some(id), Some(info)) = (el.get("id").and_then(Value::as_str), path_info(s(el, "d"))) {
            scope.routes.insert(id.to_owned(), info);
        }
    }
    if let Some(echo) = el.get("echo").filter(|_| !scope.locating) {
        return echoed(canvas, scope, el, echo, default_at, now);
    }
    let at = f(el, "at", default_at);
    let enter = match s(el, "enter") {
        "" => match kind {
            "line" | "path" | "poly" if el.get("fill").is_none_or(|f| f == "none") => "draw",
            "text" => "rise",
            "icon" | "circle" => "pop",
            "video" | "shader" | "particles" | "code" => "fade",
            _ => "fade",
        },
        other => other,
    };
    let c = &crate::constants::get().canvas;
    let text_len = s(el, "text").chars().count() as f32;
    let default_dur = match enter {
        "draw" => c.draw,
        "type" => (text_len * c.type_per_char).clamp(c.type_min, c.type_max),
        "grow" | "grow-x" | "grow-y" | "wipe" | "wipe-up" => c.grow,
        "scramble" => c.scramble,
        "none" => 0.0,
        _ => scope.motion.duration(),
    };
    let dur = f(el, "dur", default_dur).max(0.0);
    let local = now - at;
    if local < 0.0 && !scope.locating {
        return;
    }
    let exit = s(el, "exit");
    let exit_dur = f(el, "exitDur", scope.motion.duration());
    let q = match num(el, "exitAt") {
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
    if q >= 1.0 && !scope.locating {
        return;
    }
    // Placing an element before it enters: where it will rest.
    let e = if dur <= 0.0 || local < 0.0 { Enter::DONE } else { scope.motion.enter_over(local, dur) };
    let grow = if dur <= 0.0 { 1.0 } else { scope.motion.grow(local, dur) };
    let (bx, by, bw, bh) = element_bounds(el);
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
    let mut pose = Pose {
        dx: 0.0,
        dy: 0.0,
        sx: 1.0,
        sy: 1.0,
        rotate: f(el, "rotate", 0.0),
        alpha: f(el, "opacity", 1.0),
        tx: 0.0,
        ty: 0.0,
    };
    (pose.tx, pose.ty) = keyed_tilt(el, now);
    let distance = scope.motion.distance(f(el, "dist", 48.0));
    match enter {
        "fade" | "blur" => pose.alpha *= e.alpha,
        "pop" => {
            let k = 0.55 + 0.45 * scope.motion.pop(local * scope.motion.duration() / dur.max(0.01));
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
    let key = keyed(el, now);
    pose.dx += key[0];
    pose.dy += key[1];
    pose.sx *= key[2] * key[5];
    pose.sy *= key[2] * key[6];
    pose.rotate += key[3];
    pose.alpha *= key[4].clamp(0.0, 1.0);
    // Travel along a route: inline path data, or another element's path by id.
    if let Some(route) = el.get("along") {
        let info = match route.get("path").and_then(Value::as_str) {
            Some(id) => scope.routes.get(id).cloned(),
            None => path_info(s(route, "d")),
        };
        match info {
            Some(info) => {
                if let Some(contour) = info.contours.iter().find(|c| c.len() > 1) {
                    let start = f(route, "at", at);
                    let span = f(route, "dur", c.along).max(0.001);
                    let lap = if flag(route, "loop") && now > start {
                        ((now - start) / span).fract()
                    } else {
                        (now - start) / span
                    };
                    let k = ease(if s(route, "ease").is_empty() { "inOut" } else { s(route, "ease") }, lap);
                    let k = num(route, "from").unwrap_or(0.0)
                        + (num(route, "to").unwrap_or(1.0) - num(route, "from").unwrap_or(0.0)) * k;
                    if let Some(((px, py), angle)) = along(contour, k) {
                        pose.dx += px - origin.0;
                        pose.dy += py - origin.1;
                        if flag(route, "rotate") {
                            pose.rotate += angle.to_degrees();
                        }
                    }
                }
            }
            None => scope.errors.push(format!(
                "{}: along names path {:?}, which is not an earlier path element of this layer",
                s(el, "id"),
                s(route, "path")
            )),
        }
    }
    // Attached: ride another element's current position (its origin after its own motion).
    if let Some(a) = el.get("attach") {
        match scope.origins.get(s(a, "to")) {
            Some(&(tx, ty)) => {
                pose.dx += tx + f(a, "dx", 0.0) - origin.0;
                pose.dy += ty + f(a, "dy", 0.0) - origin.1;
            }
            None => scope.errors.push(format!(
                "{}: attach names {:?}, which is not drawn earlier in this layer",
                s(el, "id"),
                s(a, "to")
            )),
        }
    }
    let mut dash_shift = 0.0;
    if let Some(l) = el.get("loop") {
        let lt = (now - at - dur).max(0.0);
        let period = f(l, "period", 4.0).max(0.05);
        let ramp = motion::in_out_cubic(lt / 0.8);
        let phase = TAU * lt / period;
        match s(l, "type") {
            "spin" => pose.rotate += 360.0 * f(l, "amount", 1.0) * lt / period,
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
            _ => {}
        }
    }
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
    if let Some(id) = el.get("id").and_then(Value::as_str) {
        scope.origins.insert(id.to_owned(), (origin.0 + pose.dx, origin.1 + pose.dy));
    }
    if scope.locating || pose.alpha <= 0.001 || q >= 1.0 || local < 0.0 {
        return;
    }
    // Depth: perspective scale and depth of field from the layer camera.
    // `camera: false` pins an element to the screen (type over a moving shot).
    let pinned = el.get("camera").and_then(Value::as_bool) == Some(false);
    let z = if scope.depth == 0 && !pinned { num(el, "z") } else { None };
    let view = if scope.depth > 0 || pinned {
        (Matrix::new_identity(), 1.0, 1.0)
    } else {
        match scope.camera.matrix(z.unwrap_or(0.0)) {
            Some(v) => v,
            None => return,
        }
    };
    let draw_on = if enter == "draw" {
        if dur <= 0.0 {
            1.0
        } else if s(el, "drawEase") == "linear" {
            motion::clamp01(local / dur)
        } else {
            motion::out_cubic(local / dur)
        }
    } else {
        1.0
    };
    let draw_on = if exit == "undraw" { draw_on * (1.0 - q) } else { draw_on };
    let mut blur = match (enter, exit) {
        ("blur", _) if e.alpha < 1.0 => 14.0 * (1.0 - e.alpha),
        (_, "blur") if q > 0.0 => 14.0 * q,
        _ => 0.0,
    };
    blur += key[7].max(0.0);
    let (fz, aperture) = scope.camera.focus;
    if let (Some(_), true, false) = (z, aperture > 0.0, kind == "text") {
        let df = (1.0 + fz - scope.camera.z).max(0.12);
        blur += (36.0 * aperture * (1.0 / view.2 - 1.0 / df).abs() / view.1.max(0.05)).min(80.0);
    }

    canvas.save();
    canvas.concat(&view.0);
    // The element's own pose about its origin.
    let (ox, oy) = origin;
    let identity = pose.dx.abs() < 1e-4
        && pose.dy.abs() < 1e-4
        && (pose.sx - 1.0).abs() < 1e-5
        && (pose.sy - 1.0).abs() < 1e-5
        && pose.rotate.abs() < 1e-4
        && pose.tx.abs() < 1e-4
        && pose.ty.abs() < 1e-4;
    if !identity {
        canvas.translate((ox + pose.dx, oy + pose.dy));
        canvas.rotate(pose.rotate, None);
        let (a, b) = (pose.tx.to_radians(), pose.ty.to_radians());
        canvas.concat(&Matrix::new_all(b.cos(), 0.0, 0.0, a.sin() * b.sin(), a.cos(), 0.0, 0.0, 0.0, 1.0));
        canvas.scale((
            if pose.sx.abs() < 1e-4 { 1e-4 } else { pose.sx },
            if pose.sy.abs() < 1e-4 { 1e-4 } else { pose.sy },
        ));
        canvas.translate((-ox, -oy));
    }
    // One layer carries opacity, blur, glow, shadow and blend so overlapping parts of the
    // element composite once (as an SVG group opacity does).
    let filter = effects_filter(scope, el, blur);
    let blend = blend_mode(s(el, "blend"));
    let layered = pose.alpha < 0.999 || filter.is_some() || blend.is_some();
    if layered {
        let mut lp = Paint::default();
        lp.set_alpha_f(pose.alpha.clamp(0.0, 1.0));
        if let Some(fl) = filter {
            lp.set_image_filter(fl);
        }
        if let Some(b) = blend {
            lp.set_blend_mode(b);
        }
        canvas.save_layer(&sk::canvas::SaveLayerRec::default().paint(&lp));
    }
    // Wipes reveal through a growing clip over the element bounds.
    let wipe = match (enter, exit) {
        ("wipe", _) if grow < 1.0 => Some((grow, false, false)),
        ("wipe-up", _) if grow < 1.0 => Some((grow, true, false)),
        (_, "wipe") if q > 0.0 => Some((1.0 - q, false, true)),
        _ => None,
    };
    let mut visible = true;
    if let Some((p, up, leaving)) = wipe {
        if p <= 0.001 {
            visible = false;
        } else {
            let pad = 8.0 + f(el, "width", 0.0);
            let r = if up {
                Rect::from_xywh(bx - pad, by - pad + (bh + 2.0 * pad) * (1.0 - p), bw + 2.0 * pad, (bh + 2.0 * pad) * p)
            } else if leaving {
                Rect::from_xywh(bx - pad + (bw + 2.0 * pad) * (1.0 - p), by - pad, (bw + 2.0 * pad) * p, bh + 2.0 * pad)
            } else {
                Rect::from_xywh(bx - pad, by - pad, (bw + 2.0 * pad) * p, bh + 2.0 * pad)
            };
            canvas.clip_rect(r, ClipOp::Intersect, true);
        }
    }
    if visible {
        let reveal = if enter == "type" { motion::clamp01(local / dur.max(0.001)) } else { 1.0 };
        let alpha = if layered { 1.0 } else { pose.alpha };
        shape(canvas, scope, el, draw_on, dash_shift, reveal, local, now, alpha);
        shine(canvas, scope, el, now, at + dur, (bx, by, bw, bh));
    }
    if layered {
        canvas.restore();
    }
    canvas.restore();
}

fn echoed(canvas: &Canvas, scope: &mut Scope, el: &Value, echo: &Value, at: f32, now: f32) {
    let count = (f(echo, "count", 6.0) as usize).clamp(1, 24);
    let lag = f(echo, "lag", 0.0).max(0.0);
    let fade = f(echo, "fade", 0.72).clamp(0.0, 1.0);
    let step = echo.get("step");
    let (sx, sy, sr, ss) = step.map_or((0.0, 0.0, 0.0, 0.0), |st| {
        (f(st, "x", 0.0), f(st, "y", 0.0), f(st, "rotate", 0.0), f(st, "scale", 0.0))
    });
    let to = echo.get("to").and_then(Value::as_str).and_then(|t| paint::token(&scope.palette, t, "accent"));
    let (bx, by, bw, bh) = element_bounds(el);
    let (ox, oy) = (bx + bw / 2.0, by + bh / 2.0);
    let mut base = el.clone();
    if let Some(o) = base.as_object_mut() {
        o.remove("echo");
    }
    for i in (1..=count).rev() {
        let mut copy = base.clone();
        let k = i as f32 / count as f32;
        if let (Some(to), Some(o)) = (&to, copy.as_object_mut()) {
            for key in ["fill", "stroke"] {
                if let Some(Value::String(c)) = o.get(key) {
                    if let Some(from) = paint::token(&scope.palette, c, "accent") {
                        o.insert(key.into(), Value::String(design::mix(&from, to, k)));
                    }
                }
            }
        }
        if let Some(o) = copy.as_object_mut() {
            o.insert("opacity".into(), serde_json::json!(f(el, "opacity", 1.0) * fade.powi(i as i32)));
            o.remove("id");
        }
        let fi = i as f32;
        canvas.save();
        if sx.abs() + sy.abs() + sr.abs() + ss.abs() > 1e-6 {
            canvas.translate((sx * fi + ox, sy * fi + oy));
            canvas.rotate(sr * fi, None);
            canvas.scale(((1.0 + ss * fi).max(0.01), (1.0 + ss * fi).max(0.01)));
            canvas.translate((-ox, -oy));
        }
        element(canvas, scope, &copy, at, now - lag * fi);
        canvas.restore();
    }
    element(canvas, scope, &base, at, now);
}

fn blend_mode(name: &str) -> Option<BlendMode> {
    Some(match name {
        "multiply" => BlendMode::Multiply,
        "screen" => BlendMode::Screen,
        "overlay" => BlendMode::Overlay,
        "lighten" => BlendMode::Lighten,
        "darken" => BlendMode::Darken,
        "color-dodge" => BlendMode::ColorDodge,
        "soft-light" => BlendMode::SoftLight,
        "difference" => BlendMode::Difference,
        "plus" | "add" => BlendMode::Plus,
        _ => return None,
    })
}

/// Blur, glow (light bleeding outward, optionally tinted) and drop shadow as one image filter.
fn effects_filter(scope: &Scope, el: &Value, blur: f32) -> Option<sk::ImageFilter> {
    let on = |key: &str| el.get(key).filter(|v| v.as_bool() == Some(true) || v.is_object());
    let neon = el.get("material").is_some_and(|m| m.as_str() == Some("neon") || s(m, "name") == "neon");
    let (shadow, glow) = (on("shadow"), on("glow"));
    let mut filter: Option<sk::ImageFilter> = None;
    if blur > 0.05 {
        filter = image_filters::blur((blur, blur), TileMode::Decal, None, None);
    }
    let opt = |v: Option<&Value>, key: &str, d: f32| {
        v.and_then(|v| v.get(key)).and_then(Value::as_f64).map_or(d, |x| x as f32)
    };
    if let Some(sh) = shadow {
        let color = scope.color(sh.get("color"), "#000000").unwrap_or_else(|| "#000000".into());
        filter = image_filters::drop_shadow(
            (opt(Some(sh), "dx", 0.0), opt(Some(sh), "dy", 8.0)),
            (opt(Some(sh), "blur", 12.0).max(0.0), opt(Some(sh), "blur", 12.0).max(0.0)),
            paint::hex(&color, opt(Some(sh), "opacity", 0.45)),
            None,
            filter,
            None,
        );
    }
    if glow.is_some() || neon {
        let g = glow;
        let radius = opt(g, "blur", if neon { 18.0 } else { 14.0 }).max(0.0);
        let alpha = (opt(g, "opacity", 0.85).clamp(0.0, 1.0) * 1.6).min(1.0);
        let source = filter.clone();
        let soft = match g.and_then(|g| g.get("color")) {
            Some(c) => {
                let tint = scope.color(Some(c), "accent").unwrap_or_else(|| scope.palette.accent.clone());
                let [r, gr, b] = design::parse(&tint).unwrap_or([1.0, 1.0, 1.0]);
                // Alpha of the source, coloured with the tint.
                let m =
                    [0.0, 0.0, 0.0, 0.0, r, 0.0, 0.0, 0.0, 0.0, gr, 0.0, 0.0, 0.0, 0.0, b, 0.0, 0.0, 0.0, alpha, 0.0];
                image_filters::color_filter(
                    color_filters::matrix_row_major(&m, None),
                    image_filters::blur((radius, radius), TileMode::Decal, source.clone(), None),
                    None,
                )
            }
            None => {
                let m = [
                    1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, alpha,
                    0.0,
                ];
                image_filters::color_filter(
                    color_filters::matrix_row_major(&m, None),
                    image_filters::blur((radius, radius), TileMode::Decal, source.clone(), None),
                    None,
                )
            }
        };
        filter = image_filters::merge([soft, source], None);
    }
    filter
}

fn stroke_paint(
    color: &Fill,
    width: f32,
    cap: &str,
    join: &str,
    bounds: (f32, f32, f32, f32),
    alpha: f32,
) -> Option<Paint> {
    let mut p = Paint::default();
    p.set_anti_alias(true);
    if !color.apply(&mut p, bounds, alpha) {
        return None;
    }
    p.set_style(PaintStyle::Stroke);
    p.set_stroke_width(width);
    p.set_stroke_cap(match cap {
        "butt" => PaintCap::Butt,
        "square" => PaintCap::Square,
        _ => PaintCap::Round,
    });
    p.set_stroke_join(match join {
        "miter" => PaintJoin::Miter,
        "bevel" => PaintJoin::Bevel,
        _ => PaintJoin::Round,
    });
    Some(p)
}

fn material_params(
    scope: &Scope,
    el: &Value,
    base: Option<&str>,
    bounds: (f32, f32, f32, f32),
    now: f32,
) -> Option<(String, materials::Params)> {
    let m = el.get("material")?;
    let name = m.as_str().or_else(|| m.get("name").and_then(Value::as_str))?.to_owned();
    let token = |i: usize, fallback: &str| -> [f32; 4] {
        let c = m
            .get("colors")
            .and_then(Value::as_array)
            .and_then(|a| a.get(i))
            .and_then(Value::as_str)
            .and_then(|t| paint::token(&scope.palette, t, fallback))
            .or_else(|| if i == 0 { base.map(str::to_owned) } else { None })
            .or_else(|| paint::token(&scope.palette, fallback, "ink"))
            .unwrap_or_else(|| "#ffffff".into());
        let [r, g, b] = design::parse(&c).unwrap_or([1.0, 1.0, 1.0]);
        [r, g, b, 1.0]
    };
    let params = materials::Params {
        bounds,
        time: now * f(m, "speed", 1.0),
        seed: f(m, "seed", 1.0),
        scale: f(m, "scale", 1.0),
        amount: f(m, "amount", 0.8).clamp(0.0, 1.0),
        colors: [token(0, "accent"), token(1, "accent2"), token(2, if scope.palette.dark { "ink" } else { "surface" })],
    };
    Some((name, params))
}

#[allow(clippy::too_many_arguments)]
fn shape(
    canvas: &Canvas,
    scope: &mut Scope,
    el: &Value,
    draw: f32,
    dash_shift: f32,
    reveal: f32,
    local: f32,
    now: f32,
    alpha: f32,
) {
    let kind = s(el, "type");
    let filled_default = if matches!(kind, "line" | "path" | "poly") { "none" } else { "accent" };
    let mut fill = scope.fill(el.get("fill"), filled_default);
    let filled = el.get("fill").is_some_and(|v| v != "none");
    let outlined = kind == "line" || (matches!(kind, "path" | "poly") && !filled);
    let has_stroke = el.get("stroke").is_some();
    let stroke = scope.fill(el.get("stroke"), if outlined { "ink" } else { "none" });
    let width = f(el, "width", if matches!(kind, "line" | "path" | "poly") { 6.0 } else { 4.0 });
    let bounds = element_bounds(el);
    let length = stroke_length(el);
    let drawing = draw < 0.999 && length > 0.0 && (!stroke.is_none() || matches!(kind, "line" | "path" | "poly"));
    let fill_alpha = if draw < 0.999 && !fill.is_none() { motion::clamp01((draw - 0.55) / 0.45) } else { 1.0 };
    let dash: Vec<f32> = arr(el, "dash").iter().filter_map(Value::as_f64).map(|v| v.max(0.0) as f32).collect();
    let dash_effect = if drawing {
        dash_path_effect::new(&[length.max(0.001), length * 2.0 + 10.0], length * (1.0 - draw))
    } else if dash.len() >= 2 && dash.iter().sum::<f32>() > 0.0 {
        let period: f32 = dash.iter().sum();
        dash_path_effect::new(&dash, dash_shift * period)
    } else {
        None
    };
    let cap = if s(el, "cap").is_empty() { "round" } else { s(el, "cap") };
    let join = if s(el, "join").is_empty() { "round" } else { s(el, "join") };
    let neon = el.get("material").is_some_and(|m| m.as_str() == Some("neon") || s(m, "name") == "neon");
    let material = if neon { None } else { material_params(scope, el, fill.first(), bounds, now) };
    let mut fill_paint = Paint::default();
    fill_paint.set_anti_alias(true);
    let has_fill = if let Some((name, params)) = &material {
        match materials::shader(name, params) {
            Some(sh) => {
                fill_paint.set_shader(sh);
                fill_paint.set_alpha_f(alpha * fill_alpha);
                if fill.is_none() {
                    fill = Fill::Solid("#ffffff".into());
                }
                true
            }
            None => fill.apply(&mut fill_paint, bounds, alpha * fill_alpha),
        }
    } else {
        fill.apply(&mut fill_paint, bounds, alpha * fill_alpha)
    };
    let stroke_color = if has_stroke { stroke.clone() } else { fill.clone() };
    let mut stroke_p =
        if !stroke.is_none() || drawing { stroke_paint(&stroke_color, width, cap, join, bounds, alpha) } else { None };
    if let (Some(p), Some(effect)) = (stroke_p.as_mut(), dash_effect) {
        p.set_path_effect(effect);
    }
    match kind {
        "rect" => {
            let r = f(el, "r", 0.0);
            let rect =
                Rect::from_xywh(f(el, "x", 0.0), f(el, "y", 0.0), f(el, "w", 0.0).max(0.0), f(el, "h", 0.0).max(0.0));
            let rr = RRect::new_rect_xy(rect, r, r);
            if has_fill {
                canvas.draw_rrect(rr, &fill_paint);
            }
            if let Some(p) = &stroke_p {
                canvas.draw_rrect(rr, p);
            }
        }
        "circle" | "ellipse" => {
            let (cx, cy) = (f(el, "cx", 0.0), f(el, "cy", 0.0));
            let (rx, ry) = if kind == "circle" {
                (f(el, "r", 0.0), f(el, "r", 0.0))
            } else {
                (f(el, "rx", 0.0), f(el, "ry", 0.0))
            };
            let oval = Rect::from_xywh(cx - rx.max(0.0), cy - ry.max(0.0), 2.0 * rx.max(0.0), 2.0 * ry.max(0.0));
            if has_fill {
                canvas.draw_oval(oval, &fill_paint);
            }
            if let Some(p) = &stroke_p {
                canvas.draw_oval(oval, p);
            }
        }
        "line" | "path" | "poly" => {
            let path = match kind {
                "line" => {
                    let mut p = sk::PathBuilder::new();
                    p.move_to((f(el, "x1", 0.0), f(el, "y1", 0.0)));
                    p.line_to((f(el, "x2", 0.0), f(el, "y2", 0.0)));
                    p.detach()
                }
                "poly" => {
                    let pts = points(el);
                    let mut p = sk::PathBuilder::new();
                    for (i, (x, y)) in pts.iter().enumerate() {
                        if i == 0 {
                            p.move_to((*x, *y));
                        } else {
                            p.line_to((*x, *y));
                        }
                    }
                    if flag(el, "closed") {
                        p.close();
                    }
                    p.detach()
                }
                _ => path_info(s(el, "d")).map(|p| p.path.clone()).unwrap_or_default(),
            };
            if has_fill && !fill.is_none() {
                canvas.draw_path(&path, &fill_paint);
            }
            if let Some(p) = &stroke_p {
                canvas.draw_path(&path, p);
                let heads = s(el, "arrow");
                let line = outline(el);
                let head = f(el, "head", width * 3.2 + 6.0);
                let mut tips = vec![];
                if (heads == "end" || heads == "both") && draw > 0.02 {
                    tips.push(along(&line, draw));
                }
                if (heads == "start" || heads == "both") && draw > 0.02 {
                    let reversed: Vec<_> = line.iter().rev().copied().collect();
                    tips.push(along(&reversed, 1.0));
                }
                if let Some(mut hp) = stroke_paint(&stroke_color, width, "round", "round", bounds, alpha) {
                    hp.set_path_effect(None);
                    for ((x, y), angle) in tips.into_iter().flatten() {
                        canvas.draw_path(&arrowhead(x, y, angle, head), &hp);
                    }
                }
            }
        }
        "text" => text_element(canvas, scope, el, &fill, reveal, local, alpha, material.as_ref()),
        "icon" => {
            let size = f(el, "size", 64.0);
            let color = scope.fill(el.get("stroke").or(el.get("fill")), "accent");
            if let (Some(paths), Some(mut p)) =
                (crate::icons::paths(s(el, "name")), stroke_paint(&color, 2.0, "round", "round", bounds, alpha))
            {
                canvas.save();
                canvas.translate((f(el, "x", 0.0) - size / 2.0, f(el, "y", 0.0) - size / 2.0));
                canvas.scale((size / 24.0, size / 24.0));
                p.set_stroke_width(2.0);
                for d in paths {
                    if let Some(info) = path_info(d) {
                        canvas.draw_path(&info.path, &p);
                    }
                }
                canvas.restore();
            }
        }
        "image" => match scope.media.image(s(el, "file")) {
            Ok(image) => picture(canvas, scope, el, &image, alpha),
            Err(e) => scope.errors.push(e),
        },
        "video" => footage(canvas, scope, el, local, alpha),
        "shader" => {
            let r = f(el, "r", 0.0);
            let rect =
                Rect::from_xywh(f(el, "x", 0.0), f(el, "y", 0.0), f(el, "w", 0.0).max(0.0), f(el, "h", 0.0).max(0.0));
            if has_fill {
                canvas.draw_rrect(RRect::new_rect_xy(rect, r, r), &fill_paint);
            }
        }
        "particles" => particles(canvas, scope, el, &fill, now, alpha),
        "spotlight" => {
            let (x, y, w, h) = bounds;
            let mut p = sk::PathBuilder::new_with_fill_type(sk::PathFillType::EvenOdd);
            p.add_rect(Rect::from_ltrb(-20000.0, -20000.0, 20000.0, 20000.0), None, None);
            if el.get("cx").is_some() {
                p.add_circle((f(el, "cx", 0.0), f(el, "cy", 0.0)), f(el, "r", f(el, "radius", 24.0)), None);
            } else {
                p.add_rrect(
                    RRect::new_rect_xy(Rect::from_xywh(x, y, w, h), f(el, "radius", 24.0), f(el, "radius", 24.0)),
                    None,
                    None,
                );
            }
            let p = p.detach();
            let color = scope.fill(el.get("fill"), "bg");
            let mut sp = Paint::default();
            sp.set_anti_alias(true);
            if color.apply(&mut sp, bounds, alpha * f(el, "dim", 0.72)) {
                canvas.draw_path(&p, &sp);
            }
        }
        "code" => code(canvas, scope, el, now, alpha),
        "group" => {
            let at = f(el, "at", 0.0);
            let now = now + f(el, "shift", 0.0);
            let (x, y) = (f(el, "x", 0.0), f(el, "y", 0.0));
            canvas.save();
            canvas.translate((x, y));
            if alpha < 0.999 {
                canvas.save_layer_alpha_f(None, alpha);
            }
            let children = arr(el, "children");
            scope.depth += 1;
            draw_list(canvas, scope, children, at, f(el, "stagger", 0.0), now);
            scope.depth -= 1;
            if alpha < 0.999 {
                canvas.restore();
            }
            canvas.restore();
        }
        _ => {}
    }
}

/// A light sweep across the element (`shine`): a soft band, masked to the element itself.
fn shine(canvas: &Canvas, scope: &Scope, el: &Value, now: f32, settled: f32, (bx, by, bw, bh): (f32, f32, f32, f32)) {
    let Some(sh) = el.get("shine").filter(|v| v.is_object() || v.as_bool() == Some(true)) else { return };
    let span = f(sh, "dur", 1.1).max(0.05);
    let mut u = now - f(sh, "at", settled);
    if let Some(every) = num(sh, "every").filter(|_| u > 0.0) {
        u %= every.max(span);
    }
    let progress = u / span;
    if !(0.0..1.0).contains(&progress) {
        return;
    }
    let q = motion::in_out_cubic(progress);
    let pad = 8.0 + f(el, "width", 0.0);
    let (x0, y0, w0, h0) = (bx - pad, by - pad, bw + 2.0 * pad, bh + 2.0 * pad);
    let band = (w0 * f(sh, "width", 0.35)).max(8.0);
    let angle = f(sh, "angle", 20.0);
    let lean = h0 * angle.to_radians().tan().abs();
    let cx = x0 - band - lean + (w0 + 2.0 * band + 2.0 * lean) * q;
    let cy = y0 + h0 / 2.0;
    let color = scope.color(sh.get("color"), "#ffffff").unwrap_or_else(|| "#ffffff".into());
    let a = f(sh, "opacity", 0.85).clamp(0.0, 1.0);
    let colors = [
        paint::color(paint::hex(&color, 0.0)),
        paint::color(paint::hex(&color, a)),
        paint::color(paint::hex(&color, 0.0)),
    ];
    let mut local = Matrix::new_identity();
    local.set_rotate(angle, Some(Point::new(cx, cy)));
    let shader = sk::gradient_shader::linear(
        (Point::new(cx - band / 2.0, cy), Point::new(cx + band / 2.0, cy)),
        colors.as_slice(),
        None,
        TileMode::Clamp,
        None,
        Some(&local),
    );
    let mut p = Paint::default();
    p.set_shader(shader);
    // Source-atop: only where the element already drew.
    p.set_blend_mode(BlendMode::SrcATop);
    canvas.draw_rect(Rect::from_xywh(x0, y0, w0, h0), &p);
}

#[allow(clippy::too_many_arguments)]
fn text_element(
    canvas: &Canvas,
    scope: &mut Scope,
    el: &Value,
    fill: &Fill,
    reveal: f32,
    local: f32,
    alpha: f32,
    material: Option<&(String, materials::Params)>,
) {
    let alpha = alpha * scope.words;
    if alpha <= 0.001 {
        return;
    }
    let font = fonts::element_font(el);
    let mut size = f(el, "size", 48.0).max(0.2);
    let mut tracking = f(el, "tracking", 0.0) * size;
    let mut value = s(el, "text").to_owned();
    if let Some(count) = el.get("count") {
        let (from, to) = (f(count, "from", 0.0) as f64, f(count, "to", 0.0) as f64);
        let decimals = f(count, "decimals", 0.0) as usize;
        let g = scope.motion.grow(local, f(count, "dur", crate::constants::get().canvas.count));
        value = crate::numbers::format_number(
            from + (to - from) * g as f64,
            decimals,
            s(count, "prefix"),
            s(count, "suffix"),
        );
    }
    if flag(el, "upper") {
        value = value.to_uppercase();
    }
    if reveal < 1.0 {
        let chars = value.chars().count();
        value = value.chars().take((chars as f32 * reveal).ceil() as usize).collect();
    }
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
                    let h = (i as u64).wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ tick.wrapping_mul(0xC2B2_AE3D_27D4_EB4F);
                    pool[(h >> 33) as usize % pool.len()]
                }
            })
            .collect();
    }
    let (x, y) = (f(el, "x", 0.0), f(el, "y", 0.0));
    let anchor = s(el, "anchor");
    let mut p = Paint::default();
    p.set_anti_alias(true);
    let b = element_bounds(el);
    let painted = match material.and_then(|(n, prm)| materials::shader(n, prm)) {
        Some(sh) => {
            p.set_shader(sh);
            p.set_alpha_f(alpha);
            true
        }
        None => fill.apply(&mut p, b, alpha),
    };
    if !painted {
        return;
    }
    let mut runs: Vec<(String, f32, f32, f32)> = vec![]; // text, left, baseline, width
    if let Some(width) = num(el, "width") {
        let style = Style {
            font,
            size,
            leading: f(el, "leading", 1.15),
            tracking: f(el, "tracking", 0.0),
            upper: false,
            balance: true,
        };
        let max_h = f(el, "height", size * 8.0).max(size);
        let layout = match text::fit(&value, style, width.max(1.0), max_h) {
            Ok(l) => l,
            Err(o) => {
                scope.errors.push(format!(
                    "Text overflow in native element {:?}: \"{}\" needs {:.0}×{:.0} at {:.0}px in {:.0}×{:.0}. Shorten or reflow it.",
                    s(el, "id"),
                    value,
                    o.width,
                    o.height,
                    o.size,
                    width,
                    max_h
                ));
                return;
            }
        };
        for (i, line) in layout.lines.iter().enumerate() {
            let left = match anchor {
                "middle" => x - line.width / 2.0,
                "end" => x - line.width,
                _ => x,
            };
            runs.push((line.text.clone(), left, y + i as f32 * layout.line_height, line.width));
        }
        size = layout.size;
        tracking = layout.tracking_px;
    } else {
        if let Some(fit) = num(el, "fit") {
            let full = if flag(el, "upper") { s(el, "text").to_uppercase() } else { s(el, "text").to_owned() };
            let natural = fonts::measure(font, &full, size, tracking);
            if natural > fit && natural > 0.0 {
                size *= fit / natural;
                tracking *= fit / natural;
            }
        }
        let w = fonts::measure(font, &value, size, tracking);
        let final_w = match el.get("count") {
            Some(c) => fonts::measure(
                font,
                &crate::numbers::format_number(
                    f(c, "to", 0.0) as f64,
                    f(c, "decimals", 0.0) as usize,
                    s(c, "prefix"),
                    s(c, "suffix"),
                ),
                size,
                tracking,
            )
            .max(w),
            None => w,
        };
        let left = match anchor {
            "middle" => x - final_w / 2.0 + (final_w - w) / 2.0,
            "end" => x - w,
            _ => x,
        };
        runs.push((value, left, y, w));
    }
    let m = canvas.local_to_device_as_3x3();
    for (line, left, baseline, w) in runs {
        fonts::draw_run(canvas, &line, left, baseline, font, size, tracking, &p);
        if !line.trim().is_empty() {
            let r = m.map_rect(Rect::from_xywh(left, baseline - size * 0.74, w, size * 0.98)).0;
            let scale = (m.scale_x().powi(2) + m.skew_y().powi(2)).sqrt();
            scope.texts.push(TextMark { text: line, rect: r, size: size * scale / scope.pixel, alpha });
        }
    }
}

/// Picture placement: cover (default) or contain inside x, y, w, h, rounded by `r`.
fn place(iw: f32, ih: f32, x: f32, y: f32, w: f32, h: f32, contain: bool, focus: (f32, f32)) -> (Rect, Rect) {
    let k = if contain { (w / iw).min(h / ih) } else { (w / iw).max(h / ih) };
    let (dw, dh) = (iw * k, ih * k);
    let dst = Rect::from_xywh(x + (w - dw) * focus.0, y + (h - dh) * focus.1, dw, dh);
    (Rect::from_wh(iw, ih), dst)
}

fn treatment_filter(scope: &Scope, name: &str) -> Option<sk::ColorFilter> {
    let p = &scope.palette;
    let rgb = |hex: &str| design::parse(hex).unwrap_or([0.0, 0.0, 0.0]);
    let (lr, lg, lb) = (0.2126, 0.7152, 0.0722);
    match name {
        "mono" => Some(color_filters::matrix_row_major(
            &[lr, lg, lb, 0.0, 0.0, lr, lg, lb, 0.0, 0.0, lr, lg, lb, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0],
            None,
        )),
        "duotone" | "tint" => {
            // Luminance mapped from the palette's darkest colour to its accent (tint keeps more photo).
            let dark = if p.dark { rgb(&p.bg) } else { rgb(&p.ink) };
            let light = if name == "tint" { rgb(&p.surface) } else { rgb(&p.accent) };
            let row = |i: usize| {
                [(light[i] - dark[i]) * lr, (light[i] - dark[i]) * lg, (light[i] - dark[i]) * lb, 0.0, dark[i]]
            };
            let (r, g, b) = (row(0), row(1), row(2));
            Some(color_filters::matrix_row_major(
                &[
                    r[0], r[1], r[2], r[3], r[4], g[0], g[1], g[2], g[3], g[4], b[0], b[1], b[2], b[3], b[4], 0.0, 0.0,
                    0.0, 1.0, 0.0,
                ],
                None,
            ))
        }
        _ => None,
    }
}

fn picture(canvas: &Canvas, scope: &Scope, el: &Value, image: &sk::Image, alpha: f32) {
    let (x, y, w, h) = (f(el, "x", 0.0), f(el, "y", 0.0), f(el, "w", 0.0).max(1.0), f(el, "h", 0.0).max(1.0));
    let focus = (f(el, "focusX", 0.5).clamp(0.0, 1.0), f(el, "focusY", 0.5).clamp(0.0, 1.0));
    let (src, dst) = place(image.width() as f32, image.height() as f32, x, y, w, h, s(el, "fit") == "contain", focus);
    let r = f(el, "r", 0.0);
    canvas.save();
    canvas.clip_rrect(RRect::new_rect_xy(Rect::from_xywh(x, y, w, h), r, r), ClipOp::Intersect, true);
    let mut p = Paint::default();
    p.set_alpha_f(alpha);
    if let Some(cf) = treatment_filter(scope, s(el, "treatment")) {
        p.set_color_filter(cf);
    }
    canvas.draw_image_rect_with_sampling_options(
        image,
        Some((&src, sk::canvas::SrcRectConstraint::Fast)),
        dst,
        SamplingOptions::new(sk::FilterMode::Linear, sk::MipmapMode::Linear),
        &p,
    );
    if s(el, "treatment") == "blur" || s(el, "treatment") == "soft" {
        // Soft plates sit behind type: a light veil in the background colour.
        let mut veil = Paint::default();
        veil.set_color4f(paint::hex(&scope.palette.bg, if s(el, "treatment") == "blur" { 0.35 } else { 0.18 }), None);
        canvas.draw_rect(Rect::from_xywh(x, y, w, h), &veil);
    }
    canvas.restore();
}

/// Footage: source seconds = `offset` + (layer time − `at`) × `rate`. Past the clip's end the
/// frame is an error unless the author asked to `hold` the last frame.
fn footage(canvas: &Canvas, scope: &mut Scope, el: &Value, local: f32, alpha: f32) {
    let key = s(el, "file");
    let seconds = f(el, "offset", 0.0) + (local - scope.sample) * f(el, "rate", 1.0);
    let (w, h) = (f(el, "w", 0.0), f(el, "h", 0.0));
    let px = scope.pixel * scope.camera.zoom.max(1.0);
    let frame = scope.media.frame(key, seconds, (w * px) as u32, (h * px) as u32);
    let image = match frame {
        Ok(Some(i)) => Some(i),
        Ok(None) if flag(el, "hold") => {
            let last = num(el, "duration").map(|d| d - 1.0 / scope.fps).unwrap_or(seconds - 1.0 / scope.fps);
            scope.media.frame(key, last.max(0.0), (w * px) as u32, (h * px) as u32).ok().flatten()
        }
        Ok(None) => {
            scope.errors.push(format!(
                "footage {key} ends before {seconds:.2} s; trim the shot or use a longer clip (footage does not loop or freeze unless `hold` is set)"
            ));
            None
        }
        Err(e) => {
            scope.errors.push(e);
            None
        }
    };
    if let Some(image) = image {
        picture(canvas, scope, el, &image, alpha);
    }
}

fn particles(canvas: &Canvas, scope: &mut Scope, el: &Value, fill: &Fill, now: f32, alpha: f32) {
    let (x, y, w, h) = (f(el, "x", 0.0), f(el, "y", 0.0), f(el, "w", 0.0).max(1.0), f(el, "h", 0.0).max(1.0));
    let count = (f(el, "count", 40.0) as usize).clamp(1, MAX_PARTICLES as usize);
    let kind = if s(el, "kind").is_empty() { "dust" } else { s(el, "kind") };
    let seed = f(el, "seed", 1.0) as u64;
    let unit = |i: usize, k: u64| noise(seed, i as u64 * 8 + k) * 0.5 + 0.5;
    let color = fill.first().unwrap_or("#ffffff").to_owned();
    let t = (now - f(el, "at", 0.0)).max(0.0) * f(el, "speed", 1.0);
    // Points are batched by quantized opacity: thousands of particles cost a handful of draws.
    let mut bins: Vec<Vec<(Point, f32)>> = vec![vec![]; 8];
    let mut push = |p: Point, r: f32, a: f32| {
        let a = (a * alpha).clamp(0.0, 1.0);
        if a > 0.02 {
            bins[((a * 7.99) as usize).min(7)].push((p, r));
        }
    };
    match kind {
        "burst" => {
            // Seeded emitter: each particle leaves the centre at its own angle and speed,
            // slows with drag, falls with gravity and fades over its life.
            let (cx, cy) = (f(el, "cx", x + w / 2.0), f(el, "cy", y + h / 2.0));
            let life = f(el, "life", 1.6).max(0.05);
            let spread = f(el, "spread", 360.0).to_radians();
            let heading = f(el, "angle", -90.0).to_radians();
            let speed = f(el, "velocity", 520.0);
            let gravity = f(el, "gravity", 380.0);
            let base = f(el, "size", 4.0);
            let window = f(el, "emit", 0.12).max(0.0);
            for i in 0..count {
                let born = window * unit(i, 6);
                let age = t - born;
                if age < 0.0 || age > life {
                    continue;
                }
                let a = heading + (unit(i, 0) - 0.5) * spread;
                let v = speed * (0.35 + 0.65 * unit(i, 1));
                let drag = (1.0 - (-2.2 * age).exp()) / 2.2;
                let px = cx + a.cos() * v * drag;
                let py = cy + a.sin() * v * drag + 0.5 * gravity * age * age;
                let fade = 1.0 - motion::in_cubic(age / life);
                push(Point::new(px, py), base * (0.5 + unit(i, 4)), fade);
            }
        }
        "stream" => {
            // Particles flowing along a route element: a current, traffic, a signal.
            let Some(info) = el.get("path").and_then(Value::as_str).and_then(|id| scope.routes.get(id).cloned()) else {
                scope.errors.push(format!(
                    "{}: stream path {:?} is not an earlier path element",
                    s(el, "id"),
                    s(el, "path")
                ));
                return;
            };
            let Some(contour) = info.contours.iter().find(|c| c.len() > 1) else { return };
            let laps = f(el, "rate", 0.35);
            let jitter = f(el, "jitter", 6.0);
            let base = f(el, "size", 4.0);
            for i in 0..count {
                let u = (unit(i, 0) + t * laps * (0.7 + 0.6 * unit(i, 1))).fract();
                if let Some(((px, py), ang)) = along(contour, u) {
                    let off = (unit(i, 2) - 0.5) * 2.0 * jitter;
                    let edge = (u / 0.06).min((1.0 - u) / 0.06).min(1.0);
                    push(
                        Point::new(px - ang.sin() * off, py + ang.cos() * off),
                        base * (0.5 + unit(i, 4)),
                        edge * (0.5 + 0.5 * unit(i, 5)),
                    );
                }
            }
        }
        "field" => {
            // A drifting field steered by smooth noise: dust in light, data in a cloud.
            let base = f(el, "size", 3.0);
            let flow = f(el, "flow", 40.0);
            for i in 0..count {
                let (u, v) = (unit(i, 0), unit(i, 1));
                let ph = unit(i, 3) * TAU;
                let px =
                    x + (u * w + flow * (t * 0.31 + ph).sin() + 0.6 * flow * (t * 0.17 + v * 6.0).cos()).rem_euclid(w);
                let py = y + (v * h + flow * (t * 0.23 + ph * 1.7).cos() + 12.0 * t * (unit(i, 2) - 0.5)).rem_euclid(h);
                let edge =
                    ((px - x).min(x + w - px) / (w * 0.06)).min((py - y).min(y + h - py) / (h * 0.08)).clamp(0.0, 1.0);
                push(Point::new(px, py), base * (0.5 + unit(i, 4)), edge * (0.35 + 0.65 * unit(i, 5)));
            }
        }
        "stars" => {
            let base = f(el, "size", 2.5);
            for i in 0..count {
                let tw = 0.55 + 0.45 * (t * (0.8 + 2.0 * unit(i, 2)) + unit(i, 3) * TAU).sin();
                push(Point::new(x + unit(i, 0) * w, y + unit(i, 1) * h), base * (0.4 + unit(i, 4)), tw);
            }
        }
        _ => {
            let (vx, vy, sway, base) = match kind {
                "embers" => (0.0, -70.0, 16.0, 5.0),
                "rain" => (-140.0, 1000.0, 0.0, 3.0),
                "snow" => (0.0, 60.0, 22.0, 6.0),
                "bubbles" => (0.0, -55.0, 10.0, 10.0),
                _ => (6.0, -10.0, 26.0, 4.0),
            };
            let size = f(el, "size", base).max(0.5);
            for i in 0..count {
                let v = 0.6 + 0.8 * unit(i, 2);
                let phase = unit(i, 3) * TAU;
                let px = x + (unit(i, 0) * w + vx * v * t + sway * (t * 0.7 * v + phase).sin()).rem_euclid(w);
                let py = y + (unit(i, 1) * h + vy * v * t).rem_euclid(h);
                let edge = ((px - x).min(x + w - px) / (w * 0.08)).min((py - y).min(y + h - py) / (h * 0.12));
                let flicker = if kind == "embers" {
                    0.45 + 0.55 * (t * 5.0 * v + phase).sin().abs()
                } else {
                    0.35 + 0.65 * unit(i, 5)
                };
                push(Point::new(px, py), size * (0.5 + unit(i, 4)), motion::clamp01(edge) * flicker);
            }
        }
    }
    let rain = kind == "rain";
    let bubbles = kind == "bubbles";
    for (b, list) in bins.iter().enumerate() {
        if list.is_empty() {
            continue;
        }
        let a = (b as f32 + 0.5) / 8.0;
        let mut p = Paint::default();
        p.set_anti_alias(true);
        p.set_color4f(paint::hex(&color, a), None);
        if rain {
            p.set_style(PaintStyle::Stroke);
            p.set_stroke_cap(PaintCap::Round);
            for (pt, r) in list {
                p.set_stroke_width(r * 0.5);
                canvas.draw_line(*pt, Point::new(pt.x + 140.0 * 0.035, pt.y - 1000.0 * 0.035), &p);
            }
        } else if bubbles {
            p.set_style(PaintStyle::Stroke);
            for (pt, r) in list {
                p.set_stroke_width((r * 0.18).max(1.0));
                canvas.draw_circle(*pt, *r, &p);
            }
        } else {
            for (pt, r) in list {
                canvas.draw_circle(*pt, *r, &p);
            }
        }
    }
}

/// An editor whose lines keep their identity: lines move to their new rows, insertions open
/// room and fade in on a positive wash, removals fade on a negative wash and close up, and
/// focused lines carry an accent bar while the rest recede.
fn code(canvas: &Canvas, scope: &mut Scope, el: &Value, now: f32, alpha: f32) {
    let p = scope.palette.clone();
    let (x, y, w) = (f(el, "x", 0.0), f(el, "y", 0.0), f(el, "w", 900.0));
    let size = f(el, "size", 28.0);
    let lh = size * f(el, "leading", 1.5);
    let lines = arr(el, "lines");
    let steps = arr(el, "steps");
    let dur = f(el, "dur", 0.7).max(0.01);
    let idx = steps.iter().rposition(|st| f(st, "at", 0.0) <= now).unwrap_or(0);
    let cur = &steps[idx];
    let prev = if idx > 0 { &steps[idx - 1] } else { cur };
    let q = if idx > 0 { motion::in_out_cubic((now - f(cur, "at", 0.0)) / dur) } else { 1.0 };
    let ids = |st: &Value, key: &str| -> Vec<String> {
        arr(st, key).iter().filter_map(Value::as_str).map(str::to_owned).collect()
    };
    let shown_now = ids(cur, "show");
    let shown_before = ids(prev, "show");
    let added = ids(cur, "add");
    let removed = ids(cur, "remove");
    let focus = ids(cur, "focus");
    let since = now - f(cur, "at", 0.0);
    let rows_now = shown_now.len() as f32;
    let rows_before = shown_before.len() as f32;
    let rows = rows_before + (rows_now - rows_before) * q;
    let title = s(el, "title");
    let head = if title.is_empty() { 0.0 } else { size * 1.9 };
    let pad = size * 0.9;
    let height = num(el, "h").unwrap_or(head + rows * lh + 2.0 * pad);
    let mut panel = Paint::default();
    panel.set_anti_alias(true);
    panel.set_color4f(paint::hex(&p.surface, alpha), None);
    canvas.draw_rrect(RRect::new_rect_xy(Rect::from_xywh(x, y, w, height), 18.0, 18.0), &panel);
    let mono = Font::Mono;
    if !title.is_empty() {
        let mut tp = Paint::default();
        tp.set_anti_alias(true);
        tp.set_color4f(paint::hex(&p.muted, alpha), None);
        fonts::draw_run(canvas, title, x + pad, y + size * 1.25, mono, size * 0.72, 0.0, &tp);
        let mut rule = Paint::default();
        rule.set_color4f(paint::hex(&p.line(), alpha), None);
        canvas.draw_rect(Rect::from_xywh(x, y + head, w, 1.5), &rule);
    }
    let top = y + head + pad;
    canvas.save();
    canvas.clip_rect(Rect::from_xywh(x, y + head, w, height - head), ClipOp::Intersect, true);
    let gutter = if flag(el, "gutter") { fonts::measure(mono, "000", size * 0.8, 0.0) + size } else { 0.0 };
    let role = |r: &str| -> String {
        match r {
            "keyword" => p.accent.clone(),
            "string" => p.positive.clone(),
            "number" | "constant" => p.accent2.clone(),
            "comment" => p.muted.clone(),
            "type" | "function" => p.ink.clone(),
            "punctuation" => design::mix(&p.ink, &p.muted, 0.5),
            _ => p.ink.clone(),
        }
    };
    for line in lines {
        let id = s(line, "id");
        let before = shown_before.iter().position(|i| i == id);
        let after = shown_now.iter().position(|i| i == id);
        let (row, a) = match (before, after) {
            (Some(b), Some(n)) => (b as f32 + (n as f32 - b as f32) * q, 1.0),
            (None, Some(n)) => (n as f32, if added.iter().any(|i| i == id) || idx > 0 { q } else { 1.0 }),
            (Some(b), None) => (b as f32, 1.0 - q),
            (None, None) => continue,
        };
        if a <= 0.01 {
            continue;
        }
        let ly = top + row * lh;
        let is_added = added.iter().any(|i| i == id);
        let is_removed = removed.iter().any(|i| i == id) || after.is_none();
        let focused = focus.iter().any(|i| i == id);
        let dim = if !focus.is_empty() && !focused && !is_added {
            1.0 - 0.55 * q.max(if idx == 0 { 1.0 } else { 0.0 })
        } else {
            1.0
        };
        // Change washes fade over a second and a half after the edit lands.
        let wash = if is_added {
            Some((p.positive.clone(), (1.0 - motion::clamp01((since - dur) / 1.5)) * 0.85 + 0.15))
        } else if is_removed {
            Some((p.negative.clone(), 1.0))
        } else {
            None
        };
        if let Some((c, k)) = wash {
            let mut wp = Paint::default();
            wp.set_color4f(paint::hex(&p.wash(&c), alpha * a * k), None);
            canvas.draw_rect(Rect::from_xywh(x, ly, w, lh), &wp);
            let mut bar = Paint::default();
            bar.set_color4f(paint::hex(&c, alpha * a), None);
            canvas.draw_rect(Rect::from_xywh(x, ly, 5.0, lh), &bar);
        }
        if focused {
            let mut bar = Paint::default();
            bar.set_color4f(paint::hex(&p.accent, alpha * a * q.max(if idx == 0 { 1.0 } else { 0.0 })), None);
            canvas.draw_rect(Rect::from_xywh(x, ly, 6.0, lh), &bar);
        }
        let baseline = ly + text::baseline_in(mono, size, lh);
        if gutter > 0.0 {
            let mut gp = Paint::default();
            gp.set_anti_alias(true);
            gp.set_color4f(paint::hex(&p.muted, alpha * a * 0.8 * dim), None);
            let n = f(line, "number", 0.0);
            if n > 0.0 {
                let label = format!("{}", n as i64);
                let lw = fonts::measure(mono, &label, size * 0.8, 0.0);
                fonts::draw_run(canvas, &label, x + pad + gutter - size - lw, baseline, mono, size * 0.8, 0.0, &gp);
            }
        }
        let indent = f(line, "indent", 0.0) * fonts::measure(mono, " ", size, 0.0);
        let mut cx = x + pad + gutter + indent;
        let spans = arr(line, "spans");
        let parts: Vec<(String, String)> = if spans.is_empty() {
            vec![(s(line, "text").to_owned(), p.ink.clone())]
        } else {
            spans.iter().map(|sp| (s(sp, "text").to_owned(), role(s(sp, "role")))).collect()
        };
        let mut full = String::new();
        let start_x = cx;
        for (part, color) in parts {
            let mut tp = Paint::default();
            tp.set_anti_alias(true);
            tp.set_color4f(paint::hex(&color, alpha * a * dim), None);
            fonts::draw_run(canvas, &part, cx, baseline, mono, size, 0.0, &tp);
            cx += fonts::measure(mono, &part, size, 0.0);
            full.push_str(&part);
        }
        if is_removed {
            let mut strike = Paint::default();
            strike.set_color4f(paint::hex(&p.negative, alpha * a * 0.8), None);
            canvas.draw_rect(Rect::from_xywh(start_x, baseline - size * 0.3, cx - start_x, 2.0), &strike);
        }
        if !full.trim().is_empty() && a * dim > 0.5 {
            let m = canvas.local_to_device_as_3x3();
            let r = m.map_rect(Rect::from_xywh(start_x, baseline - size * 0.74, cx - start_x, size * 0.98)).0;
            let scale = (m.scale_x().powi(2) + m.skew_y().powi(2)).sqrt();
            scope.texts.push(TextMark {
                text: full,
                rect: r,
                size: size * scale / scope.pixel,
                alpha: alpha * a * dim,
            });
        }
    }
    canvas.restore();
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_validation_names_block_only_features_and_unknown_types() {
        let mut n = 0;
        let rough = serde_json::json!([{"type":"rect","id":"box","w":10,"h":10,"rough":{"amount":2}}]);
        let err = validate(rough.as_array().unwrap(), 0, &mut n).unwrap_err();
        assert!(err.contains("box") && err.contains("rough"), "{err}");
        let mut n = 0;
        let ok = serde_json::json!([{"type":"code","lines":[{"id":"a","text":"x"}],"steps":[{"at":0,"show":["a"]}]},
            {"type":"particles","kind":"burst","count":2000,"w":10,"h":10},
            {"type":"shader","material":"noise","w":10,"h":10}]);
        validate(ok.as_array().unwrap(), 0, &mut n).unwrap();
        let mut n = 0;
        let bad = serde_json::json!([{"type":"code","lines":[{"id":"a","text":"x"}],"steps":[{"at":0,"show":["b"]}]}]);
        assert!(validate(bad.as_array().unwrap(), 0, &mut n).is_err());
    }
    #[test]
    fn camera_is_identity_at_rest_and_far_layers_move_less() {
        let view = (1920.0, 1080.0);
        let rest = Camera::identity(view);
        let (m, p, _) = rest.matrix(0.0).unwrap();
        assert!(m.is_identity() || (m.map_point((100.0, 100.0)) - Point::new(100.0, 100.0)).length() < 1e-3);
        assert!((p - 1.0).abs() < 1e-6);
        let spec = serde_json::json!({"keys":[{"at":0,"x":1160,"dur":0}]});
        let pan = Camera::at(&spec, 1.0, view);
        let near = pan.matrix(0.0).unwrap().0.map_point((960.0, 540.0));
        let far = pan.matrix(3.0).unwrap().0.map_point((960.0, 540.0));
        assert!((near.x - 760.0).abs() < 1e-3, "near layer moves with the camera: {}", near.x);
        assert!(far.x > near.x && far.x < 960.0, "a far layer moves a quarter as much: {}", far.x);
        let dolly = Camera::at(&serde_json::json!({"z": 0.95}), 0.0, view);
        assert!(dolly.matrix(0.0).is_none(), "the camera has passed the picture plane");
    }
}
