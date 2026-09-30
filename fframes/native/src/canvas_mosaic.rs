//! Mosaic: shapes laid in tesserae. A filled shape becomes small square tiles on a grout bed,
//! laid in running-bond rows or concentric rings (the andamento follows the form), with an
//! outline row tracing its contour; a stroke becomes a beaded line of tiles. Every tile has
//! its own shade, a small shine and a place in the build order, so shapes can assemble tile
//! by tile and scatter back into loose tesserae. Layouts depend only on the element and its
//! seed, and are cached; tiles are batched by colour into a handful of paths per element.
use super::*;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, OnceLock};

#[derive(Clone, Copy)]
struct Tile {
    x: f32,
    y: f32,
    angle: f32,
    w: f32,
    h: f32,
    /// -1..1 lightness offset.
    shade: f32,
    /// 0..1 place in the build order.
    order: f32,
    /// 0 = fill, 1 = outline / stroke.
    class: u8,
    /// 0..1 position along the fill gradient axis.
    along: f32,
}

struct Layout {
    tiles: Vec<Tile>,
    cx: f32,
    cy: f32,
    grout: String,
}

fn layouts() -> &'static Mutex<HashMap<u64, Arc<Layout>>> {
    static CACHE: OnceLock<Mutex<HashMap<u64, Arc<Layout>>>> = OnceLock::new();
    CACHE.get_or_init(Default::default)
}

fn unit(seed: u64, i: u64) -> f32 {
    noise(seed, i) * 0.5 + 0.5
}

/// Distance from a point to a closed or open polyline.
fn distance(p: (f32, f32), line: &[(f32, f32)], closed: bool) -> f32 {
    let n = line.len();
    let segs = if closed { n } else { n.saturating_sub(1) };
    let mut best = f32::MAX;
    for i in 0..segs {
        let (a, b) = (line[i], line[(i + 1) % n]);
        let (dx, dy) = (b.0 - a.0, b.1 - a.1);
        let len2 = dx * dx + dy * dy;
        let t = if len2 > 0.0 { (((p.0 - a.0) * dx + (p.1 - a.1) * dy) / len2).clamp(0.0, 1.0) } else { 0.0 };
        best = best.min((p.0 - a.0 - t * dx).hypot(p.1 - a.1 - t * dy));
    }
    best
}

/// Even-odd point in polygon over every closed contour.
fn inside(p: (f32, f32), contours: &[(Vec<(f32, f32)>, bool)]) -> bool {
    let mut odd = false;
    for (c, closed) in contours {
        if !closed || c.len() < 3 {
            continue;
        }
        let n = c.len();
        for i in 0..n {
            let (a, b) = (c[i], c[(i + 1) % n]);
            if (a.1 > p.1) != (b.1 > p.1) && p.0 < a.0 + (p.1 - a.1) / (b.1 - a.1) * (b.0 - a.0) {
                odd = !odd;
            }
        }
    }
    odd
}

/// Tiles laid along a polyline every `pitch`, turned to its direction.
fn along_line(line: &[(f32, f32)], closed: bool, pitch: f32, mut push: impl FnMut((f32, f32), f32, f32)) {
    let mut pts = line.to_vec();
    if closed && pts.first() != pts.last() {
        pts.push(pts[0]);
    }
    let total: f32 = pts.windows(2).map(|w| (w[1].0 - w[0].0).hypot(w[1].1 - w[0].1)).sum();
    if total <= 0.0 {
        return;
    }
    let count = (total / pitch).round().max(1.0) as usize;
    let step = total / count as f32;
    let (mut seg, mut acc) = (0usize, 0.0f32);
    for k in 0..count + usize::from(!closed) {
        let target = (k as f32 * step).min(total - 1e-3);
        while seg + 2 < pts.len() && acc + (pts[seg + 1].0 - pts[seg].0).hypot(pts[seg + 1].1 - pts[seg].1) < target {
            acc += (pts[seg + 1].0 - pts[seg].0).hypot(pts[seg + 1].1 - pts[seg].1);
            seg += 1;
        }
        let (a, b) = (pts[seg], pts[seg + 1]);
        let len = (b.0 - a.0).hypot(b.1 - a.1).max(1e-6);
        let t = ((target - acc) / len).clamp(0.0, 1.0);
        push((a.0 + (b.0 - a.0) * t, a.1 + (b.1 - a.1) * t), (b.1 - a.1).atan2(b.0 - a.0), target / total);
    }
}

