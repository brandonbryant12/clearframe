//! Native type: glyphs shaped by `text::shape` (rustybuzz over the bundled font files, the
//! same shaper and files that measured and wrapped the text) and drawn as the outlines of those
//! glyph ids in Skia typefaces made from the same files. Measurement and pixels agree.
use crate::text::{self, Font};
use serde_json::Value;
use skia_safe::{self as sk, Canvas, FontMgr, Paint, Rect, Typeface};
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
            let dir = DIR
                .get()
                .cloned()
                .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")).join("../../film/assets/fonts"));
            let path = dir.join(font.file());
            let bytes =
                std::fs::read(&path).unwrap_or_else(|e| panic!("bundled font {} is unavailable: {e}", path.display()));
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

fn skia_font(font: Font, size: f32) -> sk::Font {
    let mut skfont = sk::Font::from_typeface(typeface(font), size);
    skfont.set_edging(sk::font::Edging::AntiAlias);
    skfont.set_subpixel(true);
    skfont.set_hinting(sk::FontHinting::None);
    skfont.set_linear_metrics(true);
    skfont
}

/// The box of a run drawn at (x, y), from font metrics rather than glyph outlines: its advance
/// wide, from the ascender to the descender. This is SVG's text bounding box, so gradients in
/// bounding-box units and the frame audit measure type as they always have.
pub fn text_box(value: &str, x: f32, y: f32, font: Font, size: f32, tracking: f32) -> Option<Rect> {
    if value.is_empty() {
        return None;
    }
    let (ascent, descent) = text::vertical_metrics(font);
    let w = text::measure(font, value, size, tracking);
    Some(Rect::from_xywh(x, y - ascent * size, w, (ascent + descent) * size))
}

/// A run's glyph outlines at its size, with the baseline origin at (0, 0). Type is filled as
/// outlines (no glyph-mask contrast or gamma), the way it was always drawn, and the geometry is
/// cached per run so a held line costs one path draw a frame.
fn run_path(value: &str, font: Font, size: f32, tracking: f32) -> Option<sk::Path> {
    type Key = (Font, String, u32, u32);
    thread_local! {
        static PATHS: std::cell::RefCell<(HashMap<Key, Option<sk::Path>>, Vec<Key>)> = Default::default();
    }
    let key: Key = (font, value.to_owned(), size.to_bits(), tracking.to_bits());
    if let Some(hit) = PATHS.with(|p| p.borrow().0.get(&key).cloned()) {
        return hit;
    }
    let glyphs = text::shape(font, value, size, tracking);
    let skfont = skia_font(font, size);
    let mut builder = sk::PathBuilder::new();
    for (id, gx, gy) in &glyphs {
        if let Some(outline) = skfont.get_path(*id) {
            builder.add_path_with_transform(&outline, &sk::Matrix::translate((*gx, *gy)), None);
        }
    }
    let path = (!builder.is_empty()).then(|| builder.detach());
    PATHS.with(|p| {
        let mut p = p.borrow_mut();
        // A bounded cache: kinetic type and counters make many short-lived runs.
        if p.1.len() >= 4096 {
            let old = p.1.remove(0);
            p.0.remove(&old);
        }
        p.0.insert(key.clone(), path.clone());
        p.1.push(key);
    });
    path
}

/// Draw one line of text with its baseline origin at (x, y), filled (or stroked) with `paint`.
pub fn draw_run(canvas: &Canvas, value: &str, x: f32, y: f32, font: Font, size: f32, tracking: f32, paint: &Paint) {
    if value.is_empty() {
        return;
    }
    if let Some(path) = run_path(value, font, size, tracking) {
        // The path moves, not the canvas, so a shader on the paint (a material or gradient)
        // stays in the caller's coordinates.
        canvas.draw_path(&path.with_offset((x, y)), paint);
    }
}

/// Width of a run as laid out (the measurement used for anchors and fitting).
pub fn measure(font: Font, value: &str, size: f32, tracking: f32) -> f32 {
    text::measure(font, value, size, tracking)
}
