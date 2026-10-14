//! The lens: the shutter for motion blur on fast camera and element moves (`blur`, read by the
//! canvas block's keyed smear and by stages' temporal samples). Each beat carries its resolved
//! `lens` (film settings merged with the beat's own), so the blur is a pure function of the
//! frame. The film looks it once held (letterbox, grade, bloom, aberration, leak, handheld) were
//! retired: the job refuses them by name.
use serde_json::Value;

#[derive(Clone, Debug, Default, PartialEq)]
pub struct Lens {
    /// Shutter for motion blur on camera moves: 0.5 is a 180° shutter.
    pub blur: f32,
}

impl Lens {
    pub fn from(v: &Value) -> Self {
        Lens { blur: v.get("blur").and_then(Value::as_f64).unwrap_or(0.0).clamp(0.0, 1.0) as f32 }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lens_reads_its_shutter_and_clamps_it() {
        assert_eq!(Lens::from(&serde_json::json!({"blur":0.5})).blur, 0.5);
        assert_eq!(Lens::from(&serde_json::json!({"blur":3})).blur, 1.0);
        assert_eq!(Lens::from(&Value::Null).blur, 0.0);
    }
}
