//! The film lens settings: letterbox, grade, bloom, chromatic aberration, light leaks, a
//! handheld drift and shutter (drawn by `film.rs`). Each beat carries its resolved `lens` (film
//! settings merged with the beat's own), so every effect is a pure function of the frame.
use serde_json::Value;

#[derive(Clone, Debug, Default, PartialEq)]
pub struct Lens {
    /// Picture aspect inside black bars (2.39, 2, 1.85); 0 for none.
    pub letterbox: f32,
    pub grade: String,
    pub grade_amount: f32,
    pub bloom: f32,
    pub aberration: f32,
    pub leak: f32,
    pub handheld: f32,
    /// Shutter for motion blur on camera moves: 0.5 is a 180° shutter.
    pub blur: f32,
}

impl Lens {
    pub fn from(v: &Value) -> Self {
        let unit = |k: &str| v.get(k).and_then(Value::as_f64).unwrap_or(0.0).clamp(0.0, 1.0) as f32;
        Lens {
            letterbox: v.get("letterbox").and_then(Value::as_f64).unwrap_or(0.0).clamp(0.0, 4.0) as f32,
            grade: v.get("grade").and_then(Value::as_str).unwrap_or("none").to_owned(),
            grade_amount: v.get("gradeAmount").and_then(Value::as_f64).map_or(0.7, |x| x.clamp(0.0, 1.0) as f32),
            bloom: unit("bloom"),
            aberration: unit("aberration"),
            leak: unit("leak"),
            handheld: unit("handheld"),
            blur: unit("blur"),
        }
    }
}

/// Height of each black bar for a picture `aspect` in a `w`×`h` frame (0 when it fits).
/// Letterbox is a landscape convention: vertical and square frames keep their full height.
pub fn bar(aspect: f32, w: f32, h: f32) -> f32 {
    if aspect <= 0.0 || h >= w || w / aspect >= h { 0.0 } else { (h - w / aspect) / 2.0 }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lens_parses_clamps_and_sizes_bars() {
        let l = Lens::from(&serde_json::json!({"letterbox":2.39,"grade":"teal-orange","bloom":3,"handheld":0.5}));
        assert_eq!(l.bloom, 1.0);
        assert_eq!(l.grade_amount, 0.7);
        assert!((bar(2.39, 1920.0, 1080.0) - 138.3).abs() < 0.5);
        assert_eq!(bar(2.39, 1080.0, 1920.0), 0.0, "vertical frames keep their height");
        assert_eq!(bar(0.0, 1920.0, 1080.0), 0.0);
        assert_eq!(bar(1.5, 1920.0, 1080.0), 0.0, "a taller picture than the frame needs no bars");
    }
}
