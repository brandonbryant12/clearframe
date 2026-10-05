//! Native type: glyphs shaped by `clearframe_native::text::shape` (rustybuzz over the bundled
//! font files, the same shaper and files that measured and wrapped the text) and drawn by
//! glyph id with Skia typefaces made from those exact files. Measurement and pixels agree.
use clearframe_native::text::{self, Font};
use fframes_skia_renderer::skia_safe::{self as sk, Canvas, FontMgr, Paint, Point, TextBlobBuilder, Typeface};
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

static DIR: OnceLock<PathBuf> = OnceLock::new();
static FACES: OnceLock<Mutex<HashMap<Font, Typeface>>> = OnceLock::new();

/// Load faces from the prepared media folder (the hashed copies the plan records).
pub fn use_dir(dir: &Path) {
    let _ = DIR.set(dir.to_path_buf());
    text::use_font_dir(dir);
}

fn typeface(font: Font) -> Typeface {
    let faces = FACES.get_or_init(Default::default);
    let mut map = faces.lock().unwrap();
    map.entry(font)
        .or_insert_with(|| {
            let dir = DIR.get().cloned().unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fframes/assets/fonts"));
            let path = dir.join(font.file());
            let bytes = std::fs::read(&path).unwrap_or_else(|e| panic!("bundled font {} is unavailable: {e}", path.display()));
            FontMgr::new()
                .new_from_data(sk::Data::new_copy(&bytes), None)
                .unwrap_or_else(|| panic!("bundled font {} could not be loaded by Skia", path.display()))
        })
        .clone()
}

/// The face a canvas-dialect text element names (`font`), as the canvas block maps it.
pub fn element_font(el: &Value) -> Font {
    match el.get("font").and_then(Value::as_str).unwrap_or("") {
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
        "poster" => Font::Poster,
        "serif-display" => Font::SerifDisplay,
        "serif-display-italic" => Font::SerifDisplayItalic,
        "didone" => Font::Didone,
        "didone-italic" => Font::DidoneItalic,
        "wide" => Font::Wide,
        "geometric" => Font::Geometric,
        "geometric-light" => Font::GeometricLight,
        "condensed" => Font::Condensed,
        _ => {
            if el.get("count").is_some() {
                Font::Figures
            } else if el.get("size").and_then(Value::as_f64).unwrap_or(48.0) >= 40.0 {
                Font::Display
            } else {
                Font::Text
            }
        }
    }
}

/// Draw one line of text with its baseline origin at (x, y).
pub fn draw_run(canvas: &Canvas, value: &str, x: f32, y: f32, font: Font, size: f32, tracking: f32, paint: &Paint) {
    let glyphs = text::shape(font, value, size, tracking);
    if glyphs.is_empty() {
        return;
    }
    let mut skfont = sk::Font::from_typeface(typeface(font), size);
    skfont.set_edging(sk::font::Edging::AntiAlias);
    skfont.set_subpixel(true);
    skfont.set_hinting(sk::FontHinting::None);
    skfont.set_linear_metrics(true);
    let mut builder = TextBlobBuilder::new();
    let (ids, positions) = builder.alloc_run_pos(&skfont, glyphs.len(), None);
    for (i, (id, gx, gy)) in glyphs.iter().enumerate() {
        ids[i] = *id;
        positions[i] = Point::new(*gx, *gy);
    }
    if let Some(blob) = builder.make() {
        canvas.draw_text_blob(&blob, (x, y), paint);
    }
}

/// Width of a run as laid out (the measurement used for anchors and fitting).
pub fn measure(font: Font, value: &str, size: f32, tracking: f32) -> f32 {
    text::measure(font, value, size, tracking)
}
