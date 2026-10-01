//! Canvas effects: hand-drawn (rough) strokes with hachure, audio meters, seeded particle
//! fields and the morph that carries an element across a cut.
use super::*;

impl<'a, 'c, 'm> Draw<'a, 'c, 'm> {
    /// A hand-drawn rendering: `passes` jittered pencil strokes and, for filled closed shapes,
    /// hachure lines clipped to the shape (or a flat fill). `boil` re-seeds the jitter that many
    /// times a second, the lively wobble of traditional animation.
    pub(super) fn rough_shape(
        &self,
        el: &Value,
        rough: &Value,
        fill: &str,
        stroke: &str,
        width: f32,
        draw: f32,
        now: f32,
    ) -> Svgr<'a> {
        use std::hash::{Hash, Hasher};
        let amount = f(rough, "amount", 2.2).clamp(0.0, 40.0);
        let passes = (n(rough, "passes", 2.0) as usize).clamp(1, 3);
        let boil = f(rough, "boil", 0.0);
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        el.to_string().hash(&mut hasher);
        let frame_seed = if boil > 0.0 { (now * boil).floor().max(0.0) as u64 } else { 0 };
        let seed = hasher.finish() ^ frame_seed.wrapping_mul(0xA24B_AED4_963E_E407);
        let fill_mode = nonempty(s(rough, "fill"), "hachure");
        let hatched = fill != "none" && fill_mode != "solid";
        // The jittered geometry depends only on the element and its seed, so frames that do
        // not boil reuse it: hand-drawn scenes then cost about as much as crisp ones.
        let key = seed ^ (amount.to_bits() as u64) << 7 ^ (passes as u64) << 3 ^ hatched as u64;
        let geo = rough_geometry(key, || {
            let contours = contours_of(el);
            let length: f32 = contours
                .iter()
                .map(|(c, _)| c.windows(2).map(|w| (w[1].0 - w[0].0).hypot(w[1].1 - w[0].1)).sum::<f32>())
                .sum::<f32>()
                * 1.08
                + 2.0 * amount;
            let closed = contours.iter().any(|(_, closed)| *closed);
            let crisp = contours
                .iter()
                .map(|(c, _)| {
                    c.iter()
                        .enumerate()
                        .map(|(i, p)| format!("{} {:.1} {:.1}", if i == 0 { "M" } else { "L" }, p.0, p.1))
                        .collect::<Vec<_>>()
                        .join(" ")
                        + " Z"
                })
                .collect::<Vec<_>>()
                .join(" ");
            // Hachure: parallel lines clipped to the shape analytically (even-odd scanline),
            // so no clip mask is needed and only the inside is jittered.
            let mut hatch = String::new();
            if hatched && closed {
                let (bx, by, bw, bh) = bounds(el);
                let gap = f(rough, "gap", 11.0).max(3.0);
                let angle = f(rough, "angle", -41.0).to_radians();
                let (dx, dy) = (angle.cos(), angle.sin());
                let reach = bw.hypot(bh);
                let (cx, cy) = (bx + bw / 2.0, by + bh / 2.0);
                let count = (reach / gap).ceil() as i32;
                for k in -count / 2..=count / 2 {
                    let off = k as f32 * gap;
                    let o = (cx - dy * off - dx * reach / 2.0, cy + dx * off - dy * reach / 2.0);
                    for (j, seg) in scanline(&contours, o, (dx, dy)).into_iter().enumerate() {
                        let salt = (k as u64).wrapping_mul(31) ^ (j as u64).wrapping_mul(0x9E37);
                        hatch.push_str(&hatch_line(seg, amount, seed ^ salt));
                        hatch.push(' ');
                    }
                }
            }
            let strokes = (0..passes)
                .map(|pass| {
                    contours
                        .iter()
                        .map(|(c, _)| rough_contour(c, amount, seed.wrapping_add(pass as u64 * 0x51_7CC1_B727_220A)))
                        .collect::<Vec<_>>()
                        .join(" ")
                })
                .collect();
            RoughGeometry { length, closed, crisp, hatch, strokes }
        });
        let ink = if stroke != "none" {
            stroke.to_owned()
        } else if fill != "none" {
            fill.to_owned()
        } else {
            self.p.ink.clone()
        };
        let length = geo.length;
        let dash = if draw < 0.999 {
            (format!("{} {}", length, length * 2.0 + 10.0), length * (1.0 - draw))
        } else {
            ("none".to_owned(), 0.0)
        };
        let mut nodes = vec![];
        if fill != "none" && geo.closed && draw > 0.55 {
            let alpha = motion::clamp01((draw - 0.55) / 0.45);
            if !hatched {
                nodes.push(
                    fframes::svgr!(<path d={geo.crisp.clone()} fill={fill.to_owned()} fill-opacity={alpha} stroke="none" />),
                );
            } else if !geo.hatch.is_empty() {
                nodes.push(fframes::svgr!(<path d={geo.hatch.clone()} fill="none" stroke={fill.to_owned()} stroke-width={f(rough, "hatchWidth", (width * 0.55).max(1.5))} stroke-linecap="round" opacity={alpha} />));
            }
        }
        for (pass, d) in geo.strokes.iter().enumerate() {
            let w = width * if pass == 0 { 1.0 } else { 0.7 };
            nodes.push(fframes::svgr!(<path d={d.clone()} fill="none" stroke={ink.clone()} stroke-width={w} stroke-dasharray={dash.0.clone()} stroke-dashoffset={dash.1} stroke-linecap="round" stroke-linejoin="round" opacity={if pass == 0 { 1.0 } else { 0.75 }} />));
        }
        // Arrowheads ride the draw-on tip, as on crisp strokes.
        let heads = s(el, "arrow");
        if draw > 0.02 && heads != "" && heads != "none" {
            let line = outline(el);
            let head = f(el, "head", width * 3.2 + 6.0);
            let mut tips = vec![];
            if heads == "end" || heads == "both" {
                tips.push(along(&line, draw));
            }
            if heads == "start" || heads == "both" {
                let rev: Vec<_> = line.iter().rev().copied().collect();
                tips.push(along(&rev, 1.0));
            }
            for ((x, y), angle) in tips.into_iter().flatten() {
                nodes.push(fframes::svgr!(<path d={rough_contour(&[(x - head * (angle - PI / 6.5).cos(), y - head * (angle - PI / 6.5).sin()), (x, y), (x - head * (angle + PI / 6.5).cos(), y - head * (angle + PI / 6.5).sin())], amount * 0.4, seed ^ 0xA11)} fill="none" stroke={ink.clone()} stroke-width={width} stroke-linecap="round" stroke-linejoin="round" />));
            }
        }
        fframes::svgr!(<g>{nodes}</g>)
    }

    /// A seeded field of drifting particles inside a box. `kind` sets the physics: `dust`
    /// wanders, `embers` rise and flicker, `rain` falls in slanted streaks, `snow` falls and
    /// sways, `bubbles` rise as rings. Positions are a pure function of time and `seed`;
    /// particles wrap inside the box and fade near its edges so the wrap never shows.
    pub(super) fn particles(&self, el: &Value, fill: &str, now: f32) -> Svgr<'a> {
        let (x, y, w, h) = (f(el, "x", 0.0), f(el, "y", 0.0), f(el, "w", 0.0).max(1.0), f(el, "h", 0.0).max(1.0));
        let count = (n(el, "count", 40.0) as usize).clamp(1, 400);
        let kind = nonempty(s(el, "kind"), "dust");
        let seed = n(el, "seed", 1.0) as u64;
        // (velocity x, velocity y, sway, default size) in px/s and px.
        if kind == "stars" || kind == "warp" {
            return self.space(el, fill, now, kind);
        }
        let (vx, vy, sway, base) = match kind {
            "embers" => (0.0, -70.0, 16.0, 5.0),
            "rain" => (-140.0, 1000.0, 0.0, 3.0),
            "snow" => (0.0, 60.0, 22.0, 6.0),
            "bubbles" => (0.0, -55.0, 10.0, 10.0),
            _ => (6.0, -10.0, 26.0, 4.0),
        };
        let size = f(el, "size", base).max(0.5);
        let t = now * f(el, "speed", 1.0);
        let unit = |i: usize, k: u64| noise(seed, i as u64 * 8 + k) * 0.5 + 0.5;
        let mut out = vec![];
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
            let alpha = motion::clamp01(edge) * flicker;
            if alpha < 0.02 {
                continue;
            }
            let r = size * (0.5 + unit(i, 4));
            out.push(match kind {
                "rain" => {
                    let (dx, dy) = (vx * v * 0.035, vy * v * 0.035);
                    fframes::svgr!(<line x1={px} y1={py} x2={px - dx} y2={py - dy} stroke={fill.to_owned()} stroke-width={r * 0.5} stroke-linecap="round" opacity={alpha} />)
                }
                "bubbles" => {
                    fframes::svgr!(<circle cx={px} cy={py} r={r} fill="none" stroke={fill.to_owned()} stroke-width={(r * 0.18).max(1.0)} opacity={alpha} />)
                }
                _ => fframes::svgr!(<circle cx={px} cy={py} r={r} fill={fill.to_owned()} opacity={alpha} />),
            });
        }
        fframes::svgr!(<g>{out}</g>)
    }
    /// Audio meter from the prepared voice levels: `bars` (newest at the right), `mirror`
    /// (newest in the middle, symmetric), `ring` (around the centre) or `wave` (a filled
    /// envelope). Silence leaves small dots, so who is talking is visible at a glance.
    pub(super) fn meter(&self, el: &Value, fill: &str, now: f32) -> Svgr<'a> {
        let (x, y, w, h) = (f(el, "x", 0.0), f(el, "y", 0.0), f(el, "w", 0.0).max(1.0), f(el, "h", 0.0).max(1.0));
        let n = (n(el, "bars", 24.0) as usize).clamp(3, 96);
        let step = f(el, "step", 2.0).max(0.5) / self.f.fps as f32;
        let history = |k: usize| self.level(now - k as f32 * step);
        let style = nonempty(s(el, "style"), "bars");
        match style {
            "ring" => {
                let (cx, cy) = (x + w / 2.0, y + h / 2.0);
                let radius = w.min(h) * 0.3;
                let width = f(el, "width", (TAU * radius / n as f32 * 0.5).max(2.0));
                let spokes: Vec<_> = (0..n).map(|k| {
                    let a = k as f32 / n as f32 * TAU - PI / 2.0;
                    let len = 4.0 + history(k.min(n - k)) * w.min(h) * 0.18;
                    fframes::svgr!(<line x1={cx + radius * a.cos()} y1={cy + radius * a.sin()} x2={cx + (radius + len) * a.cos()} y2={cy + (radius + len) * a.sin()} stroke={fill.to_owned()} stroke-width={width} stroke-linecap="round" />)
                }).collect();
                fframes::svgr!(<g>{spokes}</g>)
            }
            "wave" => {
                let mid = y + h / 2.0;
                let pts: Vec<(f32, f32)> = (0..n)
                    .map(|k| {
                        (
                            x + w * k as f32 / (n - 1) as f32,
                            history(((n - 1) as isize - 2 * k as isize).unsigned_abs() / 2) * h / 2.0,
                        )
                    })
                    .collect();
                let top = pts
                    .iter()
                    .map(|(px, a)| format!("{px:.1} {:.1}", mid - a.max(1.5)))
                    .collect::<Vec<_>>()
                    .join(" L ");
                let bottom = pts
                    .iter()
                    .rev()
                    .map(|(px, a)| format!("{px:.1} {:.1}", mid + a.max(1.5)))
                    .collect::<Vec<_>>()
                    .join(" L ");
                fframes::svgr!(<path d={format!("M {top} L {bottom} Z")} fill={fill.to_owned()} />)
            }
            _ => {
                let gap = w / n as f32 * f(el, "gap", 0.35).clamp(0.0, 0.9);
                let bw = (w - gap * (n - 1) as f32) / n as f32;
                let mirror = style == "mirror";
                let bars: Vec<_> = (0..n)
                    .map(|i| {
                        let k = if mirror { (i as isize - (n / 2) as isize).unsigned_abs() } else { n - 1 - i };
                        let bh = (history(k) * h).max(bw.min(h));
                        let by = if mirror { y + (h - bh) / 2.0 } else { y + h - bh };
                        rounded(x + i as f32 * (bw + gap), by, bw, bh, f(el, "r", bw / 2.0), fill)
                    })
                    .collect();
                fframes::svgr!(<g>{bars}</g>)
            }
        }
    }

    /// The element `to` partway (k 0–1) from `from`: numbers interpolate, palette colours
    /// mix, outlines resample by arc length and align before blending.
    pub(super) fn morphed(&self, from: &Value, to: &Value, k: f32, defs: &mut Vec<Svgr<'a>>) -> Value {
        let mut out = to.clone();
        let Some(o) = out.as_object_mut() else { return out };
        o.remove("morph");
        o.remove("echo");
        o.insert("enter".into(), Value::String("none".into()));
        o.insert("at".into(), serde_json::json!(0.0));
        let same = s(from, "type") == s(to, "type") && !matches!(s(to, "type"), "path" | "poly");
        if same {
            for key in [
                "x", "y", "w", "h", "r", "cx", "cy", "rx", "ry", "x1", "y1", "x2", "y2", "size", "width", "opacity",
                "rotate",
            ] {
                if let (Some(a), Some(b)) = (num(from, key), num(to, key)) {
                    o.insert(key.into(), serde_json::json!(a + (b - a) * k));
                }
            }
        } else if let (Some((a, closed_a)), Some((b, closed_b))) = (morph_outline(from), morph_outline(to)) {
            // Different shapes (or paths): blend resampled outlines.
            const N: usize = 97;
            let (pa, mut pb) = (resample(&a, N), resample(&b, N));
            if closed_a && closed_b {
                // Align start point and winding direction so the outline does not twist.
                let ring = |v: &[(f32, f32)]| v[..N - 1].to_vec();
                let ra = ring(&pa);
                let forward = ring(&pb);
                let backward: Vec<_> = forward.iter().rev().copied().collect();
                let cost = |rb: &[(f32, f32)], s: usize| {
                    ra.iter()
                        .enumerate()
                        .map(|(t, p)| {
                            let q = rb[(t + s) % (N - 1)];
                            (p.0 - q.0).powi(2) + (p.1 - q.1).powi(2)
                        })
                        .sum::<f32>()
                };
                let (mut best, mut best_cost, mut best_ring) = (0, f32::MAX, &forward);
                for candidate in [&forward, &backward] {
                    for shift in 0..N - 1 {
                        let c = cost(candidate, shift);
                        if c < best_cost {
                            best_cost = c;
                            best = shift;
                            best_ring = candidate;
                        }
                    }
                }
                pb = (0..N - 1)
                    .map(|t| best_ring[(t + best) % (N - 1)])
                    .chain(std::iter::once(best_ring[best]))
                    .collect();
            }
            let d = pa
                .iter()
                .zip(&pb)
                .enumerate()
                .map(|(i, (p, q))| {
                    format!(
                        "{} {:.2} {:.2}",
                        if i == 0 { "M" } else { "L" },
                        p.0 + (q.0 - p.0) * k,
                        p.1 + (q.1 - p.1) * k
                    )
                })
                .collect::<Vec<_>>()
                .join(" ")
                + if closed_a && closed_b { " Z" } else { "" };
            for key in
                ["x", "y", "w", "h", "r", "cx", "cy", "rx", "ry", "x1", "y1", "x2", "y2", "points", "closed", "d"]
            {
                o.remove(key);
            }
            o.insert("type".into(), Value::String("path".into()));
            o.insert("d".into(), Value::String(d));
            if closed_a && closed_b && !to.get("fill").is_some_and(|v| v == "none") && o.get("fill").is_none() {
                o.insert("fill".into(), Value::String("accent".into()));
            }
            // Paths default to an ink outline; a morph between unstroked shapes stays unstroked.
            if from.get("stroke").is_none() && to.get("stroke").is_none() {
                o.insert("stroke".into(), Value::String("none".into()));
            }
        }
        for key in ["fill", "stroke"] {
            if let (Some(Value::String(a)), Some(Value::String(b))) = (from.get(key), to.get(key)) {
                let (ha, hb) = (
                    self.paint(Some(&Value::String(a.clone())), "accent", defs),
                    self.paint(Some(&Value::String(b.clone())), "accent", defs),
                );
                if ha != "none" && hb != "none" {
                    o.insert(key.into(), Value::String(crate::design::mix(&ha, &hb, k)));
                }
            }
        }
        out
    }
}