fn lay(el: &Value, spec: &Value, seed: u64, filled: bool) -> Layout {
    let size = f(spec, "tile", 16.0).clamp(3.0, 200.0);
    let gap = f(spec, "gap", (size * 0.16).max(1.0)).clamp(0.0, size);
    let jitter = f(spec, "jitter", 0.5).clamp(0.0, 1.0);
    let pitch = size + gap;
    let contours = contours_of(el);
    let (bx, by, bw, bh) = bounds(el);
    let (cx, cy) = (bx + bw / 2.0, by + bh / 2.0);
    let closed = contours.iter().any(|(_, c)| *c);
    let mut tiles = vec![];
    let mut k = 0u64;
    let mut tile = |x: f32, y: f32, angle: f32, class: u8, order: f32| {
        k += 1;
        let j = |i: u64| noise(seed, k * 16 + i) * jitter;
        tiles.push(Tile {
            x: x + j(1) * gap * 0.35,
            y: y + j(2) * gap * 0.35,
            angle: angle + j(3) * 0.12,
            w: size * (1.0 + j(4) * 0.1),
            h: size * (1.0 + j(5) * 0.1),
            shade: noise(seed, k * 16 + 6),
            order,
            class,
            along: 0.0,
        });
    };
    let outline_row = spec.get("outline").and_then(Value::as_bool).unwrap_or(true);
    if filled && closed {
        let flow =
            nonempty(s(spec, "flow"), if matches!(s(el, "type"), "circle" | "ellipse") { "rings" } else { "rows" });
        let margin = if outline_row { pitch * 0.92 } else { size * 0.5 };
        let keep = |x: f32, y: f32| {
            inside((x, y), &contours)
                && contours.iter().filter(|(_, c)| *c).all(|(c, _)| distance((x, y), c, true) >= margin)
        };
        // Build order: an organic sweep, or rings from the centre out.
        let sweep = |x: f32, y: f32, i: u64| match s(spec, "build") {
            "radial" => ((x - cx).hypot(y - cy) / (bw.max(bh) * 0.5).max(1.0)).min(1.0),
            "random" => unit(seed, 9000 + i),
            _ => (0.75 * (x - bx) / bw.max(1.0) + 0.25 * (y - by) / bh.max(1.0)) * 0.8 + 0.2 * unit(seed, 9000 + i),
        };
        if flow == "rings" {
            let (rx, ry) = (bw / 2.0, bh / 2.0);
            let r_max = rx.max(ry).max(1.0);
            let mut ring = 0;
            loop {
                let r = r_max - margin - ring as f32 * pitch;
                if r < pitch * 0.45 {
                    if keep(cx, cy) {
                        tile(cx, cy, 0.0, 0, 0.0);
                    }
                    break;
                }
                let n = ((TAU * r) / pitch).floor().max(1.0) as usize;
                let offset = unit(seed, 500 + ring as u64) * TAU;
                for i in 0..n {
                    let a = offset + i as f32 / n as f32 * TAU;
                    let (x, y) = (cx + r / r_max * rx * a.cos(), cy + r / r_max * ry * a.sin());
                    if keep(x, y) {
                        let u = sweep(x, y, i as u64 + ring as u64 * 997);
                        tile(x, y, a + PI / 2.0, 0, u);
                    }
                }
                ring += 1;
            }
        } else {
            let rows = (bh / pitch).ceil() as i32 + 1;
            let cols = (bw / pitch).ceil() as i32 + 2;
            for r in 0..rows {
                let y = by + (r as f32 + 0.5) * pitch;
                let shift = if r % 2 == 1 { pitch * 0.5 } else { 0.0 };
                for c in -1..cols {
                    let x = bx + (c as f32 + 0.5) * pitch + shift;
                    if keep(x, y) {
                        let u = sweep(x, y, (r * 4099 + c) as u64);
                        tile(x, y, 0.0, 0, u);
                    }
                }
            }
        }
        if outline_row {
            for (c, is_closed) in &contours {
                if *is_closed {
                    along_line(c, true, pitch, |(x, y), a, t| tile(x, y, a, 1, t * 0.4));
                }
            }
        }
    } else {
        // A beaded line: tiles along every contour, built in drawing order.
        for (c, is_closed) in &contours {
            along_line(c, *is_closed, pitch, |(x, y), a, t| tile(x, y, a, 1, t));
        }
    }
    let grout = if filled && closed {
        contours
            .iter()
            .filter(|(_, c)| *c)
            .map(|(c, _)| {
                c.iter()
                    .enumerate()
                    .map(|(i, p)| format!("{}{:.1} {:.1}", if i == 0 { "M" } else { "L" }, p.0, p.1))
                    .collect::<String>()
                    + "Z"
            })
            .collect::<String>()
    } else {
        String::new()
    };
    // Gradient position of each tile along the fill's axis (angle in degrees, like `paint`).
    let angle = spec.get("axis").and_then(Value::as_f64).unwrap_or(90.0) as f32 * PI / 180.0;
    let (ax, ay) = (angle.cos(), angle.sin());
    let reach = (bw * ax.abs() + bh * ay.abs()).max(1.0);
    for t in &mut tiles {
        t.along = (((t.x - cx) * ax + (t.y - cy) * ay) / reach + 0.5).clamp(0.0, 1.0);
    }
    Layout { tiles, cx, cy, grout }
}

