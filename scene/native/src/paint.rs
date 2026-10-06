//! Palette tokens, colours and gradients as Skia paints. Tokens resolve exactly as the canvas
//! block resolves them (`crate::design::Palette`), so a native layer and a block
//! drawn in the same film use the same colours.
use crate::design::{self, Palette};
use serde_json::Value;
use skia_safe::{self as sk, Color4f, Point, Shader, TileMode, gradient_shader};

pub const TOKENS: &[&str] =
    &["bg", "surface", "ink", "muted", "accent", "accent2", "positive", "negative", "line", "wash", "wash2", "none"];

/// `#rrggbb` → linear-free sRGB colour with alpha.
pub fn hex(hex: &str, alpha: f32) -> Color4f {
    let [r, g, b] = design::parse(hex).unwrap_or([0.0, 0.0, 0.0]);
    Color4f::new(r, g, b, alpha.clamp(0.0, 1.0))
}

pub fn color(c: Color4f) -> sk::Color {
    c.to_color()
}

/// A token or `#rrggbb` as a hex string; `None` for `none`.
pub fn token(p: &Palette, name: &str, fallback: &str) -> Option<String> {
    let v = match name {
        "bg" => p.bg.clone(),
        "surface" => p.surface.clone(),
        "ink" => p.ink.clone(),
        "muted" => p.muted.clone(),
        "accent" => p.accent.clone(),
        "accent2" => p.accent2.clone(),
        "positive" => p.positive.clone(),
        "negative" => p.negative.clone(),
        "line" => p.line(),
        "wash" => p.wash(&p.accent),
        "wash2" => p.wash(&p.accent2),
        "none" => return None,
        h if design::parse(h).is_some() => h.to_owned(),
        _ => return if fallback == "none" { None } else { token(p, fallback, "ink") },
    };
    Some(v)
}

pub fn paint_ok(v: Option<&Value>) -> bool {
    match v {
        None => true,
        Some(Value::String(s)) => TOKENS.contains(&s.as_str()) || design::parse(s).is_some(),
        Some(Value::Object(g)) => g.get("gradient").and_then(Value::as_array).is_some_and(|s| {
            (2..=4).contains(&s.len())
                && s.iter().all(|c| c.as_str().is_some_and(|c| c != "none" && paint_ok(Some(&Value::String(c.into())))))
        }),
        _ => false,
    }
}

/// A resolved fill or stroke: a flat colour or a gradient over the element's bounds.
#[derive(Clone)]
pub enum Fill {
    None,
    Solid(String),
    Gradient { stops: Vec<String>, radial: bool, angle: f32, fade: bool },
}

impl Fill {
    pub fn resolve(p: &Palette, v: Option<&Value>, fallback: &str) -> Fill {
        match v {
            Some(Value::String(name)) => token(p, name, fallback).map_or(Fill::None, Fill::Solid),
            Some(Value::Object(g)) => {
                let stops: Vec<String> = g
                    .get("gradient")
                    .and_then(Value::as_array)
                    .map(|s| s.iter().filter_map(Value::as_str).filter_map(|c| token(p, c, "accent")).collect())
                    .unwrap_or_default();
                if stops.len() < 2 {
                    return token(p, fallback, "ink").map_or(Fill::None, Fill::Solid);
                }
                Fill::Gradient {
                    stops,
                    radial: g.get("radial").and_then(Value::as_bool).unwrap_or(false),
                    angle: g.get("angle").and_then(Value::as_f64).unwrap_or(90.0) as f32,
                    fade: g.get("fade").and_then(Value::as_bool).unwrap_or(false),
                }
            }
            _ => token(p, fallback, "ink").map_or(Fill::None, Fill::Solid),
        }
    }
    pub fn is_none(&self) -> bool {
        matches!(self, Fill::None)
    }
    /// The colour to tint with when one is needed (a gradient's first stop).
    pub fn first(&self) -> Option<&str> {
        match self {
            Fill::None => None,
            Fill::Solid(c) => Some(c),
            Fill::Gradient { stops, .. } => stops.first().map(String::as_str),
        }
    }
    /// Configure `paint` for this fill over `bounds` (x, y, w, h) at `alpha`.
    pub fn apply(&self, paint: &mut sk::Paint, bounds: (f32, f32, f32, f32), alpha: f32) -> bool {
        match self {
            Fill::None => false,
            Fill::Solid(c) => {
                paint.set_color4f(hex(c, alpha), None);
                true
            }
            Fill::Gradient { stops, radial, angle, fade } => {
                let last = stops.len() - 1;
                let colors: Vec<sk::Color> = stops
                    .iter()
                    .enumerate()
                    .map(|(i, c)| color(hex(c, if *fade && i == last { 0.0 } else { 1.0 })))
                    .collect();
                let pos: Vec<f32> = (0..stops.len()).map(|i| i as f32 / last as f32).collect();
                let (x, y, w, h) = bounds;
                let shader: Option<Shader> = if *radial {
                    gradient_shader::radial(
                        Point::new(x + w / 2.0, y + h / 2.0),
                        0.5 * w.max(h).max(1.0),
                        colors.as_slice(),
                        Some(pos.as_slice()),
                        TileMode::Clamp,
                        None,
                        None,
                    )
                } else {
                    let a = angle.to_radians();
                    let (dx, dy) = (a.cos() * 0.5, a.sin() * 0.5);
                    gradient_shader::linear(
                        (
                            Point::new(x + (0.5 - dx) * w, y + (0.5 - dy) * h),
                            Point::new(x + (0.5 + dx) * w, y + (0.5 + dy) * h),
                        ),
                        colors.as_slice(),
                        Some(pos.as_slice()),
                        TileMode::Clamp,
                        None,
                        None,
                    )
                };
                paint.set_color4f(Color4f::new(0.0, 0.0, 0.0, alpha.clamp(0.0, 1.0)), None);
                paint.set_shader(shader);
                true
            }
        }
    }
}
