//! Canvas geometry: parsing and measuring authored paths, element bounds and outlines,
//! arc-length resampling for morphs, and the deterministic noise behind hand-drawn strokes.
use super::*;

/// A path's normalized data, flattened outline (for length and arrow tips) and bounds.
pub(super) struct PathInfo {
    pub(super) d: String,
    pub(super) points: Vec<Vec<(f32, f32)>>,
    pub(super) length: f32,
    pub(super) bounds: (f32, f32, f32, f32),
}

pub(super) fn path_cache() -> &'static Mutex<HashMap<String, std::sync::Arc<PathInfo>>> {
    static CACHE: std::sync::OnceLock<Mutex<HashMap<String, std::sync::Arc<PathInfo>>>> = std::sync::OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Parse authored path data once; the renderer draws kurbo's normalized absolute form so
/// validation and drawing agree on every command (arcs become cubic curves).
pub(super) fn path_info(d: &str) -> Option<std::sync::Arc<PathInfo>> {
    if let Some(hit) = path_cache().lock().ok()?.get(d) {
        return Some(hit.clone());
    }
    if d.len() > 12_000 {
        return None;
    }
    let path = BezPath::from_svg(d).ok()?;
    if path.elements().is_empty() || path.elements().len() > 4000 {
        return None;
    }
    let mut contours: Vec<Vec<(f32, f32)>> = vec![];
    kurbo::flatten(path.iter(), 0.35, |el| match el {
        PathEl::MoveTo(p) => contours.push(vec![(p.x as f32, p.y as f32)]),
        PathEl::LineTo(p) => {
            if let Some(c) = contours.last_mut() {
                c.push((p.x as f32, p.y as f32));
            }
        }
        PathEl::ClosePath => {
            if let Some(c) = contours.last_mut() {
                if let Some(&first) = c.first() {
                    c.push(first);
                }
            }
        }
        _ => {}
    });
    if contours.iter().flatten().any(|(x, y)| !x.is_finite() || !y.is_finite()) {
        return None;
    }
    let length: f64 = path.segments().map(|s| s.arclen(0.05)).sum();
    let r = path.bounding_box();
    let info = std::sync::Arc::new(PathInfo {
        d: path.to_svg(),
        points: contours,
        length: length as f32,
        bounds: (r.x0 as f32, r.y0 as f32, (r.x1 - r.x0) as f32, (r.y1 - r.y0) as f32),
    });
    if let Ok(mut cache) = path_cache().lock() {
        cache.insert(d.to_owned(), info.clone());
    }
    Some(info)
}

pub(super) fn num(v: &Value, key: &str) -> Option<f32> {
    v.get(key).and_then(Value::as_f64).map(|x| x as f32)
}
pub(super) fn f(v: &Value, key: &str, default: f32) -> f32 {
    num(v, key).unwrap_or(default)
}
pub(super) fn points(v: &Value) -> Vec<(f32, f32)> {
    arr(v, "points")
        .iter()
        .filter_map(|p| {
            let pair = p.as_array()?;
            Some((pair.first()?.as_f64()? as f32, pair.get(1)?.as_f64()? as f32))
        })
        .collect()
}