/// Jittered outlines and hachure for one rough element at one seed.
/// Gradient maps for `material`, from the cold edge (low depth) to the hot core.
fn material_map(name: &str) -> Option<&'static [&'static str]> {
    Some(match name {
        // A heat image: a pink rim through red, orange and white to a deep blue core.
        "thermal" => &["#ff4fa3", "#ff3d2e", "#ff9f1c", "#fff3c4", "#7fd3ff", "#2a6cff", "#0a1a5c"],
        // Polished metal: bands of dark and light, so the depth reads as reflections.
        "chrome" => &["#202024", "#9a9aa3", "#f6f6f8", "#4a4a52", "#d6d6dc", "#ffffff", "#7c7c86"],
        "gold" => &["#3b2405", "#a8741a", "#ffe9a8", "#b8862b", "#fff6d8", "#c99a3c"],
        // The palette's own light: an accent rim to a white-hot core.
        "neon" => &["accent", "accent", "accent2", "#ffffff"],
        _ => return None,
    })
}

pub(super) fn material_ok(m: &Value) -> bool {
    match m {
        Value::String(name) => material_map(name).is_some(),
        Value::Object(o) => {
            let map_ok = match o.get("map") {
                None => true,
                Some(Value::String(name)) => material_map(name).is_some(),
                Some(Value::Array(stops)) => {
                    (2..=8).contains(&stops.len())
                        && stops.iter().all(|c| {
                            c.as_str().is_some_and(|c| c != "none" && super::paint_ok(Some(&Value::String(c.into()))))
                        })
                }
                _ => false,
            };
            map_ok
                && o.keys().all(|k| {
                    ["map", "depth", "soften", "flow", "stripe", "angle", "grain", "gain"].contains(&k.as_str())
                })
        }
        _ => false,
    }
}

