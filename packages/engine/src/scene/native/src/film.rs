//! Film-level picture, drawn natively: the persistent backdrop, vignette and grain, the film
//! chrome and the editorial frame. Grain and paper are Skia's fractal noise (the SVG
//! `feTurbulence` function). The film-look lens (grades, bloom, aberration, light leaks, a
//! handheld drift, letterbox bars) was retired; the lens keeps only the motion-blur shutter.
use crate::design::Palette;
use crate::fonts;
use crate::nodes::TextMark;
use crate::paint::{self, hex};
use crate::text::{self, Font};
use serde_json::Value;
use skia_safe::{self as sk, BlendMode, Canvas, Paint, PaintStyle, Point, Rect, TileMode, gradient_shader, perlin_noise_shader};

fn radial(cx: f32, cy: f32, r: f32, stops: &[(f32, &str, f32)]) -> Option<sk::Shader> {
    let colors: Vec<sk::Color> = stops.iter().map(|(_, c, a)| paint::color(hex(c, *a))).collect();
    let pos: Vec<f32> = stops.iter().map(|(o, _, _)| *o).collect();
    gradient_shader::radial(
        Point::new(cx, cy),
        r.max(1.0),
        colors.as_slice(),
        Some(pos.as_slice()),
        TileMode::Clamp,
        None,
        None,
    )
}

/// Persistent film background: `grid` (faint 80 px rules) or `paper` (a clean stock with a fine,
/// still tooth). Retired kinds (glow, dots, mosaic) never reach the renderer: the job refuses them.
pub fn backdrop(canvas: &Canvas, kind: &str, w: f32, h: f32, p: &Palette) {
    match kind {
        "grid" => {
            canvas.save_layer_alpha_f(None, 0.09);
            let mut paint = Paint::default();
            paint.set_anti_alias(true);
            paint.set_color4f(hex(&p.muted, 1.0), None);
            paint.set_style(PaintStyle::Stroke);
            paint.set_stroke_width(1.0);
            for x in (0..w as usize).step_by(80) {
                canvas.draw_line((x as f32, 0.0), (x as f32, h), &paint);
            }
            for y in (0..h as usize).step_by(80) {
                canvas.draw_line((0.0, y as f32), (w, y as f32), &paint);
            }
            canvas.restore();
        }
        "paper" => {
            // The grain's fine noise laid over the paper colour in Overlay: mid-grey leaves the
            // tone as it is, so the stock keeps its colour and gains only a tooth, never clouds.
            let mut paint = Paint::default();
            paint.set_shader(grain_shader(11.0));
            paint.set_blend_mode(BlendMode::Overlay);
            paint.set_alpha_f(if p.dark { 0.5 } else { 0.7 });
            canvas.draw_rect(Rect::from_wh(w, h), &paint);
        }
        _ => {}
    }
}

fn amount(texture: &Value, key: &str) -> f32 {
    match texture {
        Value::String(s) => match (s.as_str(), key) {
            ("film", _) => 0.6,
            ("grain", "grain") | ("vignette", "vignette") => 0.6,
            _ => 0.0,
        },
        Value::Object(_) => texture.get(key).and_then(Value::as_f64).unwrap_or(0.0).clamp(0.0, 1.0) as f32,
        _ => 0.0,
    }
}

pub fn vignette(canvas: &Canvas, texture: &Value, w: f32, h: f32, p: &Palette) {
    let v = amount(texture, "vignette");
    if v <= 0.0 {
        return;
    }
    let edge = if p.dark { "#000000" } else { p.ink.as_str() };
    let strength = v * if p.dark { 0.55 } else { 0.22 };
    let mut paint = Paint::default();
    paint.set_shader(radial(
        w / 2.0,
        h / 2.0,
        (w * w + h * h).sqrt() * 0.56,
        &[(0.45, edge, 0.0), (1.0, edge, strength)],
    ));
    canvas.draw_rect(Rect::from_wh(w, h), &paint);
}

/// The grain's noise drawn once at the output size: the same for every frame of static grain, and
/// for the four or so frames each animated seed lasts. Fractal noise evaluated per pixel per frame
/// was a sixth of a draft's render time. Kept per engine, so the image stays on its GPU context.
#[derive(Default)]
pub struct GrainCache {
    key: Option<(i32, i32, i32, [u32; 9])>,
    image: Option<sk::Image>,
}

