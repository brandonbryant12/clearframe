//! Film-level picture, drawn natively: the persistent backdrop, vignette and grain, the film
//! chrome and editorial frame, and the lens (grade, bloom and aberration as GPU image filters
//! over the composed picture, a handheld drift, light leaks and letterbox bars). Values and
//! looks follow the FFFrames compositor (`fframes/native/src/{lib,design,lens}.rs`) so a film
//! keeps its look when it moves to this engine; grain and paper use Skia's implementation of
//! the same fractal-noise function the SVG path used.
use crate::fonts;
use crate::nodes::TextMark;
use crate::paint::{self, hex};
use clearframe_native::design::{self, Palette};
use clearframe_native::lens::{self, Lens};
use clearframe_native::text::{self, Font};
use fframes_skia_renderer::skia_safe::{
    self as sk, BlendMode, Canvas, Color4f, ImageFilter, Paint, PaintStyle, Point, Rect, TileMode, color_filters,
    gradient_shader, image_filters, perlin_noise_shader,
};
use serde_json::Value;
use std::collections::HashMap;
use std::f32::consts::TAU;
use std::cell::RefCell;
use std::rc::Rc;

fn radial(cx: f32, cy: f32, r: f32, stops: &[(f32, &str, f32)]) -> Option<sk::Shader> {
    let colors: Vec<sk::Color> = stops.iter().map(|(_, c, a)| paint::color(hex(c, *a))).collect();
    let pos: Vec<f32> = stops.iter().map(|(o, _, _)| *o).collect();
    gradient_shader::radial(Point::new(cx, cy), r.max(1.0), colors.as_slice(), Some(pos.as_slice()), TileMode::Clamp, None, None)
}

/// Persistent film background; every layer a pure function of film seconds.
pub fn backdrop(canvas: &Canvas, kind: &str, w: f32, h: f32, p: &Palette, seconds: f32) {
    match kind {
        "grid" | "dots" => {
            canvas.save_layer_alpha_f(None, 0.09);
            let mut paint = Paint::default();
            paint.set_anti_alias(true);
            paint.set_color4f(hex(&p.muted, 1.0), None);
            if kind == "grid" {
                paint.set_style(PaintStyle::Stroke);
                paint.set_stroke_width(1.0);
                for x in (0..w as usize).step_by(80) {
                    canvas.draw_line((x as f32, 0.0), (x as f32, h), &paint);
                }
                for y in (0..h as usize).step_by(80) {
                    canvas.draw_line((0.0, y as f32), (w, y as f32), &paint);
                }
            } else {
                for x in (24..w as usize).step_by(48) {
                    for y in (24..h as usize).step_by(48) {
                        canvas.draw_circle((x as f32, y as f32), 1.6, &paint);
                    }
                }
            }
            canvas.restore();
        }
        "glow" => {
            let drift = |period: f32, phase: f32| (TAU * seconds / period + phase).sin();
            let (ax, ay) = (w * (0.16 + 0.04 * drift(29.0, 0.0)), h * (0.18 + 0.05 * drift(23.0, 1.3)));
            let (bx, by) = (w * (0.86 + 0.03 * drift(31.0, 2.1)), h * (0.88 + 0.04 * drift(19.0, 0.4)));
            let radius = w.max(h) * 0.62;
            let (strong, soft) = if p.dark { (0.22, 0.14) } else { (0.13, 0.09) };
            for (cx, cy, r, c, a) in [(ax, ay, radius, &p.accent, strong), (bx, by, radius * 0.8, &p.accent2, soft)] {
                let mut paint = Paint::default();
                paint.set_shader(radial(cx, cy, r, &[(0.0, c, a), (1.0, c, 0.0)]));
                canvas.draw_rect(Rect::from_wh(w, h), &paint);
            }
        }
        "paper" => {
            // Soft blotches and fine fibres: fractal noise turned to a grey of varying alpha.
            for (freq, octaves, seed, slope, intercept, alpha) in
                [((0.004, 0.004), 3, 11.0, 1.4, -0.55, 0.07), ((0.9, 0.06), 2, 4.0, 2.2, -1.25, 0.08)]
            {
                let mut paint = Paint::default();
                paint.set_shader(perlin_noise_shader::fractal_noise(freq, octaves, seed, None));
                // The SVG filter curves the noise's alpha, then the rect's opacity scales the
                // result. Skia applies paint alpha before the colour filter, so the opacity is
                // folded into the curve instead (the curve stays below 1, so clamping agrees).
                let m = [
                    0.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.5,
                    0.0, 0.0, 0.0, slope * alpha, intercept * alpha,
                ];
                paint.set_color_filter(color_filters::matrix_row_major(&m, None));
                canvas.draw_rect(Rect::from_wh(w, h), &paint);
            }
        }
        "mosaic" => mosaic_bed(canvas, w, h, p),
        _ => {}
    }
}