/// The element (and its children) painted white: a material reads only the form.
pub(super) fn whitened(el: &Value) -> Value {
    let mut out = el.clone();
    if let Some(o) = out.as_object_mut() {
        for key in ["fill", "stroke"] {
            if o.get(key).is_some_and(|v| v != "none") {
                o.insert(key.into(), Value::String("#ffffff".into()));
            }
        }
        if o.get("fill").is_none() && !matches!(s(el, "type"), "line" | "path" | "poly" | "group" | "image") {
            o.insert("fill".into(), Value::String("#ffffff".into()));
        }
        if let Some(Value::Array(children)) = o.get_mut("children") {
            for c in children.iter_mut() {
                *c = whitened(c);
            }
        }
    }
    out
}

impl<'a, 'c, 'm> Draw<'a, 'c, 'm> {
    /// `material`: the shape's depth (how far each point lies inside its outline, a blur of its
    /// alpha), optionally rippled by stripes that flow across it, mapped through a gradient
    /// (thermal, chrome, gold, neon or `map: [colors]`), softened at the rim and grained. One
    /// filter, a pure function of the shape and scene seconds.
    pub(super) fn material(
        &self,
        m: &Value,
        shape: Svgr<'a>,
        now: f32,
        (bx, by, bw, bh): (f32, f32, f32, f32),
    ) -> Svgr<'a> {
        let preset = m.as_str().unwrap_or("thermal");
        let opt = |key: &str| m.get(key).and_then(Value::as_f64).map(|v| v as f32);
        let stops: Vec<String> = match m.get("map") {
            Some(Value::Array(list)) => list.iter().filter_map(Value::as_str).map(str::to_owned).collect(),
            Some(Value::String(name)) => material_map(name).unwrap_or(&[]).iter().map(|c| (*c).to_owned()).collect(),
            _ => material_map(preset).unwrap_or(&[]).iter().map(|c| (*c).to_owned()).collect(),
        };
        let colors: Vec<[f32; 3]> = stops
            .iter()
            .filter_map(|c| {
                let hex = self.paint(Some(&Value::String(c.clone())), "#ffffff", &mut vec![]);
                crate::design::parse(&hex)
            })
            .collect();
        if colors.len() < 2 {
            return shape;
        }
        let table = |i: usize| colors.iter().map(|c| format!("{:.3}", c[i])).collect::<Vec<_>>().join(" ");
        let short = bw.min(bh).max(1.0);
        let depth = opt("depth").unwrap_or((short * 0.08).clamp(3.0, 48.0)).max(0.5);
        let soften = opt("soften").unwrap_or(depth * 0.45).max(0.0);
        let gain = opt("gain").unwrap_or(if preset == "thermal" { 1.7 } else { 1.35 });
        let grain = opt("grain").unwrap_or(if preset == "thermal" { 0.12 } else { 0.0 }).clamp(0.0, 1.0);
        let flow = opt("flow").unwrap_or(if preset == "thermal" { 60.0 } else { 0.0 });
        let stripe = opt("stripe").unwrap_or(0.45).clamp(0.0, 1.0);
        let angle = opt("angle").unwrap_or(60.0);
        let reach = soften * 3.0 + depth + 24.0;
        let (x0, y0, w0, h0) = (bx - reach, by - reach, bw + 2.0 * reach, bh + 2.0 * reach);
        // Stripes flowing across the form darken it in moving bands, so the map's bands travel.
        let source = if flow.abs() > 1e-3 && stripe > 0.0 {
            let (mask, grad) = (self.uid("material-mask"), self.uid("material-stripe"));
            let period = (bw.max(bh) * 0.6).max(40.0);
            let shift = (flow * now).rem_euclid(period);
            let (cx, cy) = (bx + bw / 2.0, by + bh / 2.0);
            fframes::svgr!(<g>
                {shape.clone()}
                <defs>
                    <mask id={mask.clone()} mask-type="alpha" maskUnits="userSpaceOnUse" x={x0} y={y0} width={w0} height={h0}>{shape}</mask>
                    <linearGradient id={grad.clone()} gradientUnits="userSpaceOnUse" spreadMethod="repeat" x1={cx + shift} y1={cy} x2={cx + shift + period} y2={cy} gradientTransform={format!("rotate({angle} {cx} {cy})")}>
                        <stop offset="0" stop-color="#000000" stop-opacity="0" />
                        <stop offset="0.5" stop-color="#000000" stop-opacity={stripe} />
                        <stop offset="1" stop-color="#000000" stop-opacity="0" />
                    </linearGradient>
                </defs>
                <rect x={x0} y={y0} width={w0} height={h0} fill={format!("url(#{grad})")} mask={format!("url(#{mask})")} />
            </g>)
        } else {
            shape
        };
        let id = self.uid("material");
        let mut grain_prims = vec![];
        if grain > 0.0 {
            grain_prims.push(fframes::svgr!(<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="7" result="noise" />));
            grain_prims.push(fframes::svgr!(<feColorMatrix in="noise" type="matrix" values="0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 0 1" result="speck" />));
            grain_prims.push(fframes::svgr!(<feComposite in="mapped" in2="speck" operator="arithmetic" k1="0" k2="1" k3={grain} k4={-grain * 0.5} result="grained" />));
        } else {
            grain_prims.push(fframes::svgr!(<feOffset in="mapped" dx="0" dy="0" result="grained" />));
        }
        fframes::svgr!(<g>
            <defs><filter id={id.clone()} filterUnits="userSpaceOnUse" x={x0} y={y0} width={w0} height={h0} color-interpolation-filters="sRGB">
                <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.299 0.587 0.114 0 0" result="lum" />
                <feGaussianBlur in="SourceAlpha" stdDeviation={depth} result="deep" />
                <feComposite in="deep" in2="SourceAlpha" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="inner" />
                <feComposite in="inner" in2="lum" operator="arithmetic" k1={gain} k2="0" k3="0" k4="0" result="heat" />
                <feColorMatrix in="heat" type="matrix" values="0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 1" result="grey" />
                <feComponentTransfer in="grey" result="mapped">
                    <feFuncR type="table" tableValues={table(0)} />
                    <feFuncG type="table" tableValues={table(1)} />
                    <feFuncB type="table" tableValues={table(2)} />
                </feComponentTransfer>
                {grain_prims}
                <feGaussianBlur in="SourceAlpha" stdDeviation={soften} result="rim" />
                <feComponentTransfer in="rim" result="edge"><feFuncA type="linear" slope="1.5" /></feComponentTransfer>
                <feComposite in="grained" in2="edge" operator="in" />
            </filter></defs>
            <g filter={format!("url(#{id})")}>{source}</g>
        </g>)
    }
}

