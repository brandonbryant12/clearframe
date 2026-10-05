//! Geometry for native elements: parsed paths (as Skia paths and flattened outlines), bounds,
//! stroke lengths, travel along a route and arrowheads. Semantics follow the canvas block
//! (`fframes/native/src/canvas_geometry.rs`) so an element means the same thing in both.
use fframes_skia_renderer::skia_safe as sk;
use kurbo::{BezPath, ParamCurveArclen, PathEl, Shape};
use serde_json::Value;
use std::collections::HashMap;
use std::f32::consts::{PI, TAU};
use std::cell::RefCell;
use std::sync::Arc;

pub struct PathInfo {
    pub path: sk::Path,
    pub contours: Vec<Vec<(f32, f32)>>,
    pub length: f32,
    pub bounds: (f32, f32, f32, f32),
}

pub fn s<'a>(v: &'a Value, key: &str) -> &'a str {
    v.get(key).and_then(Value::as_str).unwrap_or("")
}
pub fn num(v: &Value, key: &str) -> Option<f32> {
    v.get(key).and_then(Value::as_f64).map(|x| x as f32)
}
pub fn f(v: &Value, key: &str, default: f32) -> f32 {
    num(v, key).unwrap_or(default)
}
pub fn arr<'a>(v: &'a Value, key: &str) -> &'a [Value] {
    v.get(key).and_then(Value::as_array).map(Vec::as_slice).unwrap_or(&[])
}
pub fn flag(v: &Value, key: &str) -> bool {
    v.get(key).and_then(Value::as_bool).unwrap_or(false)
}
pub fn points(v: &Value) -> Vec<(f32, f32)> {
    arr(v, "points")
        .iter()
        .filter_map(|p| {
            let pair = p.as_array()?;
            Some((pair.first()?.as_f64()? as f32, pair.get(1)?.as_f64()? as f32))
        })
        .collect()
}