fn mosaic_bed(canvas: &Canvas, w: f32, h: f32, p: &Palette) {
    type Bed = Rc<(String, Vec<(String, sk::Path)>)>;
    thread_local! {
        static CACHE: RefCell<HashMap<String, Bed>> = RefCell::new(HashMap::new());
    }
    let key = format!("{w}x{h}{}", p.bg);
    let hit = CACHE.with(|c| c.borrow().get(&key).cloned());
    let bed = hit.unwrap_or_else(|| {
        let hash = |a: u64, b: u64| {
            let mut z = a.wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ b.wrapping_mul(0xBF58_476D_1CE4_E5B9);
            z = (z ^ (z >> 29)).wrapping_mul(0x94D0_49BB_1331_11EB);
            ((z ^ (z >> 32)) & 0xFFFF) as f32 / 65535.0
        };
        let (tile, gap) = (22.0f32, 3.0f32);
        let pitch = tile + gap;
        let mut paths: Vec<sk::PathBuilder> = (0..5).map(|_| sk::PathBuilder::new()).collect();
        let diag = (w * w + h * h).sqrt() / 2.0;
        for r in 0..(h / pitch).ceil() as u64 + 1 {
            let y = (r as f32 + 0.5) * pitch;
            let shift = if r % 2 == 1 { pitch / 2.0 } else { 0.0 };
            for c in 0..(w / pitch).ceil() as u64 + 2 {
                let x = (c as f32 - 0.5) * pitch + shift;
                let centre = 1.0 - ((x - w / 2.0).hypot(y - h / 2.0) / diag).min(1.0);
                let level = ((hash(r, c) * 2.6 + centre * 2.2) as usize).min(4);
                let a = (hash(c, r) - 0.5) * 0.12;
                let (jx, jy) = ((hash(r ^ 7, c) - 0.5) * 2.0, (hash(r, c ^ 7) - 0.5) * 2.0);
                let s = tile * (0.94 + 0.08 * hash(r ^ 3, c ^ 5)) / 2.0;
                let (cs, sn) = (a.cos(), a.sin());
                let out = &mut paths[level];
                for (i, (u, v)) in [(-1.0f32, -1.0f32), (1.0, -1.0), (1.0, 1.0), (-1.0, 1.0)].into_iter().enumerate() {
                    // One decimal, as the SVG bed was written.
                    let pt = (
                        ((x + jx + (u * cs - v * sn) * s) * 10.0).round() / 10.0,
                        ((y + jy + (u * sn + v * cs) * s) * 10.0).round() / 10.0,
                    );
                    if i == 0 {
                        out.move_to(pt);
                    } else {
                        out.line_to(pt);
                    }
                }
                out.close();
            }
        }
        let (toward, grout) = if p.dark { ("#ffffff", design::mix(&p.bg, "#000000", 0.5)) } else { ("#000000", design::mix(&p.bg, "#000000", 0.3)) };
        let shades = paths.into_iter().enumerate().map(|(i, mut d)| (design::mix(&p.bg, toward, 0.02 + 0.03 * i as f32), d.detach())).collect();
        let bed = Rc::new((grout, shades));
        CACHE.with(|c| c.borrow_mut().insert(key, bed.clone()));
        bed
    });
    let (grout, shades) = &*bed;
    let mut paint = Paint::default();
    paint.set_anti_alias(true);
    paint.set_color4f(hex(grout, 1.0), None);
    canvas.draw_rect(Rect::from_wh(w, h), &paint);
    for (c, path) in shades {
        paint.set_color4f(hex(c, 1.0), None);
        canvas.draw_path(path, &paint);
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
    paint.set_shader(radial(w / 2.0, h / 2.0, (w * w + h * h).sqrt() * 0.56, &[(0.45, edge, 0.0), (1.0, edge, strength)]));
    canvas.draw_rect(Rect::from_wh(w, h), &paint);
}

/// Grain over everything: static unless `animate`, then it changes eight times a second.
pub fn grain(canvas: &Canvas, texture: &Value, w: f32, h: f32, p: &Palette, seconds: f32) {
    let g = amount(texture, "grain");
    if g <= 0.0 {
        return;
    }
    let animate = texture.get("animate").and_then(Value::as_bool).unwrap_or(texture.as_str() == Some("film"));
    let seed = if animate { ((seconds * 8.0).floor() as i32 % 97 + 1) as f32 } else { 7.0 };
    let opacity = g * if p.dark { 0.16 } else { 0.12 };
    let mut paint = Paint::default();
    paint.set_shader(grain_shader(seed));
    canvas.save_layer_alpha_f(None, opacity);
    paint.set_blend_mode(BlendMode::Overlay);
    canvas.draw_rect(Rect::from_wh(w, h), &paint);
    canvas.restore();
}

/// Fractal noise turned to opaque grey, as the FFFrames grain filter does (its colour matrix
/// averages the noise's channels and sets alpha to 1): the grain's strength is the layer's
/// opacity alone.
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
fn draw_text(canvas: &Canvas, value: &str, x: f32, y: f32, font: Font, size: f32, tracking: f32, paint: &Paint, marks: &mut Vec<TextMark>) {
    if value.is_empty() {
        return;
    }
    fonts::draw_run(canvas, value, x, y, font, size, tracking, paint);
    let w = text::measure(font, value, size, tracking);
    let m = canvas.local_to_device_as_3x3();
    let r = m.map_rect(Rect::from_xywh(x, y - size * 0.74, w, size * 0.98)).0;
    marks.push(TextMark { text: value.to_owned(), rect: r, size, alpha: 1.0 });
}

/// The editorial frame: brand, section label, footers and a progress rail, in the colours of
/// the scene on screen (a toned scene re-derives them).
pub fn frame(canvas: &Canvas, spec: &Value, label: &str, w: f32, h: f32, p: &Palette, progress: f32, marks: &mut Vec<TextMark>) {
    let text_of = |key: &str| spec.get(key).and_then(Value::as_str).unwrap_or("").to_owned();
    let margin = if w / h > 1.3 { 120.0 } else { 86.0 };
    let brand = text_of("brand");
    let label = if spec.get("label").and_then(Value::as_bool) == Some(false) { String::new() } else { label.to_uppercase() };
    let (left, right) = (text_of("left").to_uppercase(), text_of("right").to_uppercase());
    let mono = Font::Mono;
    let mut ink = Paint::default();
    ink.set_anti_alias(true);
    ink.set_color4f(hex(&p.ink, 1.0), None);
    let mut muted = ink.clone();
    muted.set_color4f(hex(&p.muted, 1.0), None);
    let rail_y = h - 46.0;
    let footer_y = rail_y - 16.0;
    draw_text(canvas, &brand, margin, 100.0, Font::SerifItalic, 44.0, 0.0, &ink, marks);
    let label_w = text::measure(mono, &label, 20.0, 2.4);
    draw_text(canvas, &label, w - margin - label_w, 74.0, mono, 20.0, 2.4, &muted, marks);
    draw_text(canvas, &left, margin, footer_y, mono, 18.0, 2.2, &muted, marks);
    let right_w = text::measure(mono, &right, 18.0, 2.2);
    draw_text(canvas, &right, w - margin - right_w, footer_y, mono, 18.0, 2.2, &muted, marks);
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

fn look(name: &str) -> Option<(f32, [f32; 6], [f32; 6], [f32; 6])> {
    Some(match name {
        "teal-orange" => {
            (1.08, [0.0, 0.17, 0.40, 0.64, 0.86, 1.0], [0.02, 0.20, 0.41, 0.61, 0.80, 0.96], [0.08, 0.26, 0.43, 0.58, 0.74, 0.88])
        }
        "warm" => (1.04, [0.0, 0.22, 0.43, 0.63, 0.82, 1.0], [0.0, 0.20, 0.40, 0.60, 0.79, 0.97], [0.0, 0.17, 0.35, 0.54, 0.73, 0.90]),
        "cool" => (0.96, [0.0, 0.17, 0.36, 0.56, 0.76, 0.94], [0.0, 0.20, 0.40, 0.60, 0.80, 0.98], [0.03, 0.24, 0.44, 0.64, 0.83, 1.0]),
        "bleach" => {
            let c = [0.0, 0.12, 0.36, 0.66, 0.90, 1.0];
            (0.5, c, c, c)
        }
        "mono" => {
            let c = [0.0, 0.16, 0.38, 0.62, 0.85, 1.0];
            (0.0, c, c, c)
        }
        "noir" => {
            let c = [0.0, 0.06, 0.26, 0.62, 0.90, 1.0];
            (0.0, c, c, c)
        }
        "sepia" => (0.0, [0.05, 0.28, 0.50, 0.70, 0.87, 1.0], [0.03, 0.22, 0.42, 0.62, 0.80, 0.94], [0.02, 0.15, 0.32, 0.50, 0.68, 0.80]),
        _ => return None,
    })
}

/// An SVG `table` transfer function (`feFuncX type="table"`) as a 256-entry lookup.
fn table(curve: [f32; 6], amount: f32) -> [u8; 256] {
    let v: Vec<f32> = curve.iter().enumerate().map(|(i, c)| i as f32 / 5.0 + (c - i as f32 / 5.0) * amount).collect();
    let n = (v.len() - 1) as f32;
    let mut out = [0u8; 256];
    for (i, o) in out.iter_mut().enumerate() {
        let c = i as f32 / 255.0;
        let k = ((c * n).floor() as usize).min(v.len() - 2);
        let y = v[k] + (c - k as f32 / n) * n * (v[k + 1] - v[k]);
        *o = (y.clamp(0.0, 1.0) * 255.0).round() as u8;
    }
    out
}

fn matrix(m: [f32; 20]) -> sk::ColorFilter {
    color_filters::matrix_row_major(&m, None)
}

/// Grade, then bloom on the highlights, then aberration: one GPU filter graph over the picture.
pub fn lens_filter(l: &Lens, h: f32) -> Option<ImageFilter> {
    let graded = look(&l.grade).filter(|_| l.grade_amount > 0.0);
    if graded.is_none() && l.bloom <= 0.0 && l.aberration <= 0.0 {
        return None;
    }
    let mut last: Option<ImageFilter> = None;
    if let Some((sat, r, g, b)) = graded {
        let s = 1.0 + (sat - 1.0) * l.grade_amount;
        let m = [
            0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0.0, 0.0,
            0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0.0, 0.0,
            0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0.0, 0.0,
            0.0, 0.0, 0.0, 1.0, 0.0,
        ];
        last = image_filters::color_filter(matrix(m), last, None);
        let (tr, tg, tb) = (table(r, l.grade_amount), table(g, l.grade_amount), table(b, l.grade_amount));
        last = image_filters::color_filter(color_filters::table_argb(None, &tr, &tg, &tb)?, last, None);
    }
    if l.bloom > 0.0 {
        let spread = (8.0 + 22.0 * l.bloom) * h / 1080.0;
        let gain = 0.3 + 0.6 * l.bloom;
        let hi = image_filters::color_filter(
            matrix([2.5, 0.0, 0.0, 0.0, -1.5, 0.0, 2.5, 0.0, 0.0, -1.5, 0.0, 0.0, 2.5, 0.0, -1.5, 0.0, 0.0, 0.0, 1.0, 0.0]),
            last.clone(),
            None,
        );
        let glow = image_filters::blur((spread, spread), TileMode::Decal, hi, None);
        let glow = image_filters::color_filter(
            matrix([gain, 0.0, 0.0, 0.0, 0.0, 0.0, gain, 0.0, 0.0, 0.0, 0.0, 0.0, gain, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0]),
            glow,
            None,
        );
        last = image_filters::blend(BlendMode::Screen, last, glow, None);
    }
    if l.aberration > 0.0 {
        let px = 3.2 * l.aberration * h / 1080.0;
        let only = |i: usize| {
            let mut m = [0.0f32; 20];
            m[i * 5 + i] = 1.0;
            m[18] = 1.0;
            m
        };
        let r = image_filters::offset((px, 0.0), image_filters::color_filter(matrix(only(0)), last.clone(), None), None);
        let g = image_filters::color_filter(matrix(only(1)), last.clone(), None);
        let b = image_filters::offset((-px, 0.0), image_filters::color_filter(matrix(only(2)), last, None), None);
        let rg = image_filters::blend(BlendMode::Screen, g, r, None);
        last = image_filters::blend(BlendMode::Screen, rg, b, None);
    }
    last
}

/// The handheld operator: a slow seeded sway and roll with slight overscan.
pub fn handheld(canvas: &Canvas, amount: f32, seconds: f32, w: f32, h: f32) {
    if amount <= 0.0 {
        return;
    }
    let wave = |f: [f32; 3], p: [f32; 3]| {
        0.6 * (TAU * f[0] * seconds + p[0]).sin() + 0.3 * (TAU * f[1] * seconds + p[1]).sin() + 0.1 * (TAU * f[2] * seconds + p[2]).sin()
    };
    let reach = amount * 0.006 * w;
    let dx = reach * wave([0.19, 0.53, 1.37], [1.3, 0.2, 2.1]);
    let dy = reach * 0.7 * wave([0.23, 0.61, 1.61], [0.4, 2.6, 1.1]);
    let roll = amount * 0.3 * wave([0.11, 0.37, 0.89], [2.2, 1.0, 0.3]);
    let over = 1.0 + amount * 0.022;
    let (cx, cy) = (w / 2.0, h / 2.0);
    canvas.translate((dx, dy));
    canvas.rotate(roll, Some(Point::new(cx, cy)));
    canvas.translate((cx, cy));
    canvas.scale((over, over));
    canvas.translate((-cx, -cy));
}

pub fn leak(canvas: &Canvas, amount: f32, seconds: f32, w: f32, h: f32, p: &Palette) {
    if amount <= 0.0 {
        return;
    }
    let t = seconds;
    let strength = amount * if p.dark { 0.55 } else { 0.3 };
    let mut layer = Paint::default();
    layer.set_alpha_f(strength);
    layer.set_blend_mode(BlendMode::Screen);
    canvas.save_layer(&sk::canvas::SaveLayerRec::default().paint(&layer));
    let blobs = [
        (
            w * (-0.04 + 0.1 * (0.13 * TAU * t / 4.0).sin()),
            h * (0.32 + 0.2 * (0.21 * TAU * t / 4.0 + 1.0).sin()),
            w * 0.42 * (1.0 + 0.12 * (0.3 * t).sin()),
            "#ffd9a0".to_owned(),
            "#ff7a3c".to_owned(),
            0.75 + 0.25 * (0.17 * TAU * t / 3.0).sin(),
        ),
        (
            w * (1.03 + 0.08 * (0.11 * TAU * t / 4.0 + 2.0).sin()),
            h * (0.72 + 0.15 * (0.19 * TAU * t / 4.0).sin()),
            w * 0.36 * (1.0 + 0.1 * (0.23 * t + 1.0).sin()),
            "#ffe2b8".to_owned(),
            p.accent2.clone(),
            0.55 + 0.35 * (0.13 * TAU * t / 3.0 + 1.4).sin(),
        ),
    ];
    for (cx, cy, r, inner, outer, a) in blobs {
        canvas.save_layer_alpha_f(None, a.clamp(0.0, 1.0));
        let mut paint = Paint::default();
        paint.set_shader(radial(cx, cy, r, &[(0.0, &inner, 0.95), (0.4, &outer, 0.45), (1.0, &outer, 0.0)]));
        canvas.draw_rect(Rect::from_wh(w, h), &paint);
        canvas.restore();
    }
    canvas.restore();
}

pub fn letterbox(canvas: &Canvas, bar: f32, w: f32, h: f32) {
    if bar <= 0.25 {
        return;
    }
    let mut p = Paint::default();
    p.set_anti_alias(true);
    p.set_color4f(Color4f::new(0.0, 0.0, 0.0, 1.0), None);
    canvas.draw_rect(Rect::from_xywh(0.0, 0.0, w, bar), &p);
    canvas.draw_rect(Rect::from_xywh(0.0, h - bar, w, bar), &p);
}

pub fn bar(l: &Lens, w: f32, h: f32) -> f32 {
    lens::bar(l.letterbox, w, h)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn transfer_tables_match_the_svg_definition_at_their_knots() {
        let t = table([0.0, 0.2, 0.4, 0.6, 0.8, 1.0], 1.0);
        for (i, v) in t.iter().enumerate() {
            assert!((*v as i32 - i as i32).abs() <= 1, "identity curve stays identity at {i}");
        }
        let noir = table([0.0, 0.06, 0.26, 0.62, 0.90, 1.0], 1.0);
        assert_eq!(noir[0], 0);
        assert_eq!(noir[255], 255);
        assert_eq!(noir[51], (0.06f32 * 255.0).round() as u8);
        assert!(lens_filter(&Lens::from(&Value::Null), 1080.0).is_none());
        assert!(lens_filter(&Lens::from(&serde_json::json!({"grade":"teal-orange","bloom":0.5,"aberration":0.3})), 1080.0).is_some());
    }
}