/// Element bounds in author units: (x, y, w, h).
pub(super) fn bounds(el: &Value) -> (f32, f32, f32, f32) {
    match s(el, "type") {
        "rect" | "image" | "meter" => (f(el, "x", 0.0), f(el, "y", 0.0), f(el, "w", 0.0), f(el, "h", 0.0)),
        "spotlight" if el.get("cx").is_some() => {
            let r = f(el, "r", 0.0);
            (f(el, "cx", 0.0) - r, f(el, "cy", 0.0) - r, 2.0 * r, 2.0 * r)
        }
        "spotlight" => (f(el, "x", 0.0), f(el, "y", 0.0), f(el, "w", 0.0), f(el, "h", 0.0)),
        "circle" => {
            let r = f(el, "r", 0.0);
            (f(el, "cx", 0.0) - r, f(el, "cy", 0.0) - r, 2.0 * r, 2.0 * r)
        }
        "ellipse" => {
            let (rx, ry) = (f(el, "rx", 0.0), f(el, "ry", 0.0));
            (f(el, "cx", 0.0) - rx, f(el, "cy", 0.0) - ry, 2.0 * rx, 2.0 * ry)
        }
        "line" => {
            let (x1, y1, x2, y2) = (f(el, "x1", 0.0), f(el, "y1", 0.0), f(el, "x2", 0.0), f(el, "y2", 0.0));
            (x1.min(x2), y1.min(y2), (x2 - x1).abs(), (y2 - y1).abs())
        }
        "poly" => {
            let pts = points(el);
            let (x0, x1) = pts.iter().fold((f32::MAX, f32::MIN), |(a, b), p| (a.min(p.0), b.max(p.0)));
            let (y0, y1) = pts.iter().fold((f32::MAX, f32::MIN), |(a, b), p| (a.min(p.1), b.max(p.1)));
            (x0, y0, x1 - x0, y1 - y0)
        }
        "path" => path_info(s(el, "d")).map_or((0.0, 0.0, 0.0, 0.0), |p| p.bounds),
        "icon" => {
            let size = f(el, "size", 64.0);
            (f(el, "x", 0.0) - size / 2.0, f(el, "y", 0.0) - size / 2.0, size, size)
        }
        "text" => {
            let size = f(el, "size", 48.0);
            let width = num(el, "width").unwrap_or_else(|| text::measure(text_font(el), s(el, "text"), size, 0.0));
            let x = f(el, "x", 0.0)
                - match s(el, "anchor") {
                    "middle" => width / 2.0,
                    "end" => width,
                    _ => 0.0,
                };
            (x, f(el, "y", 0.0) - size * 0.8, width, size)
        }
        "group" => {
            let (gx, gy) = (f(el, "x", 0.0), f(el, "y", 0.0));
            let mut acc: Option<(f32, f32, f32, f32)> = None;
            for child in arr(el, "children") {
                let (x, y, w, h) = bounds(child);
                acc = Some(match acc {
                    None => (x, y, x + w, y + h),
                    Some((a, b, c, d)) => (a.min(x), b.min(y), c.max(x + w), d.max(y + h)),
                });
            }
            acc.map_or((gx, gy, 0.0, 0.0), |(a, b, c, d)| (a + gx, b + gy, c - a, d - b))
        }
        _ => (0.0, 0.0, 0.0, 0.0),
    }
}

pub(super) fn text_font(el: &Value) -> Font {
    match s(el, "font") {
        "text" | "regular" => Font::Text,
        "strong" => Font::TextStrong,
        "light" => Font::DisplayLight,
        "bold" => Font::DisplayBold,
        "figures" => Font::Figures,
        "display" | "semibold" => Font::Display,
        "serif" => Font::Serif,
        "serif-italic" | "italic" => Font::SerifItalic,
        "mono" => Font::Mono,
        "hand" => Font::Hand,
        _ => {
            if el.get("count").is_some() {
                Font::Figures
            } else if f(el, "size", 48.0) >= 40.0 {
                Font::Display
            } else {
                Font::Text
            }
        }
    }
}

/// Stroke length used for draw-on entrances.
pub(super) fn stroke_length(el: &Value) -> f32 {
    match s(el, "type") {
        "rect" => {
            let (w, h, r) = (
                f(el, "w", 0.0),
                f(el, "h", 0.0),
                f(el, "r", 0.0).min(f(el, "w", 0.0) / 2.0).min(f(el, "h", 0.0) / 2.0),
            );
            2.0 * (w + h) - 8.0 * r + TAU * r
        }
        "circle" => TAU * f(el, "r", 0.0),
        "ellipse" => {
            let (a, b) = (f(el, "rx", 0.0), f(el, "ry", 0.0));
            PI * (3.0 * (a + b) - ((3.0 * a + b) * (a + 3.0 * b)).max(0.0).sqrt())
        }
        "line" => (f(el, "x2", 0.0) - f(el, "x1", 0.0)).hypot(f(el, "y2", 0.0) - f(el, "y1", 0.0)),
        "poly" => {
            let mut pts = points(el);
            if el.get("closed").and_then(Value::as_bool).unwrap_or(false) {
                if let Some(&p) = pts.first() {
                    pts.push(p);
                }
            }
            pts.windows(2).map(|w| (w[1].0 - w[0].0).hypot(w[1].1 - w[0].1)).sum()
        }
        "path" => path_info(s(el, "d")).map_or(0.0, |p| p.length),
        _ => 0.0,
    }
}