pub(super) struct RoughGeometry {
    length: f32,
    closed: bool,
    crisp: String,
    hatch: String,
    strokes: Vec<String>,
}

/// Rough geometry by key, computed once. The cache is bounded; boiling elements (a new seed
/// several times a second) simply refill it.
fn rough_geometry(key: u64, make: impl FnOnce() -> RoughGeometry) -> std::sync::Arc<RoughGeometry> {
    static CACHE: std::sync::OnceLock<Mutex<HashMap<u64, std::sync::Arc<RoughGeometry>>>> = std::sync::OnceLock::new();
    let cache = CACHE.get_or_init(Default::default);
    if let Some(hit) = cache.lock().unwrap().get(&key) {
        return hit.clone();
    }
    let geo = std::sync::Arc::new(make());
    let mut map = cache.lock().unwrap();
    if map.len() > 4096 {
        map.clear();
    }
    map.insert(key, geo.clone());
    geo
}

/// Inside segments of the line `o + t·d` against closed contours (even-odd rule).
pub(super) fn scanline(contours: &[(Vec<(f32, f32)>, bool)], o: (f32, f32), d: (f32, f32)) -> Vec<[(f32, f32); 2]> {
    let mut ts = vec![];
    for (c, closed) in contours {
        if !closed || c.len() < 3 {
            continue;
        }
        for i in 0..c.len() {
            let (p0, p1) = (c[i], c[(i + 1) % c.len()]);
            let e = (p1.0 - p0.0, p1.1 - p0.1);
            let denom = d.0 * e.1 - d.1 * e.0;
            if denom.abs() < 1e-9 {
                continue;
            }
            let w = (p0.0 - o.0, p0.1 - o.1);
            let u = (w.0 * d.1 - d.0 * w.1) / denom;
            if (0.0..1.0).contains(&u) {
                ts.push((w.0 * e.1 - e.0 * w.1) / denom);
            }
        }
    }
    ts.sort_by(|a, b| a.total_cmp(b));
    ts.chunks_exact(2)
        .filter(|p| p[1] - p[0] > 2.0)
        .map(|p| [(o.0 + d.0 * p[0], o.1 + d.1 * p[0]), (o.0 + d.0 * p[1], o.1 + d.1 * p[1])])
        .collect()
}

