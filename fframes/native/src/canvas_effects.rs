//! Canvas effects: hand-drawn (rough) strokes with hachure, audio meters and the morph that
//! carries an element across a cut.
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
        let contours = contours_of(el);
        let ink = if stroke != "none" {
            stroke.to_owned()
        } else if fill != "none" {
            fill.to_owned()
        } else {
            self.p.ink.clone()
        };
        let length: f32 = contours
            .iter()
            .map(|(c, _)| c.windows(2).map(|w| (w[1].0 - w[0].0).hypot(w[1].1 - w[0].1)).sum::<f32>())
            .sum::<f32>()
            * 1.08
            + 2.0 * amount;
        let dash = if draw < 0.999 {
            (format!("{} {}", length, length * 2.0 + 10.0), length * (1.0 - draw))
        } else {
            ("none".to_owned(), 0.0)
        };
        let mut nodes = vec![];
        let closed = contours.iter().any(|(_, closed)| *closed);
        let fill_mode = nonempty(s(rough, "fill"), "hachure");
        if fill != "none" && closed && draw > 0.55 {
            let alpha = motion::clamp01((draw - 0.55) / 0.45);
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
            if fill_mode == "solid" {
                nodes
                    .push(fframes::svgr!(<path d={crisp} fill={fill.to_owned()} fill-opacity={alpha} stroke="none" />));
            } else {
                let (bx, by, bw, bh) = bounds(el);
                let gap = f(rough, "gap", 11.0).max(3.0);
                let angle = f(rough, "angle", -41.0).to_radians();
                let (dx, dy) = (angle.cos(), angle.sin());
                let reach = bw.hypot(bh);
                let (cx, cy) = (bx + bw / 2.0, by + bh / 2.0);
                let count = (reach / gap).ceil() as i32;
                let mut hatch = String::new();
                for k in -count / 2..=count / 2 {
                    let off = k as f32 * gap;
                    let (ox, oy) = (cx - dy * off, cy + dx * off);
                    let line = [
                        (ox - dx * reach / 2.0, oy - dy * reach / 2.0),
                        (ox + dx * reach / 2.0, oy + dy * reach / 2.0),
                    ];
                    hatch.push_str(&rough_contour(&line, amount * 0.5, seed ^ (k as u64).wrapping_mul(31)));
                    hatch.push(' ');
                }
                let id = self.uid("hatch");
                nodes.push(fframes::svgr!(<g>
                    <defs><clipPath id={id.clone()}><path d={crisp} /></clipPath></defs>
                    <g clip-path={format!("url(#{id})")} opacity={alpha}><path d={hatch} fill="none" stroke={fill.to_owned()} stroke-width={f(rough, "hatchWidth", (width * 0.55).max(1.5))} stroke-linecap="round" /></g>
                </g>));
            }
        }
        for pass in 0..passes {
            let d = contours
                .iter()
                .map(|(c, _)| rough_contour(c, amount, seed.wrapping_add(pass as u64 * 0x51_7CC1_B727_220A)))
                .collect::<Vec<_>>()
                .join(" ");
            let w = width * if pass == 0 { 1.0 } else { 0.7 };
            nodes.push(fframes::svgr!(<path d={d} fill="none" stroke={ink.clone()} stroke-width={w} stroke-dasharray={dash.0.clone()} stroke-dashoffset={dash.1} stroke-linecap="round" stroke-linejoin="round" opacity={if pass == 0 { 1.0 } else { 0.75 }} />));
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