impl<'a, 'c, 'm> Draw<'a, 'c, 'm> {
    /// Render an element as a mosaic. `assemble` (0..1) builds it tile by tile, `draw` lays a
    /// beaded line along its path, `scatter` (0..1) throws the tiles loose.
    #[allow(clippy::too_many_arguments)]
    pub(super) fn mosaic(
        &self,
        el: &Value,
        spec: &Value,
        fill: &str,
        stroke: &str,
        draw: f32,
        assemble: f32,
        scatter: f32,
    ) -> Svgr<'a> {
        use std::hash::{Hash, Hasher};
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        el.to_string().hash(&mut hasher);
        let seed = hasher.finish() ^ (n(spec, "seed", 0.0) as u64).wrapping_mul(0x9E37_79B9);
        let filled = fill != "none" && !fill.starts_with("url(");
        let gradient = el.get("fill").filter(|v| v.is_object());
        let filled = filled || gradient.is_some();
        let layout = {
            let hit = layouts().lock().unwrap().get(&seed).cloned();
            match hit {
                Some(l) => l,
                None => {
                    let l = Arc::new(lay(el, spec, seed, filled));
                    let mut map = layouts().lock().unwrap();
                    if map.len() > 512 {
                        map.clear();
                    }
                    map.insert(seed, l.clone());
                    l
                }
            }
        };
        // Colours: the fill (or gradient stops) for the body, the stroke for outline and beads.
        let stops: Vec<String> = gradient
            .and_then(|g| g.get("gradient"))
            .and_then(Value::as_array)
            .map(|a| {
                a.iter().map(|v| self.paint(Some(v), "accent", &mut vec![])).filter(|c| c.starts_with('#')).collect()
            })
            .unwrap_or_default();
        let body = if fill.starts_with('#') {
            fill.to_owned()
        } else {
            stops.first().cloned().unwrap_or(self.p.accent.clone())
        };
        let line = if stroke.starts_with('#') { stroke.to_owned() } else { crate::design::mix(&body, "#000000", 0.35) };
        let grout = spec
            .get("grout")
            .map(|g| self.paint(Some(g), "bg", &mut vec![]))
            .unwrap_or_else(|| crate::design::mix(&body, "#000000", 0.62));
        let depth = f(spec, "shade", 0.22).clamp(0.0, 0.6);
        let shine = f(spec, "shine", 0.35).clamp(0.0, 1.0);
        let base_for = |t: &Tile| -> String {
            if t.class == 1 {
                return line.clone();
            }
            if stops.len() >= 2 {
                let x = t.along * (stops.len() - 1) as f32;
                let i = (x.floor() as usize).min(stops.len() - 2);
                crate::design::mix(&stops[i], &stops[i + 1], ((x - i as f32) * 6.0).round() / 6.0)
            } else {
                body.clone()
            }
        };
        let mut buckets: HashMap<(String, i8), String> = HashMap::new();
        let mut shines = String::new();
        let quad = |x: f32, y: f32, w: f32, h: f32, a: f32, out: &mut String| {
            let (c, s) = (a.cos(), a.sin());
            for (i, (u, v)) in [(-0.5, -0.5), (0.5, -0.5), (0.5, 0.5), (-0.5, 0.5)].into_iter().enumerate() {
                let (px, py) = (x + (u * w) * c - (v * h) * s, y + (u * w) * s + (v * h) * c);
                out.push_str(&format!("{}{:.1} {:.1}", if i == 0 { "M" } else { "L" }, px, py));
            }
            out.push('Z');
        };
        for (i, t) in layout.tiles.iter().enumerate() {
            // Build: each tile pops in over the last 30% of its window; a beaded line follows
            // the draw-on; scatter throws tiles outward, spinning, as they shrink.
            let p = motion::clamp01((assemble - t.order * 0.7) / 0.3).min(if t.class == 1 && !filled {
                motion::clamp01((draw - t.order) * 8.0 + 1.0)
            } else {
                1.0
            });
            if p <= 0.001 {
                continue;
            }
            let pop = motion::out_back(p);
            let (mut x, mut y, mut a, mut k) = (t.x, t.y, t.angle, pop);
            if scatter > 0.0 {
                let h = unit(t.order.to_bits() as u64 ^ i as u64, 77);
                let (dx, dy) = (t.x - layout.cx, t.y - layout.cy);
                let len = dx.hypot(dy).max(1.0);
                let q = motion::in_cubic(scatter);
                let dist = (80.0 + 260.0 * h) * q;
                x += dx / len * dist + noise(i as u64, 3) * 40.0 * q;
                y += dy / len * dist + 180.0 * q * q;
                a += noise(i as u64, 5) * 3.0 * q;
                k *= 1.0 - 0.7 * q;
            }
            if k <= 0.01 {
                continue;
            }
            let level = (t.shade * 2.0).round().clamp(-2.0, 2.0) as i8;
            let key = (base_for(t), level);
            quad(x, y, t.w * k, t.h * k, a, buckets.entry(key).or_default());
            if shine > 0.0 && t.shade > -0.4 {
                // A small highlight on the upper-left of the tile: glass catching the light.
                let (c, s) = (a.cos(), a.sin());
                let (ox, oy) = (-0.2 * t.w * k, -0.2 * t.h * k);
                quad(x + ox * c - oy * s, y + ox * s + oy * c, t.w * k * 0.38, t.h * k * 0.2, a, &mut shines);
            }
        }
        let mut nodes = vec![];
        if !layout.grout.is_empty() {
            let bed = motion::clamp01(assemble * 3.0) * (1.0 - scatter).max(0.0);
            if bed > 0.0 {
                nodes.push(fframes::svgr!(<path d={layout.grout.clone()} fill={grout.clone()} opacity={bed} />));
            }
        }
        let mut keys: Vec<_> = buckets.into_iter().collect();
        keys.sort_by(|a, b| a.0.cmp(&b.0));
        for ((base, level), d) in keys {
            let tone = level as f32 / 2.0 * depth;
            let color = if tone >= 0.0 {
                crate::design::mix(&base, "#ffffff", tone)
            } else {
                crate::design::mix(&base, "#000000", -tone)
            };
            nodes.push(fframes::svgr!(<path d={d} fill={color} />));
        }
        if !shines.is_empty() {
            nodes.push(fframes::svgr!(<path d={shines} fill="#ffffff" opacity={shine * 0.45} />));
        }
        let fade = 1.0 - scatter * scatter;
        fframes::svgr!(<g opacity={fade}>{nodes}</g>)
    }
}
