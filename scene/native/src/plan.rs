//! The scene plan (`clearframe.scene` v1): the compiled, hashed description of a film that
//! the engine evaluates frame by frame. Authors never write it; `scene/compile.mjs` builds it
//! from the storyboard, the prepared block job and the timing. Every value the renderer
//! needs is in the plan, the job it names or the staged media folder, so a frame is a pure
//! function of its number and these inputs.
use serde::Deserialize;
use serde_json::Value;
use std::path::{Path, PathBuf};

pub const KIND: &str = "clearframe.scene";
pub const VERSION: u32 = 1;
/// Elements per native layer: the same bound the canvas block uses.
pub const MAX_ELEMENTS: usize = 1500;

#[derive(Debug, Clone, Deserialize)]
pub struct Format {
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub frames: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Depth {
    /// Between the beat's plate/tone and its block content (the picture of a `scene` beat).
    #[default]
    Under,
    /// Above the block content: annotations, callouts, particles in front.
    Over,
}

/// A native layer: elements drawn by the engine itself on its own clock.
#[derive(Debug, Clone, Deserialize)]
pub struct Layer {
    pub id: String,
    /// First film frame and length. Layers spanning several beats keep their state (and
    /// their elements' identities) across the cuts between them.
    pub start: usize,
    pub frames: usize,
    /// The beat this layer belongs to; drawn with that beat (inside its dissolves). `None`
    /// for a stage that spans beats, drawn once around them.
    #[serde(default)]
    pub beat: Option<String>,
    #[serde(default)]
    pub z: Depth,
    /// Seconds of fade at the layer's start and end.
    #[serde(default)]
    pub fade: [f32; 2],
    /// 2.5D camera: `{keys: [{at, x, y, zoom, rotate, z, dur, ease}], focus: {z, aperture, keys}}`.
    #[serde(default)]
    pub camera: Value,
    /// Shutter as a fraction of a frame (0.5 = 180°) and the number of time samples
    /// accumulated per frame for real motion blur. 0 samples: no blur.
    #[serde(default)]
    pub shutter: f32,
    #[serde(default)]
    pub samples: u32,
    /// The layer's own motion preset (defaults to the film's).
    #[serde(default)]
    pub motion: Option<Value>,
    pub elements: Vec<Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Plan {
    pub kind: String,
    pub version: u32,
    pub format: Format,
    /// The prepared block job (`job.json`): film palette, backdrop, chrome, lens, beats, and
    /// the block content drawn through the compatibility layer.
    pub job: String,
    /// Staged media and fonts (content-hash names).
    pub media: String,
    #[serde(default)]
    pub layers: Vec<Layer>,
    #[serde(skip)]
    pub dir: PathBuf,
}

impl Plan {
    pub fn read(file: &Path) -> Result<Self, String> {
        let bytes = std::fs::read(file).map_err(|e| format!("{}: {e}", file.display()))?;
        let mut plan: Plan = serde_json::from_slice(&bytes).map_err(|e| format!("{}: {e}", file.display()))?;
        plan.dir = file.parent().map(Path::to_path_buf).unwrap_or_default();
        plan.validate()?;
        Ok(plan)
    }
    pub fn job_path(&self) -> PathBuf {
        self.dir.join(&self.job)
    }
    pub fn media_path(&self) -> PathBuf {
        self.dir.join(&self.media)
    }
    pub fn validate(&self) -> Result<(), String> {
        if self.kind != KIND || self.version != VERSION {
            return Err(format!("not a {KIND} v{VERSION} plan"));
        }
        let f = &self.format;
        if f.width < 2 || f.height < 2 || f.width % 2 != 0 || f.height % 2 != 0 || f.width > 7680 || f.height > 7680 {
            return Err("plan format needs positive even dimensions up to 7680".into());
        }
        if ![24, 25, 30, 50, 60].contains(&f.fps) {
            return Err("plan fps must be 24, 25, 30, 50 or 60".into());
        }
        if f.frames == 0 {
            return Err("plan has no frames".into());
        }
        for layer in &self.layers {
            if layer.frames == 0 || layer.start + layer.frames > f.frames {
                return Err(format!("layer {} lies outside the film", layer.id));
            }
            if !(0.0..=1.0).contains(&layer.shutter) || layer.samples > 32 {
                return Err(format!("layer {}: shutter is 0–1 and samples at most 32", layer.id));
            }
            if layer.fade.iter().any(|s| !s.is_finite() || *s < 0.0) {
                return Err(format!("layer {}: fade seconds must be nonnegative", layer.id));
            }
            let mut count = 0;
            crate::nodes::validate(&layer.elements, 0, &mut count).map_err(|m| format!("layer {}: {m}", layer.id))?;
        }
        Ok(())
    }
    /// Seconds into a layer at a (possibly fractional) film frame.
    pub fn layer_seconds(&self, layer: &Layer, frame: f32) -> f32 {
        (frame - layer.start as f32) / self.format.fps as f32
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn plan(layers: Value) -> Result<Plan, String> {
        let v = serde_json::json!({"kind":KIND,"version":1,"format":{"width":1920,"height":1080,"fps":30,"frames":60},
            "job":"job.json","media":"media","layers":layers});
        let p: Plan = serde_json::from_value(v).map_err(|e| e.to_string())?;
        p.validate().map(|_| p)
    }
    #[test]
    fn layers_must_lie_inside_the_film_and_validate_their_elements() {
        assert!(plan(serde_json::json!([])).is_ok());
        assert!(plan(serde_json::json!([{"id":"a","start":30,"frames":40,"elements":[]}])).is_err());
        assert!(plan(serde_json::json!([{"id":"a","start":0,"frames":60,"elements":[{"type":"warp-drive"}]}])).is_err());
        assert!(plan(serde_json::json!([{"id":"a","start":0,"frames":60,"elements":[{"type":"rect","w":10,"h":10}]}])).is_ok());
    }
}
