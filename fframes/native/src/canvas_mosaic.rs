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
    /// Corner offsets (tile-local fractions): hand-cut, slanted edges.
    cut: [(f32, f32); 4],
    /// One tile in ~25 is a paler piece.
    pale: bool,
}

struct Layout {
    tiles: Vec<Tile>,
    cx: f32,
    cy: f32,
    gap: f32,
    /// The shape's own outline, the grout bed of a settled filled shape (empty for beads).
    outline: String,
    /// Bounds (x, y, w, h), for fronts that sweep across the shape.
    bounds: (f32, f32, f32, f32),
}

fn layouts() -> &'static Mutex<HashMap<u64, Arc<Layout>>> {
    static CACHE: OnceLock<Mutex<HashMap<u64, Arc<Layout>>>> = OnceLock::new();
    CACHE.get_or_init(Default::default)
}

/// Settled mosaics draw the same paths every frame: cache them per element and colours.
type Parts = Arc<Vec<(String, f32, String)>>;
fn statics() -> &'static Mutex<HashMap<u64, Parts>> {
    static CACHE: OnceLock<Mutex<HashMap<u64, Parts>>> = OnceLock::new();
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

/// Nearest point on any closed contour: (distance, unit vector from that point to `p`,
/// tangent angle of the edge there).
fn nearest(p: (f32, f32), contours: &[(Vec<(f32, f32)>, bool)]) -> (f32, (f32, f32), f32) {
    let mut best = (f32::MAX, (0.0, 0.0), 0.0);
    for (line, closed) in contours {
        if !closed || line.len() < 2 {
            continue;
        }
        let n = line.len();
        for i in 0..n {
            let (a, b) = (line[i], line[(i + 1) % n]);
            let (dx, dy) = (b.0 - a.0, b.1 - a.1);
            let len2 = dx * dx + dy * dy;
            if len2 <= 0.0 {
                continue;
            }
            let t = (((p.0 - a.0) * dx + (p.1 - a.1) * dy) / len2).clamp(0.0, 1.0);
            let (qx, qy) = (a.0 + t * dx, a.1 + t * dy);
            let d = (p.0 - qx).hypot(p.1 - qy);
            if d < best.0 {
                let dir = if d > 1e-4 { ((p.0 - qx) / d, (p.1 - qy) / d) } else { (0.0, 0.0) };
                best = (d, dir, dy.atan2(dx));
            }
        }
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

fn lay(el: &Value, spec: &Value, seed: u64, filled: bool, occluders: &[Vec<(f32, f32)>]) -> Layout {
    let (_, _, area_w, area_h) = bounds(el);
    // At most ~12,000 tiles per shape: a huge shape gets bigger tiles rather than a slow frame.
    let asked = f(spec, "tile", 16.0).clamp(3.0, 200.0);
    let size = asked.max((area_w * area_h / 12_000.0).sqrt() * 0.86);
    let gap = f(spec, "gap", (size * 0.16).max(1.0)).clamp(0.0, size);
    // Pixels and cross-stitches sit on one square grid anchored at the canvas origin, like an
    // LCD or an even-weave cloth, so neighbouring shapes share it.
    let grid = matches!(s(spec, "style"), "pixel" | "stitch");
    let jitter = if grid { 0.0 } else { f(spec, "jitter", 0.5).clamp(0.0, 1.0) };
    let pitch = size + gap;
    let contours = contours_of(el);
    let (bx, by, bw, bh) = bounds(el);
    let (cx, cy) = (bx + bw / 2.0, by + bh / 2.0);
    let closed = contours.iter().any(|(_, c)| *c);
    let mut tiles = vec![];
    let mut k = 0u64;
    // A hand-cut tile: slanted corners, varied width and a slight turn, all from the seed.
    let mut tile = |x: f32, y: f32, angle: f32, class: u8, order: f32, width: Option<f32>| {
        k += 1;
        let j = |i: u64| noise(seed, k * 16 + i) * jitter;
        let c = |i: u64| noise(seed, k * 16 + 8 + i) * jitter * 0.16;
        tiles.push(Tile {
            x: x + j(1) * gap * 0.3,
            y: y + j(2) * gap * 0.3,
            angle: angle + j(3) * 0.14,
            w: width.unwrap_or(size * (1.0 + j(4) * 0.4)).max(size * 0.35),
            h: size * (1.0 + j(5) * 0.24),
            shade: noise(seed, k * 16 + 6),
            order,
            class,
            along: 0.0,
            cut: [(c(0), c(1)), (c(2), c(3)), (c(4), c(5)), (c(6), c(7))],
            pale: !grid && unit(seed, k * 16 + 7) < 0.03,
        });
    };
    let stroked = el.get("stroke").is_some_and(|v| v != "none");
    let outline_row = spec.get("outline").and_then(Value::as_bool).unwrap_or(!grid || stroked);
    if filled && closed {
        let round = matches!(s(el, "type"), "circle" | "ellipse");
        let flow = nonempty(s(spec, "flow"), if round { "rings" } else { "rows" });
        // Interior tiles tuck under the outline row (drawn after them), so no bed shows between.
        let margin = if outline_row { pitch * 0.72 } else { size * 0.3 };
        let keep = |x: f32, y: f32| {
            inside((x, y), &contours)
                && contours.iter().filter(|(_, c)| *c).all(|(c, _)| distance((x, y), c, true) >= margin)
        };
        // Build order: an organic sweep, or rings from the centre out.
        let sweep = |x: f32, y: f32, i: u64| match s(spec, "build") {
            "radial" => ((x - cx).hypot(y - cy) / (bw.max(bh) * 0.5).max(1.0)).min(1.0),
            "random" | "fly" => unit(seed, 9000 + i),
            _ => (0.75 * (x - bx) / bw.max(1.0) + 0.25 * (y - by) / bh.max(1.0)) * 0.8 + 0.2 * unit(seed, 9000 + i),
        };
        if grid {
            // Whole cells whose centres fall inside. With an outline, the cells on the edge
            // take the stroke colour, the way pixel art and samplers outline a figure.
            let at = |c: i32, r: i32| ((c as f32 + 0.5) * pitch, (r as f32 + 0.5) * pitch);
            let ins = |c: i32, r: i32| inside(at(c, r), &contours);
            let (c0, c1) = ((bx / pitch).floor() as i32, ((bx + bw) / pitch).ceil() as i32);
            let (r0, r1) = ((by / pitch).floor() as i32, ((by + bh) / pitch).ceil() as i32);
            for r in r0..r1 {
                for c in c0..c1 {
                    if !ins(c, r) {
                        continue;
                    }
                    let (x, y) = at(c, r);
                    let edge = outline_row && [(1, 0), (-1, 0), (0, 1), (0, -1)].iter().any(|(i, j)| !ins(c + i, r + j));
                    let u = sweep(x, y, ((r - r0) * 4099 + (c - c0)) as u64);
                    tile(x, y, 0.0, edge as u8, if edge { u * 0.4 } else { u }, Some(size));
                }
            }
        } else if flow == "contour" {
            // Andamento: rows run parallel to the outline at whole-pitch depths, each tile
            // turned along the nearest edge; candidates are thinned to an even spacing.
            let step = pitch * 0.3;
            let first = if outline_row { 1.5 } else { 0.5 };
            let mut grid: HashMap<(i32, i32), Vec<(f32, f32)>> = HashMap::new();
            let cell = |x: f32, y: f32| ((x / pitch).floor() as i32, (y / pitch).floor() as i32);
            let (cols, rows) = ((bw / step).ceil() as i32, (bh / step).ceil() as i32);
            for r in 0..=rows {
                for c in 0..=cols {
                    let (x, y) = (bx + c as f32 * step, by + r as f32 * step);
                    if !inside((x, y), &contours) {
                        continue;
                    }
                    let (d, dir, angle) = nearest((x, y), &contours);
                    let ring = ((d / pitch) - first).round().max(0.0);
                    let target = (ring + first) * pitch;
                    let (px, py) = (x + dir.0 * (target - d), y + dir.1 * (target - d));
                    if !inside((px, py), &contours) {
                        continue;
                    }
                    let (gx, gy) = cell(px, py);
                    let crowded = (-1..=1).any(|i| {
                        (-1..=1).any(|j| {
                            grid.get(&(gx + i, gy + j))
                                .is_some_and(|v| v.iter().any(|q| (q.0 - px).hypot(q.1 - py) < pitch * 0.86))
                        })
                    });
                    if crowded {
                        continue;
                    }
                    grid.entry((gx, gy)).or_default().push((px, py));
                    let u = sweep(px, py, (r * 7919 + c) as u64);
                    tile(px, py, angle, 0, u, None);
                }
            }
        } else if flow == "rings" {
            // Wedge rings fitted to each circumference, from just inside the outline row in.
            let (rx, ry) = (bw / 2.0, bh / 2.0);
            let r_max = rx.max(ry).max(1.0);
            let start = if outline_row { r_max - pitch * 1.5 } else { r_max - pitch * 0.5 };
            let mut ring = 0;
            loop {
                let r = start - ring as f32 * pitch;
                if r < pitch * 0.8 {
                    tile(cx, cy, unit(seed, 77) * PI, 0, 0.0, Some(size * 1.1));
                    break;
                }
                let n = ((TAU * r) / pitch).round().max(3.0) as usize;
                let offset = unit(seed, 500 + ring as u64) * TAU;
                let fitted = TAU * r / n as f32 - gap;
                for i in 0..n {
                    let a = offset + i as f32 / n as f32 * TAU;
                    let (x, y) = (cx + r / r_max * rx * a.cos(), cy + r / r_max * ry * a.sin());
                    if round || keep(x, y) {
                        let u = sweep(x, y, i as u64 + ring as u64 * 997);
                        tile(x, y, a + PI / 2.0, 0, u, Some(fitted));
                    }
                }
                ring += 1;
            }
        } else {
            // Running-bond rows, their spacing fitted so the rows fill the shape's height.
            let rows = ((bh / pitch).round() as i32).max(1);
            let row_pitch = bh / rows as f32;
            let cols = (bw / pitch).ceil() as i32 + 2;
            for r in 0..rows {
                let y = by + (r as f32 + 0.5) * row_pitch;
                let shift = if r % 2 == 1 { pitch * 0.5 } else { 0.0 };
                for c in -1..cols {
                    let x = bx + (c as f32 + 0.5) * pitch + shift;
                    if keep(x, y) {
                        let u = sweep(x, y, (r * 4099 + c) as u64);
                        tile(x, y, 0.0, 0, u, None);
                    }
                }
            }
        }
        if outline_row && !grid {
            // The outline row sits half a tile inside the contour, turned along it.
            for (c, is_closed) in &contours {
                if *is_closed {
                    along_line(c, true, pitch, |(x, y), a, t| {
                        let (nx, ny) = (-a.sin(), a.cos());
                        let d = pitch * 0.5;
                        let (px, py) = if inside((x + nx * d, y + ny * d), &contours) {
                            (x + nx * d, y + ny * d)
                        } else {
                            (x - nx * d, y - ny * d)
                        };
                        tile(px, py, a, 1, t * 0.4, Some(size));
                    });
                }
            }
        }
    } else if grid {
        // A stroke rasterized onto the grid, one cell thick: the cells the line passes
        // through, in order, less any corner cell where the line could step diagonally
        // (pixel-perfect, as a pixel artist draws a line).
        let mut seen = std::collections::HashSet::new();
        for (c, is_closed) in &contours {
            let mut cells: Vec<((i32, i32), f32)> = vec![];
            along_line(c, *is_closed, pitch * 0.4, |(x, y), _, t| {
                let cell = ((x / pitch).floor() as i32, (y / pitch).floor() as i32);
                if cells.last().is_none_or(|(last, _)| *last != cell) {
                    cells.push((cell, t));
                }
            });
            let mut thin: Vec<((i32, i32), f32)> = vec![];
            for (i, &(cell, t)) in cells.iter().enumerate() {
                let (Some(&(prev, _)), Some(&(next, _))) = (thin.last(), cells.get(i + 1)) else {
                    thin.push((cell, t));
                    continue;
                };
                let diagonal = (prev.0 - next.0).abs() == 1 && (prev.1 - next.1).abs() == 1;
                if !diagonal {
                    thin.push((cell, t));
                }
            }
            for (cell, t) in thin {
                if seen.insert(cell) {
                    tile((cell.0 as f32 + 0.5) * pitch, (cell.1 as f32 + 0.5) * pitch, 0.0, 1, t, Some(size));
                }
            }
        }
    } else {
        // A beaded line: tiles along every contour, built in drawing order.
        for (c, is_closed) in &contours {
            along_line(c, *is_closed, pitch, |(x, y), a, t| tile(x, y, a, 1, t, Some(size)));
        }
    }
    // Knockout and halo: shapes laid over this one remove the tiles beneath them (keeping a
    // grout line), and the nearest `halo` rows bend around their outlines.
    if !occluders.is_empty() && filled {
        let occ: Vec<(Vec<(f32, f32)>, bool)> = occluders.iter().map(|c| (c.clone(), true)).collect();
        // A grid keeps its cells in place: a shape over pixels or stitches only removes them.
        let halo = if grid { 0.0 } else { f(spec, "halo", 2.0).clamp(0.0, 6.0) };
        let mut kept: Vec<Tile> = vec![];
        let mut rest: Vec<Tile> = vec![];
        for mut t in tiles.drain(..) {
            if t.class == 1 {
                rest.push(t);
                continue;
            }
            if occ.iter().any(|o| inside((t.x, t.y), std::slice::from_ref(o))) {
                continue;
            }
            if grid {
                // Cells abut: the shape over the grid takes exactly the cells it covers.
                rest.push(t);
                continue;
            }
            let (d, dir, angle) = nearest((t.x, t.y), &occ);
            if d < pitch * 0.55 {
                continue;
            }
            if d < (halo + 0.5) * pitch {
                let ring = (d / pitch - 0.6).round().max(0.0);
                let target = (ring + 0.6) * pitch;
                t.x += dir.0 * (target - d);
                t.y += dir.1 * (target - d);
                t.angle = angle;
                kept.push(t);
            } else {
                rest.push(t);
            }
        }
        // Halo tiles first, then the rest, each only where there is room.
        let mut grid: HashMap<(i32, i32), Vec<(f32, f32)>> = HashMap::new();
        let cell = |x: f32, y: f32| ((x / pitch).floor() as i32, (y / pitch).floor() as i32);
        for t in kept.into_iter().chain(rest) {
            if t.class == 0 {
                let (gx, gy) = cell(t.x, t.y);
                let crowded = (-1..=1).any(|i| {
                    (-1..=1).any(|j| {
                        grid.get(&(gx + i, gy + j))
                            .is_some_and(|v| v.iter().any(|q| (q.0 - t.x).hypot(q.1 - t.y) < pitch * 0.9))
                    })
                });
                if crowded {
                    continue;
                }
                grid.entry((gx, gy)).or_default().push((t.x, t.y));
            }
            tiles.push(t);
        }
    }
    // Gradient position of each tile along the fill's axis (angle in degrees, like `paint`).
    let angle = spec.get("axis").and_then(Value::as_f64).unwrap_or(90.0) as f32 * PI / 180.0;
    let (ax, ay) = (angle.cos(), angle.sin());
    let reach = (bw * ax.abs() + bh * ay.abs()).max(1.0);
    for t in &mut tiles {
        t.along = (((t.x - cx) * ax + (t.y - cy) * ay) / reach + 0.5).clamp(0.0, 1.0);
    }
    let outline = if filled && closed {
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
    Layout { tiles, cx, cy, gap, outline, bounds: (bx, by, bw, bh) }
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
        now: f32,
    ) -> Svgr<'a> {
        use std::hash::{Hash, Hasher};
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        el.to_string().hash(&mut hasher);
        let seed = hasher.finish() ^ (n(spec, "seed", 0.0) as u64).wrapping_mul(0x9E37_79B9);
        let filled = fill != "none" && !fill.starts_with("url(");
        let gradient = el.get("fill").filter(|v| v.is_object());
        let filled = filled || gradient.is_some();
        let occluders = self.occluders.borrow().get(&(el as *const Value as usize)).cloned().unwrap_or_default();
        let lkey = {
            let mut h = std::collections::hash_map::DefaultHasher::new();
            seed.hash(&mut h);
            for c in &occluders {
                for (x, y) in c {
                    (x.to_bits(), y.to_bits()).hash(&mut h);
                }
            }
            h.finish()
        };
        let layout = {
            let hit = layouts().lock().unwrap().get(&lkey).cloned();
            match hit {
                Some(l) => l,
                None => {
                    let l = Arc::new(lay(el, spec, seed, filled, &occluders));
                    let mut map = layouts().lock().unwrap();
                    if map.len() > 512 {
                        map.clear();
                    }
                    map.insert(lkey, l.clone());
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
        // One dark bed under every tile of the film, not a tinted copy of each shape.
        let grout = spec
            .get("grout")
            .map(|g| self.paint(Some(g), "bg", &mut vec![]))
            .unwrap_or_else(|| crate::design::mix(&self.p.bg, "#000000", if self.p.dark { 0.72 } else { 0.5 }));
        let style = s(spec, "style");
        let (stitch, grid) = (style == "stitch", matches!(style, "pixel" | "stitch"));
        // Pixels are flat and even; stitches have sheen on their top legs.
        let depth = f(spec, "shade", if style == "pixel" { 0.04 } else { 0.14 }).clamp(0.0, 0.6);
        let shine = f(spec, "shine", match style {
            "pixel" => 0.0,
            "stitch" => 0.5,
            _ => 0.35,
        })
        .clamp(0.0, 1.0);
        // Glints: each tile catches the light briefly on its own slow rhythm, so a held mosaic
        // shimmers. A pure function of time and the tile's seed.
        let glint = f(spec, "glint", 0.0).clamp(0.0, 1.0);
        let mut glints = [String::new(), String::new(), String::new()];
        let base_for = |t: &Tile| -> String {
            if t.class == 1 {
                return line.clone();
            }
            if stops.len() >= 2 {
                let x = t.along * (stops.len() - 1) as f32;
                let i = (x.floor() as usize).min(stops.len() - 2);
                crate::design::mix(&stops[i], &stops[i + 1], ((x - i as f32) * 24.0).round() / 24.0)
            } else {
                body.clone()
            }
        };
        // Recolour fronts: a sweeping edge flips tiles to new colours (day into night), or only
        // a seeded `share` of them (12% of the tiles turn red). Each tile turns edge-on as the
        // front passes and shows its new face on the way back.
        struct Front {
            at: f32,
            dur: f32,
            axis: (f32, f32),
            share: f32,
            stops: Vec<String>,
        }
        let fronts: Vec<Front> = arr(spec, "recolor")
            .iter()
            .map(|r| {
                let a = f(r, "axis", 0.0) * PI / 180.0;
                let stops: Vec<String> = match r.get("fill") {
                    Some(Value::Object(g)) => g
                        .get("gradient")
                        .and_then(Value::as_array)
                        .map(|a| a.iter().map(|v| self.paint(Some(v), "accent", &mut vec![])).collect())
                        .unwrap_or_default(),
                    other => vec![self.paint(other, "accent", &mut vec![])],
                };
                Front {
                    at: f(r, "at", 0.0),
                    dur: f(r, "dur", 1.2).max(0.01),
                    axis: (a.cos(), a.sin()),
                    share: f(r, "share", 1.0),
                    stops,
                }
            })
            .collect();
        let (lx, ly, lw, lh) = layout.bounds;
        // (colour, flip scale) of a tile at this moment, after every front that has reached it.
        let face = |i: usize, t: &Tile| -> (String, f32) {
            let mut color = base_for(t);
            let mut squash = 1.0f32;
            if t.class == 1 {
                return (color, squash);
            }
            for fr in &fronts {
                if fr.share < 1.0 && unit(seed ^ 0x3F, i as u64) >= fr.share {
                    continue;
                }
                let reach = (lw * fr.axis.0.abs() + lh * fr.axis.1.abs()).max(1.0);
                let u = (((t.x - lx - lw / 2.0) * fr.axis.0 + (t.y - ly - lh / 2.0) * fr.axis.1) / reach + 0.5)
                    .clamp(0.0, 1.0);
                // The front crosses the shape over 80% of `dur`; each tile flips in the next 20%.
                let local = motion::clamp01(((now - fr.at) / fr.dur - u * 0.8) / 0.2);
                if local <= 0.0 {
                    continue;
                }
                squash = (PI * local).cos().abs().max(0.08);
                if local >= 0.5 {
                    color = if fr.stops.len() >= 2 {
                        let x = t.along * (fr.stops.len() - 1) as f32;
                        let k = (x.floor() as usize).min(fr.stops.len() - 2);
                        crate::design::mix(&fr.stops[k], &fr.stops[k + 1], ((x - k as f32) * 24.0).round() / 24.0)
                    } else {
                        fr.stops.first().cloned().unwrap_or(color)
                    };
                }
                if local >= 1.0 {
                    squash = 1.0;
                }
            }
            (color, squash)
        };
        // Whether any front is mid-flip now (then nothing can be cached) and how many have passed.
        let flipping = fronts.iter().any(|fr| now > fr.at && now < fr.at + fr.dur);
        let passed = fronts.iter().filter(|fr| now >= fr.at + fr.dur).count();
        const SQUARE: [(f32, f32); 4] = [(-0.5, -0.5), (0.5, -0.5), (0.5, 0.5), (-0.5, 0.5)];
        // One leg of a cross-stitch: a rounded length of thread, and the sheen along it.
        const LEG: [(f32, f32); 8] =
            [(-0.5, -0.25), (-0.42, -0.5), (0.42, -0.5), (0.5, -0.25), (0.5, 0.25), (0.42, 0.5), (-0.42, 0.5), (-0.5, 0.25)];
        const SHEEN: [(f32, f32); 4] = [(-0.36, -0.3), (0.36, -0.3), (0.36, -0.06), (-0.36, -0.06)];
        // Local-space polygon of a tile placed at (x, y), size (w, h), turned by `a`.
        let shape =
            |x: f32, y: f32, w: f32, h: f32, a: f32, pts: &mut dyn Iterator<Item = (f32, f32)>, out: &mut String| {
                let (c, s) = (a.cos(), a.sin());
                for (i, (u, v)) in pts.enumerate() {
                    let (px, py) = (x + (u * w) * c - (v * h) * s, y + (u * w) * s + (v * h) * c);
                    out.push_str(&format!("{}{:.1} {:.1}", if i == 0 { "M" } else { "L" }, px, py));
                }
                out.push('Z');
            };
        let quad = |x: f32, y: f32, w: f32, h: f32, a: f32, cut: &[(f32, f32); 4], out: &mut String| {
            shape(x, y, w, h, a, &mut SQUARE.iter().zip(cut).map(|((u, v), (du, dv))| (u + du, v + dv)), out)
        };
        // Bevel lit from the upper left: one L of light along the top and left edges.
        const LIGHT: [(f32, f32); 6] =
            [(-0.46, -0.46), (0.4, -0.46), (0.4, -0.34), (-0.34, -0.34), (-0.34, 0.4), (-0.46, 0.4)];
        // `build: fly` sends tiles in from `from` (default: below the shape), each on its own arc.
        let fly = s(spec, "build") == "fly";
        let from = arr(spec, "from");
        let from = if from.len() == 2 {
            (from[0].as_f64().unwrap_or(0.0) as f32, from[1].as_f64().unwrap_or(0.0) as f32)
        } else {
            (layout.cx, layout.cy + 600.0)
        };
        let spread = f(spec, "spread", 220.0).max(0.0);
        // Where a tile is at this moment: dropping in, flying in, settled, or thrown by scatter.
        let place = |i: usize, t: &Tile| -> Option<(f32, f32, f32, f32, f32)> {
            let p = motion::clamp01((assemble - t.order * 0.7) / 0.3).min(if t.class == 1 && !filled {
                motion::clamp01((draw - t.order) * 8.0 + 1.0)
            } else {
                1.0
            });
            if p <= 0.001 {
                return None;
            }
            let settle = motion::out_cubic(p);
            let (mut x, mut y, mut a, mut k) = (t.x, t.y - (1.0 - settle) * 0.22 * t.h, t.angle, 1.45 - 0.45 * settle);
            if fly && p < 1.0 {
                // Fly in: from a loose cloud around `from`, along a gentle arc, spinning into the bed.
                let (sx, sy) =
                    (from.0 + noise(seed ^ 0x51, i as u64) * spread, from.1 + noise(seed ^ 0x53, i as u64) * spread);
                let q = motion::in_out_cubic(p);
                let lift = (1.0 - (2.0 * q - 1.0).powi(2)) * spread * 0.35;
                x = sx + (t.x - sx) * q;
                y = sy + (t.y - sy) * q - lift;
                a = t.angle + (1.0 - q) * noise(seed ^ 0x57, i as u64) * 2.5;
                k = 0.7 + 0.3 * q;
            }
            if scatter > 0.0 {
                let h = unit(t.order.to_bits() as u64 ^ i as u64, 77);
                let (dx, dy) = (t.x - layout.cx, t.y - layout.cy);
                let len = dx.hypot(dy).max(1.0);
                let q = motion::in_cubic(scatter);
                let dist = (80.0 + 260.0 * h) * q;
                x += dx / len * dist + noise(i as u64, 3) * 40.0 * q;
                y += dy / len * dist + 180.0 * q * q;
                a += noise(i as u64, 5) * 3.0 * q;
                k *= 1.0 - 0.3 * q;
            }
            Some((x, y, a, t.w * k, t.h * k))
        };
        let settled = assemble >= 1.0 && scatter <= 0.0 && (filled || draw >= 1.0) && !flipping;
        let key = {
            let mut h = std::collections::hash_map::DefaultHasher::new();
            (lkey, &body, &line, &grout, &stops, depth.to_bits(), shine.to_bits(), passed, style).hash(&mut h);
            h.finish()
        };
        let cached = if settled { statics().lock().unwrap().get(&key).cloned() } else { None };
        let parts: Parts = cached.unwrap_or_else(|| {
            // Keyed by (layer, colour, shade, pale): a stitch's under-legs (layer 0) all go
            // down before its over-legs (layer 1).
            let mut buckets: HashMap<(u8, String, i8, bool), String> = HashMap::new();
            let (mut lights, mut bed) = (String::new(), String::new());
            for (i, t) in layout.tiles.iter().enumerate() {
                let Some((x, y, a, w, h)) = place(i, t) else { continue };
                // The grout bed exists only where tiles are, so nothing shows before they arrive;
                // a settled shape lays its bed as one outline instead. Pixels and stitches have
                // no bed: the screen or the cloth shows between them.
                if scatter <= 0.0 && !grid && !(settled && !layout.outline.is_empty()) {
                    quad(x, y, w + layout.gap * 1.3, h + layout.gap * 1.3, a, &t.cut, &mut bed);
                }
                let level = (t.shade * 2.0).round().clamp(-2.0, 2.0) as i8;
                let (color, squash) = face(i, t);
                if stitch {
                    // Two legs corner to corner across the cell, the second crossing over.
                    let (l, th) = (w.max(h) * 1.24 * squash, w.min(h) * 0.36);
                    let under = buckets.entry((0, color.clone(), level - 3, t.pale)).or_default();
                    shape(x, y, l, th, a + PI / 4.0, &mut LEG.iter().copied(), under);
                    let over = buckets.entry((1, color, level, t.pale)).or_default();
                    shape(x, y, l, th, a - PI / 4.0, &mut LEG.iter().copied(), over);
                    if shine > 0.0 && t.w >= 6.0 {
                        shape(x, y, l, th, a - PI / 4.0, &mut SHEEN.iter().copied(), &mut lights);
                    }
                    continue;
                }
                quad(x, y, w * squash, h, a, &t.cut, buckets.entry((0, color, level, t.pale)).or_default());
                // Small tiles read without a bevel; it doubles their cost.
                if shine > 0.0 && t.w >= 10.0 {
                    shape(x, y, w, h, a, &mut LIGHT.iter().copied(), &mut lights);
                }
            }
            let mut parts = vec![];
            if settled && !grid && !layout.outline.is_empty() {
                parts.push((grout.clone(), 1.0, layout.outline.clone()));
            } else if !bed.is_empty() {
                parts.push((grout.clone(), 1.0, bed));
            }
            let mut keys: Vec<_> = buckets.into_iter().collect();
            keys.sort_by(|a, b| a.0.cmp(&b.0));
            for ((_, base, level, pale), d) in keys {
                let tone = level as f32 / 2.0 * depth;
                let color = if tone >= 0.0 {
                    crate::design::mix(&base, "#ffffff", tone)
                } else {
                    crate::design::mix(&base, "#000000", -tone)
                };
                let color = if pale { crate::design::mix(&color, "#ffffff", 0.42) } else { color };
                parts.push((color, 1.0, d));
            }
            if !lights.is_empty() {
                parts.push(("#ffffff".to_owned(), shine * if stitch { 0.3 } else { 0.45 }, lights));
            }
            let parts = Arc::new(parts);
            if settled {
                let mut map = statics().lock().unwrap();
                if map.len() > 256 {
                    map.clear();
                }
                map.insert(key, parts.clone());
            }
            parts
        });
        let mut nodes: Vec<_> = parts
            .iter()
            .map(|(color, opacity, d)| fframes::svgr!(<path d={d.clone()} fill={color.clone()} opacity={*opacity} />))
            .collect();
        // Glints change every frame; they are the only per-frame work on a settled mosaic.
        if glint > 0.0 && scatter <= 0.0 {
            for (i, t) in layout.tiles.iter().enumerate() {
                let period = 3.0 + 5.0 * unit(seed ^ 0x61, i as u64);
                let phase = unit(seed ^ 0x67, i as u64);
                let wave = (TAU * (now / period + phase)).cos().max(0.0).powi(48);
                let g = wave * glint * (0.4 + 0.6 * unit(seed ^ 0x71, i as u64));
                if g > 0.08 {
                    if let Some((x, y, a, w, h)) = place(i, t) {
                        let level = ((g * 3.0) as usize).min(2);
                        quad(x, y, w * 0.9, h * 0.9, a, &t.cut, &mut glints[level]);
                    }
                }
            }
        }
        for (level, d) in glints.into_iter().enumerate() {
            if !d.is_empty() {
                nodes.push(fframes::svgr!(<path d={d} fill="#fffbe8" opacity={0.25 + 0.25 * level as f32} />));
            }
        }
        let fade = 1.0 - motion::clamp01((scatter - 0.75) / 0.25);
        fframes::svgr!(<g opacity={fade}>{nodes}</g>)
    }
}