/// The outline an arrowhead follows: the last contour of a path/poly/line.
pub(super) fn outline(el: &Value) -> Vec<(f32, f32)> {
    match s(el, "type") {
        "line" => vec![(f(el, "x1", 0.0), f(el, "y1", 0.0)), (f(el, "x2", 0.0), f(el, "y2", 0.0))],
        "poly" => points(el),
        "path" => {
            path_info(s(el, "d")).and_then(|p| p.points.iter().rev().find(|c| c.len() > 1).cloned()).unwrap_or_default()
        }
        _ => vec![],
    }
}

/// `n` points spaced evenly by arc length along a polyline.
pub(super) fn resample(points: &[(f32, f32)], n: usize) -> Vec<(f32, f32)> {
    if points.len() < 2 {
        return vec![points.first().copied().unwrap_or((0.0, 0.0)); n];
    }
    (0..n).map(|i| along(points, i as f32 / (n - 1) as f32).map_or(points[0], |(p, _)| p)).collect()
}

/// Outline of a morphable element as a polyline (closed shapes repeat their first point).
pub(super) fn morph_outline(el: &Value) -> Option<(Vec<(f32, f32)>, bool)> {
    match s(el, "type") {
        "path" => path_info(s(el, "d")).and_then(|p| p.points.iter().max_by_key(|c| c.len()).cloned()).map(|c| {
            let closed = c.first() == c.last();
            (c, closed)
        }),
        "poly" => {
            let mut p = points(el);
            let closed = el.get("closed").and_then(Value::as_bool).unwrap_or(false);
            if closed {
                if let Some(&a) = p.first() {
                    p.push(a);
                }
            }
            Some((p, closed))
        }
        "line" => Some((vec![(f(el, "x1", 0.0), f(el, "y1", 0.0)), (f(el, "x2", 0.0), f(el, "y2", 0.0))], false)),
        "circle" | "ellipse" => {
            let (cx, cy) = (f(el, "cx", 0.0), f(el, "cy", 0.0));
            let (rx, ry) = if s(el, "type") == "circle" {
                (f(el, "r", 0.0), f(el, "r", 0.0))
            } else {
                (f(el, "rx", 0.0), f(el, "ry", 0.0))
            };
            Some((
                (0..=96)
                    .map(|i| {
                        let a = i as f32 / 96.0 * TAU - PI / 2.0;
                        (cx + rx * a.cos(), cy + ry * a.sin())
                    })
                    .collect(),
                true,
            ))
        }
        "rect" => {
            let (x, y, w, h) = (f(el, "x", 0.0), f(el, "y", 0.0), f(el, "w", 0.0), f(el, "h", 0.0));
            Some((vec![(x + w / 2.0, y), (x + w, y), (x + w, y + h), (x, y + h), (x, y), (x + w / 2.0, y)], true))
        }
        _ => None,
    }
}

/// Deterministic noise in [-1, 1] (splitmix64): the same seed and index always agree, so a
/// hand-drawn line is identical on every seek.
pub(super) fn noise(seed: u64, i: u64) -> f32 {
    let mut z = seed.wrapping_add(i.wrapping_mul(0x9E37_79B9_7F4A_7C15));
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^= z >> 31;
    (z >> 11) as f32 / (1u64 << 53) as f32 * 2.0 - 1.0
}

