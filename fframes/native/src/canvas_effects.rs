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
                        hatch.push_str(&rough_contour(&seg, amount * 0.5, seed ^ salt));
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