/// One hachure stroke: a single slightly bowed curve with jittered ends, as Rough.js draws
/// them. Outlines keep the finer multi-point pencil line; fills stay cheap at any size.
fn hatch_line(seg: [(f32, f32); 2], amount: f32, seed: u64) -> String {
    let j = |k: u64| noise(seed, k) * amount * 0.5;
    let (x0, y0) = (seg[0].0 + j(1), seg[0].1 + j(2));
    let (x1, y1) = (seg[1].0 + j(3), seg[1].1 + j(4));
    let (mx, my) = ((x0 + x1) / 2.0 + j(5) * 2.0, (y0 + y1) / 2.0 + j(6) * 2.0);
    format!("M {x0:.1} {y0:.1} Q {mx:.1} {my:.1} {x1:.1} {y1:.1}")
}

impl<'a, 'c, 'm> Draw<'a, 'c, 'm> {
    /// Space: `stars` twinkle in place with a slow drift; `warp` streaks radiate from the
    /// centre of the box, accelerating outward (hyperspace, a tunnel of light or code).
    fn space(&self, el: &Value, fill: &str, now: f32, kind: &str) -> Svgr<'a> {
        let (x, y, w, h) = (f(el, "x", 0.0), f(el, "y", 0.0), f(el, "w", 0.0).max(1.0), f(el, "h", 0.0).max(1.0));
        let count = (n(el, "count", 120.0) as usize).clamp(1, 400);
        let seed = n(el, "seed", 1.0) as u64;
        let size = f(el, "size", if kind == "warp" { 2.0 } else { 2.2 }).max(0.3);
        let t = now * f(el, "speed", 1.0);
        let unit = |i: usize, k: u64| noise(seed, i as u64 * 8 + k) * 0.5 + 0.5;
        let mut out = vec![];
        if kind == "stars" {
            for i in 0..count {
                let px = x + (unit(i, 0) * w + t * 4.0 * (unit(i, 2) - 0.5)).rem_euclid(w);
                let py = y + unit(i, 1) * h;
                let twinkle = 0.25 + 0.75 * (t * (0.6 + 1.8 * unit(i, 3)) + unit(i, 4) * TAU).sin().abs();
                let r = size * (0.35 + unit(i, 5).powi(3) * 1.6);
                out.push(fframes::svgr!(<circle cx={px} cy={py} r={r} fill={fill.to_owned()} opacity={twinkle} />));
            }
        } else {
            let (cx, cy) = (x + w / 2.0, y + h / 2.0);
            let reach = w.hypot(h) * 0.55;
            for i in 0..count {
                let a = unit(i, 0) * TAU;
                let u = (unit(i, 1) + t * (0.12 + 0.2 * unit(i, 2))).fract();
                let r = u * u * reach + reach * 0.02;
                let len = 6.0 + r * 0.16;
                let (c, sn) = (a.cos(), a.sin());
                let alpha = (u * 1.4).min(1.0) * (1.0 - ((u - 0.9) / 0.1).clamp(0.0, 1.0));
                if alpha <= 0.02 {
                    continue;
                }
                out.push(fframes::svgr!(<line x1={cx + c * r} y1={cy + sn * r} x2={cx + c * (r + len)} y2={cy + sn * (r + len)} stroke={fill.to_owned()} stroke-width={size * (0.5 + u)} stroke-linecap="round" opacity={alpha} />));
            }
        }
        fframes::svgr!(<g>{out}</g>)
    }

    /// A 3D wireframe solid (tetra, cube, octa, icosa, dodeca) turning in space: `spin` in
    /// degrees per second about x, y, z, `tilt` its starting angles, `perspective` 0..1.
    /// Edges facing away are dimmer; `nodes` marks the vertices. Draws on edge by edge.
    pub(super) fn solid(&self, el: &Value, draw: f32, now: f32, defs: &mut Vec<Svgr<'a>>) -> Svgr<'a> {
        let color = self.paint(el.get("stroke").or(el.get("fill")).filter(|v| *v != "none"), "accent", defs);
        let (cx, cy, size) = (f(el, "cx", 0.0), f(el, "cy", 0.0), f(el, "size", 120.0));
        let width = f(el, "width", 3.0);
        let three = |key: &str, d: [f32; 3]| {
            let a = arr(el, key);
            if a.len() == 3 { std::array::from_fn(|i| a[i].as_f64().unwrap_or(d[i] as f64) as f32) } else { d }
        };
        let (spin, tilt) = (three("spin", [14.0, 22.0, 0.0]), three("tilt", [20.0, 10.0, 0.0]));
        let ang: [f32; 3] = std::array::from_fn(|i| (tilt[i] + spin[i] * now).to_radians());
        let persp = f(el, "perspective", 0.35).clamp(0.0, 0.9);
        let rot = |v: [f32; 3]| {
            let [mut x, mut y, mut z] = v;
            let (s1, c1) = ang[0].sin_cos();
            (y, z) = (y * c1 - z * s1, y * s1 + z * c1);
            let (s2, c2) = ang[1].sin_cos();
            (x, z) = (x * c2 + z * s2, -x * s2 + z * c2);
            let (s3, c3) = ang[2].sin_cos();
            (x, y) = (x * c3 - y * s3, x * s3 + y * c3);
            [x, y, z]
        };
        let project = |v: [f32; 3]| {
            let k = 1.0 / (1.0 - persp * v[2] * 0.5);
            (cx + v[0] * size * k, cy + v[1] * size * k, v[2])
        };
        if s(el, "shape") == "globe" {
            // A globe turns about its own pole (y) first, then tilts toward the viewer.
            let globe_rot = |v: [f32; 3]| {
                let [mut x, mut y, mut z] = v;
                let (s2, c2) = ang[1].sin_cos();
                (x, z) = (x * c2 + z * s2, -x * s2 + z * c2);
                let (s1, c1) = ang[0].sin_cos();
                (y, z) = (y * c1 - z * s1, y * s1 + z * c1);
                let (s3, c3) = ang[2].sin_cos();
                (x, y) = (x * c3 - y * s3, x * s3 + y * c3);
                [x, y, z]
            };
            return self.globe(el, draw, now, &color, width, &globe_rot, &project, defs);
        }
        let verts = polyhedron(nonempty(s(el, "shape"), "icosa"));
        let p: Vec<[f32; 3]> = verts.iter().map(|v| rot(*v)).collect();
        let q: Vec<(f32, f32, f32)> = p.iter().map(|v| project(*v)).collect();
        if let Some(shade) = el.get("shade").filter(|v| v.as_bool() == Some(true) || v.is_object()) {
            return self.lit_solid(el, shade, &verts, &p, &q, draw, width, defs);
        }
        let edges = edges_of(&verts);
        let total = edges.len().max(1) as f32;
        let mut order: Vec<usize> = (0..edges.len()).collect();
        order.sort_by(|a, b| {
            let za = q[edges[*a].0].2 + q[edges[*a].1].2;
            let zb = q[edges[*b].0].2 + q[edges[*b].1].2;
            za.total_cmp(&zb)
        });
        let mut lines = vec![];
        for i in order {
            let (a, b) = edges[i];
            let reveal = motion::clamp01(draw * total - i as f32);
            if reveal <= 0.0 {
                continue;
            }
            let (ax, ay, az) = q[a];
            let (bx, by, bz) = q[b];
            let alpha = 0.3 + 0.7 * motion::clamp01(((az + bz) * 0.5 + 1.0) / 2.0);
            let (ex, ey) = (ax + (bx - ax) * reveal, ay + (by - ay) * reveal);
            lines.push(fframes::svgr!(<line x1={ax} y1={ay} x2={ex} y2={ey} stroke={color.clone()} stroke-width={width} stroke-linecap="round" opacity={alpha} />));
        }
        if el.get("nodes").and_then(Value::as_bool).unwrap_or(false) && draw >= 1.0 {
            for (x, y, z) in &q {
                let alpha = 0.3 + 0.7 * motion::clamp01((z + 1.0) / 2.0);
                lines.push(
                    fframes::svgr!(<circle cx={*x} cy={*y} r={width * 1.7} fill={color.clone()} opacity={alpha} />),
                );
            }
        }
        fframes::svgr!(<g>{lines}</g>)
    }
}

