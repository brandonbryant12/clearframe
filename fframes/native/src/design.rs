//! Palette tokens, color arithmetic and film-level backdrops.
//!
//! Jobs normally carry a complete palette resolved by `fframes/catalog.mjs`; the preset
//! table here is the renderer-side fallback and is checked against the catalog by tests.
use fframes::Svgr;
use serde_json::Value;
use std::f32::consts::TAU;

/// bg, surface, ink, muted, accent, accent2, positive, negative.
pub const PRESETS: &[(&str, [&str; 8])] = &[
    ("paper", ["#f5f3ed", "#e9e7df", "#222831", "#616b76", "#315cce", "#c2641f", "#17745c", "#bd453c"]),
    ("ink", ["#101721", "#1d2938", "#f4f4ed", "#a4b2c4", "#76cbb8", "#f0b86e", "#83d3ac", "#f29a8a"]),
    ("editorial", ["#f7efe1", "#ebddc6", "#34281f", "#74604e", "#b13e2e", "#2f6b6f", "#477550", "#b13e2e"]),
    ("signal", ["#edf3f8", "#dce7f1", "#102e46", "#507089", "#006dae", "#c75a12", "#187659", "#bf493b"]),
    ("midnight", ["#0c1024", "#1a2040", "#eef0ff", "#a3abd0", "#9aa5ff", "#ffb86b", "#6fd6a8", "#ff8f85"]),
    ("forest", ["#0f1d17", "#1c3128", "#eef5ee", "#a6bcae", "#a3dc7f", "#f2c35b", "#a3dc7f", "#f39b84"]),
    ("ember", ["#1b1311", "#2c201b", "#fbefe6", "#c9ae9e", "#ff8a57", "#ffd27a", "#8fd3aa", "#ff8f85"]),
    ("mono", ["#fafafa", "#ececec", "#111111", "#595959", "#d12f1f", "#111111", "#1d7a4f", "#d12f1f"]),
];
const KEYS: [&str; 8] = ["bg", "surface", "ink", "muted", "accent", "accent2", "positive", "negative"];

#[derive(Clone, Debug)]
pub struct Palette {
    pub bg: String,
    pub surface: String,
    pub ink: String,
    pub muted: String,
    pub accent: String,
    pub accent2: String,
    pub positive: String,
    pub negative: String,
    /// Dark backgrounds need slightly stronger tints to read as the same emphasis.
    pub dark: bool,
}

impl Palette {
    pub fn from_theme(theme: &Value) -> Self {
        let base = theme.as_str().or_else(|| theme.get("base").and_then(Value::as_str)).unwrap_or("paper");
        let preset = PRESETS.iter().find(|(name, _)| *name == base).unwrap_or(&PRESETS[0]).1;
        let get = |index: usize| {
            theme.get(KEYS[index]).and_then(Value::as_str).filter(|v| parse(v).is_some())
                .unwrap_or(preset[index]).to_owned()
        };
        let bg = get(0);
        let dark = luminance(&bg) < 0.18;
        Self { bg, surface: get(1), ink: get(2), muted: get(3), accent: get(4), accent2: get(5),
            positive: get(6), negative: get(7), dark }
    }
    /// Hairlines for axes, rails and dividers: between surface and muted.
    pub fn line(&self) -> String { mix(&self.surface, &self.muted, if self.dark { 0.32 } else { 0.28 }) }
    /// A soft accent wash for markers, focus areas and badges.
    pub fn wash(&self, color: &str) -> String { mix(&self.bg, color, if self.dark { 0.26 } else { 0.18 }) }
    /// Ordered categorical colors: two hues, then quieter tints of each, then neutrals.
    pub fn series(&self, index: usize) -> String {
        match index % 6 {
            0 => self.accent.clone(),
            1 => self.accent2.clone(),
            2 => mix(&self.accent, &self.bg, 0.45),
            3 => mix(&self.accent2, &self.bg, 0.45),
            4 => self.muted.clone(),
            _ => mix(&self.muted, &self.bg, 0.5),
        }
    }
}

pub fn parse(hex: &str) -> Option<[f32; 3]> {
    let digits = hex.strip_prefix('#').filter(|d| d.len() == 6)?;
    let channel = |i: usize| u8::from_str_radix(&digits[i..i + 2], 16).ok().map(|v| v as f32 / 255.0);
    Some([channel(0)?, channel(2)?, channel(4)?])
}

fn to_hex([r, g, b]: [f32; 3]) -> String {
    let byte = |v: f32| (v.clamp(0.0, 1.0) * 255.0).round() as u8;
    format!("#{:02x}{:02x}{:02x}", byte(r), byte(g), byte(b))
}

/// Linear interpolation in sRGB; `t = 0` is `a`, `t = 1` is `b`. Invalid input returns `a`.
pub fn mix(a: &str, b: &str, t: f32) -> String {
    match (parse(a), parse(b)) {
        (Some(x), Some(y)) => to_hex([0, 1, 2].map(|i| x[i] + (y[i] - x[i]) * t.clamp(0.0, 1.0))),
        _ => a.to_owned(),
    }
}