/// A pencil pass along polylines: points every ~22 units nudged sideways, ends overshooting a
/// little, joined with smooth quadratics.
pub(super) fn rough_contour(points: &[(f32, f32)], amount: f32, seed: u64) -> String {
    if points.len() < 2 {
        return String::new();
    }
    let mut dense = vec![];
    for (k, w) in points.windows(2).enumerate() {
        let (a, b) = (w[0], w[1]);
        let len = (b.0 - a.0).hypot(b.1 - a.1);
        let n = ((len / 22.0).ceil() as usize).max(1);
        let (nx, ny) = if len > 1e-3 { (-(b.1 - a.1) / len, (b.0 - a.0) / len) } else { (0.0, 0.0) };
        for j in 0..n {
            let t = j as f32 / n as f32;
            let i = (k * 97 + j) as u64;
            let wobble = amount * noise(seed, i) * (0.6 + 0.4 * (len / 200.0).min(1.0));
            dense.push((a.0 + (b.0 - a.0) * t + nx * wobble, a.1 + (b.1 - a.1) * t + ny * wobble));
        }
    }
    let last = *points.last().unwrap();
    dense.push((last.0 + amount * 0.6 * noise(seed, 7001), last.1 + amount * 0.6 * noise(seed, 7002)));
    // Overshoot the start along the first direction, as a hand does.
    let (a, b) = (dense[0], dense[1.min(dense.len() - 1)]);
    let over = amount * 1.2 * (0.5 + 0.5 * noise(seed, 7003));
    let len = (b.0 - a.0).hypot(b.1 - a.1).max(1e-3);
    let start = (a.0 - (b.0 - a.0) / len * over, a.1 - (b.1 - a.1) / len * over);
    let mut d = format!("M {:.1} {:.1}", start.0, start.1);
    for w in dense.windows(2) {
        let mid = ((w[0].0 + w[1].0) / 2.0, (w[0].1 + w[1].1) / 2.0);
        d.push_str(&format!(" Q {:.1} {:.1} {:.1} {:.1}", w[0].0, w[0].1, mid.0, mid.1));
    }
    d.push_str(&format!(" L {:.1} {:.1}", last.0, last.1));
    d
}

/// Contours of a stroked shape for rough rendering, each with whether it is closed.
pub(super) fn contours_of(el: &Value) -> Vec<(Vec<(f32, f32)>, bool)> {
    match s(el, "type") {
        "path" => path_info(s(el, "d"))
            .map(|p| p.points.iter().map(|c| (c.clone(), c.len() > 2 && c.first() == c.last())).collect())
            .unwrap_or_default(),
        _ => morph_outline(el).map(|(c, closed)| vec![(c, closed)]).unwrap_or_default(),
    }
}

/// An open chevron whose point is at (x, y), facing `angle`.
pub(super) fn arrowhead(x: f32, y: f32, angle: f32, head: f32) -> String {
    format!(
        "M {} {} L {x} {y} L {} {}",
        x - head * (angle - PI / 6.5).cos(),
        y - head * (angle - PI / 6.5).sin(),
        x - head * (angle + PI / 6.5).cos(),
        y - head * (angle + PI / 6.5).sin()
    )
}

/// Point and direction at `fraction` of a polyline's length.
pub(super) fn along(points: &[(f32, f32)], fraction: f32) -> Option<((f32, f32), f32)> {
    let total: f32 = points.windows(2).map(|w| (w[1].0 - w[0].0).hypot(w[1].1 - w[0].1)).sum();
    if total <= 0.0 {
        return None;
    }
    let mut remaining = total * fraction.clamp(0.0, 1.0);
    for w in points.windows(2) {
        let seg = (w[1].0 - w[0].0).hypot(w[1].1 - w[0].1);
        if seg <= 1e-6 {
            continue;
        }
        if remaining <= seg || std::ptr::eq(w, points.windows(2).last()?) {
            let t = (remaining / seg).clamp(0.0, 1.0);
            let p = (w[0].0 + (w[1].0 - w[0].0) * t, w[0].1 + (w[1].1 - w[0].1) * t);
            return Some((p, (w[1].1 - w[0].1).atan2(w[1].0 - w[0].0)));
        }
        remaining -= seg;
    }
    None
}