impl<'a, 'c, 'm> Draw<'a, 'c, 'm> {
    /// A turning globe: a graticule every 30°, `marks` at [lat, lon] and great-circle `arcs`
    /// [lat, lon, lat, lon] that lift off the surface and draw on one after another once the
    /// globe has drawn. Lines on the far side fall away to a faint trace.
    #[allow(clippy::too_many_arguments)]
    fn globe(
        &self,
        el: &Value,
        draw: f32,
        now: f32,
        color: &str,
        width: f32,
        rot: &dyn Fn([f32; 3]) -> [f32; 3],
        project: &dyn Fn([f32; 3]) -> (f32, f32, f32),
        defs: &mut Vec<Svgr<'a>>,
    ) -> Svgr<'a> {
        let unit = |lat: f32, lon: f32| {
            let (la, lo) = (lat.to_radians(), lon.to_radians());
            [la.cos() * lo.sin(), -la.sin(), la.cos() * lo.cos()]
        };
        let alpha = |z: f32| if z < 0.0 { 0.1 + 0.1 * (z + 1.0) } else { 0.35 + 0.65 * z };
        let mut nodes = vec![];
        // The body: a disc behind the lines when the globe is filled.
        let (cx, cy, size) = (f(el, "cx", 0.0), f(el, "cy", 0.0), f(el, "size", 120.0));
        if el.get("fill").is_some_and(|v| v != "none") && el.get("stroke").is_some() {
            let body = self.paint(el.get("fill"), "surface", defs);
            nodes.push(fframes::svgr!(<circle cx={cx} cy={cy} r={size} fill={body} opacity={draw.min(1.0)} />));
        }
        // Graticule: parallels and meridians as short segments, drawn on in order.
        let mut segs: Vec<([f32; 3], [f32; 3])> = vec![];
        for lat in [-60.0f32, -30.0, 0.0, 30.0, 60.0] {
            for i in 0..36 {
                let lon = i as f32 * 10.0;
                segs.push((unit(lat, lon), unit(lat, lon + 10.0)));
            }
        }
        for m in 0..12 {
            let lon = m as f32 * 30.0;
            for i in 0..18 {
                let lat = -90.0 + i as f32 * 10.0;
                segs.push((unit(lat, lon), unit(lat + 10.0, lon)));
            }
        }
        let total = segs.len() as f32;
        for (i, (a, b)) in segs.iter().enumerate() {
            if (i as f32) / total > draw {
                break;
            }
            let (ax, ay, az) = project(rot(*a));
            let (bx, by, bz) = project(rot(*b));
            nodes.push(fframes::svgr!(<line x1={ax} y1={ay} x2={bx} y2={by} stroke={color.to_owned()} stroke-width={width} stroke-linecap="round" opacity={alpha((az + bz) / 2.0)} />));
        }
        // Routes and places are the point of the shot: the accent, lit.
        let mark_color = self.paint(Some(&Value::String("accent".into())), "accent", defs);
        let after = now - f(el, "at", 0.0) - f(el, "dur", 1.2);
        // Arcs: a great circle between two places, lifted by its length, drawn on in turn.
        for (n, a) in arr(el, "arcs").iter().enumerate() {
            let g = |i: usize| a.get(i).and_then(Value::as_f64).unwrap_or(0.0) as f32;
            let (p, q) = (unit(g(0), g(1)), unit(g(2), g(3)));
            let dot = (p[0] * q[0] + p[1] * q[1] + p[2] * q[2]).clamp(-1.0, 1.0);
            let omega = dot.acos();
            if omega < 1e-3 {
                continue;
            }
            let reveal = motion::out_cubic(motion::clamp01((after - n as f32 * 0.35) / 1.4));
            if reveal <= 0.0 {
                continue;
            }
            let steps = 32;
            let lift = 0.18 * omega / std::f32::consts::PI;
            let mut pts = vec![];
            for i in 0..=steps {
                let t = i as f32 / steps as f32 * reveal;
                let (s0, s1) = (((1.0 - t) * omega).sin() / omega.sin(), (t * omega).sin() / omega.sin());
                let h = 1.0 + lift * (std::f32::consts::PI * t).sin();
                let v = [(p[0] * s0 + q[0] * s1) * h, (p[1] * s0 + q[1] * s1) * h, (p[2] * s0 + q[2] * s1) * h];
                pts.push(project(rot(v)));
            }
            for w in pts.windows(2) {
                let ((ax, ay, az), (bx, by, bz)) = (w[0], w[1]);
                nodes.push(fframes::svgr!(<line x1={ax} y1={ay} x2={bx} y2={by} stroke={mark_color.clone()} stroke-width={width * 2.4} stroke-linecap="round" opacity={alpha((az + bz) / 2.0).max(0.2)} />));
            }
        }
        // Marks: places on the surface, shown once the globe has drawn.
        if draw >= 1.0 {
            for m in arr(el, "marks") {
                let g = |i: usize| m.get(i).and_then(Value::as_f64).unwrap_or(0.0) as f32;
                let (x, y, z) = project(rot(unit(g(0), g(1))));
                if z > -0.15 {
                    let pop = motion::out_cubic(motion::clamp01(after / 0.5));
                    nodes.push(fframes::svgr!(<circle cx={x} cy={y} r={width * 3.4 * pop} fill={mark_color.clone()} opacity={alpha(z)} />));
                }
            }
        }
        fframes::svgr!(<g>{nodes}</g>)
    }
}