/// Parse authored path data once (cached); `None` when it does not parse.
pub fn path_info(d: &str) -> Option<Arc<PathInfo>> {
    thread_local! {
        static CACHE: RefCell<HashMap<String, Arc<PathInfo>>> = RefCell::new(HashMap::new());
    }
    if let Some(hit) = CACHE.with(|c| c.borrow().get(d).cloned()) {
        return Some(hit);
    }
    if d.len() > 60_000 {
        return None;
    }
    let bez = BezPath::from_svg(d).ok()?;
    if bez.elements().is_empty() || bez.elements().len() > 20_000 {
        return None;
    }
    let mut contours: Vec<Vec<(f32, f32)>> = vec![];
    kurbo::flatten(bez.iter(), 0.35, |el| match el {
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
    let mut path = sk::PathBuilder::new();
    for el in bez.elements() {
        match *el {
            PathEl::MoveTo(p) => {
                path.move_to((p.x as f32, p.y as f32));
            }
            PathEl::LineTo(p) => {
                path.line_to((p.x as f32, p.y as f32));
            }
            PathEl::QuadTo(a, b) => {
                path.quad_to((a.x as f32, a.y as f32), (b.x as f32, b.y as f32));
            }
            PathEl::CurveTo(a, b, c) => {
                path.cubic_to((a.x as f32, a.y as f32), (b.x as f32, b.y as f32), (c.x as f32, c.y as f32));
            }
            PathEl::ClosePath => {
                path.close();
            }
        }
    }
    let path = path.detach();
    let length: f64 = bez.segments().map(|s| s.arclen(0.05)).sum();
    let r = bez.bounding_box();
    let info = Arc::new(PathInfo {
        path,
        contours,
        length: length as f32,
        bounds: (r.x0 as f32, r.y0 as f32, (r.x1 - r.x0) as f32, (r.y1 - r.y0) as f32),
    });
    CACHE.with(|c| {
        let mut c = c.borrow_mut();
        if c.len() > 4096 {
            c.clear();
        }
        c.insert(d.to_owned(), info.clone())
    });
    Some(info)
}

/// Element bounds (x, y, w, h) in layer units. Text uses `measure` for its width.
pub fn bounds(el: &Value, measure: &dyn Fn(&Value) -> f32) -> (f32, f32, f32, f32) {
    match s(el, "type") {
        "rect" | "image" | "video" | "particles" | "shader" | "code" | "spotlight" if el.get("cx").is_none() => {
            (f(el, "x", 0.0), f(el, "y", 0.0), f(el, "w", 0.0), f(el, "h", 0.0))
        }
        "circle" | "spotlight" => {
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
            let width = num(el, "width").unwrap_or_else(|| measure(el));
            let x = f(el, "x", 0.0)
                - match s(el, "anchor") {
                    "middle" => width / 2.0,
                    "end" => width,
                    _ => 0.0,
                };
            let lines = if el.get("width").is_some() { f(el, "height", size).max(size) } else { size };
            (x, f(el, "y", 0.0) - size * 0.8, width, lines)
        }
        "group" => {
            let (gx, gy) = (f(el, "x", 0.0), f(el, "y", 0.0));
            let mut acc: Option<(f32, f32, f32, f32)> = None;
            for child in arr(el, "children") {
                let (x, y, w, h) = bounds(child, measure);
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

/// Stroke length for draw-on reveals.
pub fn stroke_length(el: &Value) -> f32 {
    match s(el, "type") {
        "rect" => {
            let (w, h) = (f(el, "w", 0.0), f(el, "h", 0.0));
            let r = f(el, "r", 0.0).min(w / 2.0).min(h / 2.0);
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
            if flag(el, "closed") {
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

/// The outline an arrowhead follows: the last contour of a path, poly or line.
pub fn outline(el: &Value) -> Vec<(f32, f32)> {
    match s(el, "type") {
        "line" => vec![(f(el, "x1", 0.0), f(el, "y1", 0.0)), (f(el, "x2", 0.0), f(el, "y2", 0.0))],
        "poly" => points(el),
        "path" => path_info(s(el, "d")).and_then(|p| p.contours.iter().rev().find(|c| c.len() > 1).cloned()).unwrap_or_default(),
        _ => vec![],
    }
}

/// Point and heading at `fraction` of a polyline's length. Zero-length segments (a flattened
/// curve can end with one) are skipped; the end of the line is its last real point.
pub fn along(points: &[(f32, f32)], fraction: f32) -> Option<((f32, f32), f32)> {
    let total: f32 = points.windows(2).map(|w| (w[1].0 - w[0].0).hypot(w[1].1 - w[0].1)).sum();
    if total <= 0.0 {
        return None;
    }
    let mut remaining = total * fraction.clamp(0.0, 1.0);
    let mut last = None;
    for w in points.windows(2) {
        let seg = (w[1].0 - w[0].0).hypot(w[1].1 - w[0].1);
        if seg <= 1e-6 {
            continue;
        }
        let angle = (w[1].1 - w[0].1).atan2(w[1].0 - w[0].0);
        if remaining <= seg {
            let t = (remaining / seg).clamp(0.0, 1.0);
            return Some(((w[0].0 + (w[1].0 - w[0].0) * t, w[0].1 + (w[1].1 - w[0].1) * t), angle));
        }
        remaining -= seg;
        last = Some((w[1], angle));
    }
    last
}

/// An open chevron whose point is at (x, y), facing `angle`.
pub fn arrowhead(x: f32, y: f32, angle: f32, head: f32) -> sk::Path {
    let mut p = sk::PathBuilder::new();
    p.move_to((x - head * (angle - PI / 6.5).cos(), y - head * (angle - PI / 6.5).sin()));
    p.line_to((x, y));
    p.line_to((x - head * (angle + PI / 6.5).cos(), y - head * (angle + PI / 6.5).sin()));
    p.detach()
}

/// Deterministic noise in −1..1 for (seed, i): the same hash the canvas block uses.
pub fn noise(seed: u64, i: u64) -> f32 {
    let mut z = seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ i.wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^= z >> 31;
    (z as f64 / u64::MAX as f64 * 2.0 - 1.0) as f32
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn paths_parse_measure_and_travel() {
        let p = path_info("M 0 0 L 100 0 L 100 100").unwrap();
        assert!((p.length - 200.0).abs() < 0.01);
        let c = &p.contours[0];
        let ((x, y), a) = along(c, 0.25).unwrap();
        assert!((x - 50.0).abs() < 0.01 && y.abs() < 0.01 && a.abs() < 1e-4);
        let ((x, y), _) = along(c, 1.0).unwrap();
        assert!((x - 100.0).abs() < 0.01 && (y - 100.0).abs() < 0.01);
        assert!(path_info("M nope").is_none());
        // A trailing zero-length segment must not lose the end of the route.
        let tail = [(0.0, 0.0), (10.0, 0.0), (10.0, 0.0)];
        assert_eq!(along(&tail, 1.0).map(|(p, _)| p), Some((10.0, 0.0)));
        assert_eq!(noise(3, 9), noise(3, 9));
    }
}