/// Grain over everything: static unless `animate`, then it changes eight times a second.
pub fn grain(canvas: &Canvas, texture: &Value, w: f32, h: f32, p: &Palette, seconds: f32, cache: &mut GrainCache) {
    let g = amount(texture, "grain");
    if g <= 0.0 {
        return;
    }
    let animate = texture.get("animate").and_then(Value::as_bool).unwrap_or(texture.as_str() == Some("film"));
    let seed = if animate { ((seconds * 8.0).floor() as i32 % 97 + 1) as f32 } else { 7.0 };
    let opacity = g * if p.dark { 0.16 } else { 0.12 };
    // Opaque grey noise in an empty layer (Overlay over nothing is the noise itself), composited at
    // `opacity`: the noise image drawn at that opacity, in device pixels, is the same picture.
    let m = canvas.local_to_device_as_3x3();
    let info = canvas.image_info();
    let mut values = [0.0f32; 9];
    m.get_9(&mut values);
    let key = (info.width(), info.height(), seed as i32, values.map(f32::to_bits));
    if cache.key != Some(key) {
        cache.image = canvas.new_surface(&info, None).map(|mut surface| {
            let c = surface.canvas();
            c.clear(sk::Color::TRANSPARENT);
            c.concat(&m);
            let mut paint = Paint::default();
            paint.set_shader(grain_shader(seed));
            paint.set_blend_mode(BlendMode::Overlay);
            c.draw_rect(Rect::from_wh(w, h), &paint);
            surface.image_snapshot()
        });
        cache.key = Some(key);
    }
    match &cache.image {
        Some(image) => {
            let mut paint = Paint::default();
            paint.set_alpha_f(opacity);
            canvas.save();
            canvas.reset_matrix();
            canvas.draw_image(image, (0, 0), Some(&paint));
            canvas.restore();
        }
        None => {
            let mut paint = Paint::default();
            paint.set_shader(grain_shader(seed));
            canvas.save_layer_alpha_f(None, opacity);
            paint.set_blend_mode(BlendMode::Overlay);
            canvas.draw_rect(Rect::from_wh(w, h), &paint);
            canvas.restore();
        }
    }
}

/// Fractal noise turned to opaque grey (the channels averaged, alpha set to 1): the grain's
/// strength is the layer's opacity alone.
fn grain_shader(seed: f32) -> Option<sk::Shader> {
    thread_local! {
        static EFFECT: sk::RuntimeEffect = sk::RuntimeEffect::make_for_shader(
            "uniform shader noise; half4 main(float2 p) { half4 c = noise.eval(p); half3 u = c.a > 0.0 ? c.rgb / c.a : half3(0); half g = 0.33 * (u.r + u.g + u.b); return half4(half3(g), 1); }",
            None,
        )
        .expect("grain shader");
    }
    let noise = perlin_noise_shader::fractal_noise((0.85, 0.85), 2, seed, None)?;
    EFFECT.with(|e| e.make_shader(sk::Data::new_empty(), &[noise.into()], None))
}

/// A labelled coordinate grid for placing art (review aid; never in deliverables).
pub fn guides(canvas: &Canvas, w: f32, h: f32) {
    let mut line = Paint::default();
    line.set_anti_alias(true);
    line.set_style(PaintStyle::Stroke);
    line.set_color4f(hex("#ff2d7a", 0.55), None);
    let mut label = Paint::default();
    label.set_anti_alias(true);
    label.set_color4f(hex("#ff2d7a", 1.0), None);
    for x in (0..=w as usize).step_by(100) {
        line.set_stroke_width(if x % 200 == 0 { 1.4 } else { 0.7 });
        canvas.draw_line((x as f32, 0.0), (x as f32, h), &line);
        if x % 200 == 0 && x > 0 {
            fonts::draw_run(canvas, &x.to_string(), x as f32 + 4.0, 22.0, Font::TextStrong, 18.0, 0.0, &label);
        }
    }
    for y in (0..=h as usize).step_by(100) {
        line.set_stroke_width(if y % 200 == 0 { 1.4 } else { 0.7 });
        canvas.draw_line((0.0, y as f32), (w, y as f32), &line);
        if y % 200 == 0 && y > 0 {
            fonts::draw_run(canvas, &y.to_string(), 4.0, y as f32 - 4.0, Font::TextStrong, 18.0, 0.0, &label);
        }
    }
}