impl<'a, 'c, 'm> Draw<'a, 'c, 'm> {
    /// A solid with lit faces: back faces culled, far faces first, each shaded by a key
    /// light (`light: [x, y, z]`, toward the viewer is +z) over an ambient fill, with a
    /// specular glint and thin highlighted edges. Faces appear one after another as it draws.
    #[allow(clippy::too_many_arguments)]
    fn lit_solid(
        &self,
        el: &Value,
        shade: &Value,
        verts: &[[f32; 3]],
        rotated: &[[f32; 3]],
        projected: &[(f32, f32, f32)],
        draw: f32,
        width: f32,
        defs: &mut Vec<Svgr<'a>>,
    ) -> Svgr<'a> {
        let mut hex = |v: Option<&Value>, fallback: &str| {
            let c = self.paint(v, fallback, defs);
            if c.starts_with('#') { c } else { self.p.accent.clone() }
        };
        let base = hex(el.get("fill").filter(|v| *v != "none").or(el.get("stroke")), "accent");
        let edge_color = crate::design::mix(&base, "#ffffff", 0.55);
        let light = {
            let l = arr(shade, "light");
            let v: [f32; 3] = if l.len() == 3 {
                std::array::from_fn(|i| l[i].as_f64().unwrap_or(0.0) as f32)
            } else {
                [-0.45, -0.65, 0.75]
            };
            let n = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt().max(1e-3);
            [v[0] / n, v[1] / n, v[2] / n]
        };
        let ambient = f(shade, "ambient", 0.22).clamp(0.0, 1.0);
        let edges = shade.get("edges").and_then(Value::as_bool).unwrap_or(true);
        let dot = |a: [f32; 3], b: [f32; 3]| a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        let mut faces: Vec<(f32, Svgr<'a>)> = vec![];
        let hull = faces_of(verts);
        let total = hull.len().max(1) as f32;
        for (i, face) in hull.iter().enumerate() {
            // The face normal after rotation, from the rotated vertices themselves.
            let c: [f32; 3] =
                std::array::from_fn(|k| face.iter().map(|&v| rotated[v][k]).sum::<f32>() / face.len() as f32);
            let n = {
                let l = dot(c, c).sqrt().max(1e-6);
                [c[0] / l, c[1] / l, c[2] / l]
            };
            if n[2] <= 0.02 {
                continue;
            }
            let reveal = motion::clamp01(draw * total - i as f32);
            if reveal <= 0.0 {
                continue;
            }
            let diffuse = dot(n, light).max(0.0);
            let lit = ambient + (1.0 - ambient) * diffuse;
            // Blinn-Phong glint toward the viewer.
            let half = {
                let h = [light[0], light[1], light[2] + 1.0];
                let l = dot(h, h).sqrt().max(1e-6);
                [h[0] / l, h[1] / l, h[2] / l]
            };
            let glint = dot(n, half).max(0.0).powf(24.0);
            let fill = crate::design::mix(&crate::design::mix("#000000", &base, lit.min(1.0)), "#ffffff", glint * 0.6);
            let points = face
                .iter()
                .map(|&v| format!("{:.2},{:.2}", projected[v].0, projected[v].1))
                .collect::<Vec<_>>()
                .join(" ");
            let node = if edges {
                fframes::svgr!(<polygon points={points} fill={fill} stroke={edge_color.clone()} stroke-width={width * 0.6} stroke-opacity="0.55" stroke-linejoin="round" opacity={reveal} />)
            } else {
                fframes::svgr!(<polygon points={points} fill={fill} opacity={reveal} />)
            };
            faces.push((c[2], node));
        }
        faces.sort_by(|a, b| a.0.total_cmp(&b.0));
        let nodes: Vec<Svgr<'a>> = faces.into_iter().map(|(_, n)| n).collect();
        fframes::svgr!(<g>{nodes}</g>)
    }
}