pub fn luminance(hex: &str) -> f32 {
    let Some(rgb) = parse(hex) else { return 1.0 };
    let linear = rgb.map(|v| if v <= 0.04045 { v / 12.92 } else { ((v + 0.055) / 1.055).powf(2.4) });
    linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

/// Persistent film background. Every layer is a pure function of the global time.
pub fn backdrop<'a>(kind: &str, w: f32, h: f32, p: &Palette, seconds: f32) -> Svgr<'a> {
    let mut shapes = vec![];
    match kind {
        "grid" => {
            for x in (0..w as usize).step_by(80) {
                shapes.push(fframes::svgr!(<line x1={x} x2={x} y1="0" y2={h} stroke={p.muted.clone()} stroke-width="1" />));
            }
            for y in (0..h as usize).step_by(80) {
                shapes.push(fframes::svgr!(<line x1="0" x2={w} y1={y} y2={y} stroke={p.muted.clone()} stroke-width="1" />));
            }
        }
        "dots" => {
            for x in (24..w as usize).step_by(48) {
                for y in (24..h as usize).step_by(48) {
                    shapes.push(fframes::svgr!(<circle cx={x} cy={y} r="1.6" fill={p.muted.clone()} />));
                }
            }
        }
        "glow" => return glow(w, h, p, seconds),
        _ => {}
    }
    fframes::svgr!(<g opacity="0.09">{shapes}</g>)
}

/// Two broad, slowly drifting light pools in the palette's accents. Periods are long and
/// incommensurate so the motion never reads as a loop, and amplitudes stay small enough
/// that H.264 does not have to spend bits on it.
fn glow<'a>(w: f32, h: f32, p: &Palette, seconds: f32) -> Svgr<'a> {
    let drift = |period: f32, phase: f32| (TAU * seconds / period + phase).sin();
    let (ax, ay) = (w * (0.16 + 0.04 * drift(29.0, 0.0)), h * (0.18 + 0.05 * drift(23.0, 1.3)));
    let (bx, by) = (w * (0.86 + 0.03 * drift(31.0, 2.1)), h * (0.88 + 0.04 * drift(19.0, 0.4)));
    let radius = w.max(h) * 0.62;
    let (strong, soft) = if p.dark { (0.22, 0.14) } else { (0.13, 0.09) };
    fframes::svgr!(<g>
        <defs>
            <radialGradient id="cf-glow-a" gradientUnits="userSpaceOnUse" cx={ax} cy={ay} r={radius}>
                <stop offset="0" stop-color={p.accent.clone()} stop-opacity={strong} />
                <stop offset="1" stop-color={p.accent.clone()} stop-opacity="0" />
            </radialGradient>
            <radialGradient id="cf-glow-b" gradientUnits="userSpaceOnUse" cx={bx} cy={by} r={radius * 0.8}>
                <stop offset="0" stop-color={p.accent2.clone()} stop-opacity={soft} />
                <stop offset="1" stop-color={p.accent2.clone()} stop-opacity="0" />
            </radialGradient>
        </defs>
        <rect width={w} height={h} fill="url(#cf-glow-a)" />
        <rect width={w} height={h} fill="url(#cf-glow-b)" />
    </g>)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn palettes_accept_scoped_overrides_and_ignore_invalid_colors() {
        let p = Palette::from_theme(&serde_json::json!({"base":"ink","accent":"#FF8800","muted":"blue"}));
        assert_eq!(p.accent, "#FF8800");
        assert_eq!(p.bg, "#101721");
        assert_eq!(p.muted, "#a4b2c4");
        assert!(p.dark);
        assert!(!Palette::from_theme(&Value::Null).dark);
    }
    #[test]
    fn mixing_is_exact_at_the_ends_and_tolerates_bad_input() {
        assert_eq!(mix("#000000", "#ffffff", 0.0), "#000000");
        assert_eq!(mix("#000000", "#ffffff", 1.0), "#ffffff");
        assert_eq!(mix("#000000", "#ffffff", 0.5), "#808080");
        assert_eq!(mix("nope", "#ffffff", 0.5), "nope");
    }
    #[test]
    fn every_preset_keeps_readable_text_contrast() {
        let contrast = |a: &str, b: &str| {
            let (x, y) = (luminance(a), luminance(b));
            (x.max(y) + 0.05) / (x.min(y) + 0.05)
        };
        for (name, colors) in PRESETS {
            for index in [2, 3, 4] {
                assert!(contrast(colors[index], colors[0]) >= 4.5, "{name} {} contrast", KEYS[index]);
            }
            assert!(contrast(colors[5], colors[0]) >= 3.0, "{name} accent2 must hold graphics contrast");
        }
    }
}