/// `chrome: true`: the film title top-left and an accent progress rail along the top edge.
pub fn chrome(canvas: &Canvas, title: &str, w: f32, p: &Palette, progress: f32, marks: &mut Vec<TextMark>) {
    let mut t = Paint::default();
    t.set_anti_alias(true);
    t.set_color4f(hex(&p.muted, 1.0), None);
    draw_text(canvas, title, w * 0.065, 66.0, Font::Text, 22.0, 0.0, &t, marks);
    let rail = progress * w;
    if rail > 0.0 {
        let mut a = Paint::default();
        a.set_color4f(hex(&p.accent, 1.0), None);
        canvas.draw_rect(Rect::from_xywh(0.0, 0.0, rail, 4.0), &a);
    }
}

#[allow(clippy::too_many_arguments)]
fn draw_text(
    canvas: &Canvas,
    value: &str,
    x: f32,
    y: f32,
    font: Font,
    size: f32,
    tracking: f32,
    paint: &Paint,
    marks: &mut Vec<TextMark>,
) {
    if value.is_empty() {
        return;
    }
    fonts::draw_run(canvas, value, x, y, font, size, tracking, paint);
    let w = text::measure(font, value, size, tracking);
    let m = canvas.local_to_device_as_3x3();
    let r = m.map_rect(Rect::from_xywh(x, y - size * 0.74, w, size * 0.98)).0;
    marks.push(TextMark { text: value.to_owned(), rect: r, size, alpha: 1.0 });
}

/// How far the editorial frame sits in from the top and bottom beyond its landscape place. On
/// a tall frame the platform's own buttons cover the edges, so it keeps to the title-safe
/// area a phone leaves clear (6% of the height); a source line above it moves up with it.
pub fn frame_inset(w: f32, h: f32) -> f32 {
    if h > w { (h * 0.06 - 40.0).max(0.0) } else { 0.0 }
}

/// The editorial frame: brand, section label, footers and a progress rail, in the colours of
/// the scene on screen (a toned scene re-derives them).
pub fn frame(
    canvas: &Canvas,
    spec: &Value,
    label: &str,
    w: f32,
    h: f32,
    p: &Palette,
    progress: f32,
    marks: &mut Vec<TextMark>,
) {
    let text_of = |key: &str| spec.get(key).and_then(Value::as_str).unwrap_or("").to_owned();
    // Its sides keep the margin block content keeps (wider on a tall frame, inside the middle 80%).
    let margin = if w / h > 1.3 {
        120.0
    } else if h > w {
        (w * 0.115).round()
    } else {
        86.0
    };
    let inset = frame_inset(w, h);
    let brand = text_of("brand");
    let label =
        if spec.get("label").and_then(Value::as_bool) == Some(false) { String::new() } else { label.to_uppercase() };
    let (left, right) = (text_of("left").to_uppercase(), text_of("right").to_uppercase());
    let mono = Font::Mono;
    let mut ink = Paint::default();
    ink.set_anti_alias(true);
    ink.set_color4f(hex(&p.ink, 1.0), None);
    let mut muted = ink.clone();
    muted.set_color4f(hex(&p.muted, 1.0), None);
    let rail_y = h - 46.0 - inset;
    let footer_y = rail_y - 16.0;
    draw_text(canvas, &brand, margin, 100.0 + inset, Font::SerifItalic, 44.0, 0.0, &ink, marks);
    let label_w = text::measure(mono, &label, 20.0, 2.4);
    draw_text(canvas, &label, w - margin - label_w, 74.0 + inset, mono, 20.0, 2.4, &muted, marks);
    // Footers at the smallest size a phone reads (the audit's floor).
    draw_text(canvas, &left, margin, footer_y, mono, 20.0, 2.2, &muted, marks);
    let right_w = text::measure(mono, &right, 20.0, 2.2);
    draw_text(canvas, &right, w - margin - right_w, footer_y, mono, 20.0, 2.2, &muted, marks);
    if spec.get("progress").and_then(Value::as_bool).unwrap_or(true) {
        let span = w - 2.0 * margin;
        let mut rail = Paint::default();
        rail.set_color4f(hex(&p.muted, 0.35), None);
        canvas.draw_rect(Rect::from_xywh(margin, rail_y, span, 2.0), &rail);
        if span * progress > 0.5 {
            let mut a = Paint::default();
            a.set_color4f(hex(&p.accent, 1.0), None);
            canvas.draw_rect(Rect::from_xywh(margin, rail_y - 1.0, span * progress, 4.0), &a);
        }
    }
}