/// Faces of a convex solid with vertices on the unit sphere: every plane through three
/// vertices with all the others behind it, merged into one polygon per plane and ordered
/// around its centre.
fn faces_of(v: &[[f32; 3]]) -> Vec<Vec<usize>> {
    let sub = |a: [f32; 3], b: [f32; 3]| [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    let cross =
        |a: [f32; 3], b: [f32; 3]| [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    let dot = |a: [f32; 3], b: [f32; 3]| a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    let n = v.len();
    let mut normals: Vec<[f32; 3]> = vec![];
    let mut faces = vec![];
    for i in 0..n {
        for j in i + 1..n {
            for k in j + 1..n {
                let c = cross(sub(v[j], v[i]), sub(v[k], v[i]));
                let len = dot(c, c).sqrt();
                if len < 1e-6 {
                    continue;
                }
                let mut nrm = [c[0] / len, c[1] / len, c[2] / len];
                let mut d = dot(nrm, v[i]);
                if d < 0.0 {
                    nrm = [-nrm[0], -nrm[1], -nrm[2]];
                    d = -d;
                }
                if v.iter().any(|p| dot(nrm, *p) > d + 1e-4) || normals.iter().any(|m| dot(*m, nrm) > 0.9999) {
                    continue;
                }
                normals.push(nrm);
                let on: Vec<usize> = (0..n).filter(|&q| (dot(nrm, v[q]) - d).abs() < 1e-4).collect();
                let centre: [f32; 3] =
                    std::array::from_fn(|a| on.iter().map(|&q| v[q][a]).sum::<f32>() / on.len() as f32);
                let u = sub(v[on[0]], centre);
                let w = cross(nrm, u);
                let mut ordered = on.clone();
                ordered.sort_by(|&a, &b| {
                    let (pa, pb) = (sub(v[a], centre), sub(v[b], centre));
                    dot(pa, w).atan2(dot(pa, u)).total_cmp(&dot(pb, w).atan2(dot(pb, u)))
                });
                faces.push(ordered);
            }
        }
    }
    faces
}

/// Unit-radius vertices of the regular solids.
fn polyhedron(shape: &str) -> Vec<[f32; 3]> {
    let phi = (1.0 + 5f32.sqrt()) / 2.0;
    let mut v: Vec<[f32; 3]> = match shape {
        "tetra" => vec![[1.0, 1.0, 1.0], [1.0, -1.0, -1.0], [-1.0, 1.0, -1.0], [-1.0, -1.0, 1.0]],
        "cube" => (0..8)
            .map(|i| {
                [
                    if i & 1 == 0 { -1.0 } else { 1.0 },
                    if i & 2 == 0 { -1.0 } else { 1.0 },
                    if i & 4 == 0 { -1.0 } else { 1.0 },
                ]
            })
            .collect(),
        "octa" => vec![
            [1.0, 0.0, 0.0],
            [-1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, -1.0, 0.0],
            [0.0, 0.0, 1.0],
            [0.0, 0.0, -1.0],
        ],
        "dodeca" => {
            let mut v: Vec<[f32; 3]> = (0..8)
                .map(|i| {
                    [
                        if i & 1 == 0 { -1.0 } else { 1.0 },
                        if i & 2 == 0 { -1.0 } else { 1.0 },
                        if i & 4 == 0 { -1.0 } else { 1.0 },
                    ]
                })
                .collect();
            for a in [-1.0, 1.0] {
                for b in [-1.0, 1.0] {
                    v.push([0.0, a / phi, b * phi]);
                    v.push([a / phi, b * phi, 0.0]);
                    v.push([a * phi, 0.0, b / phi]);
                }
            }
            v
        }
        _ => {
            let mut v = vec![];
            for a in [-1.0, 1.0] {
                for b in [-1.0, 1.0] {
                    v.push([0.0, a, b * phi]);
                    v.push([a, b * phi, 0.0]);
                    v.push([a * phi, 0.0, b]);
                }
            }
            v
        }
    };
    for p in &mut v {
        let l = (p[0] * p[0] + p[1] * p[1] + p[2] * p[2]).sqrt();
        *p = [p[0] / l, p[1] / l, p[2] / l];
    }
    v
}

/// Edges of a regular solid: every pair of vertices at the shortest distance.
fn edges_of(v: &[[f32; 3]]) -> Vec<(usize, usize)> {
    let d = |a: [f32; 3], b: [f32; 3]| ((a[0] - b[0]).powi(2) + (a[1] - b[1]).powi(2) + (a[2] - b[2]).powi(2)).sqrt();
    let mut min = f32::MAX;
    for i in 0..v.len() {
        for j in i + 1..v.len() {
            min = min.min(d(v[i], v[j]));
        }
    }
    let mut out = vec![];
    for i in 0..v.len() {
        for j in i + 1..v.len() {
            if d(v[i], v[j]) < min * 1.01 {
                out.push((i, j));
            }
        }
    }
    out
}
