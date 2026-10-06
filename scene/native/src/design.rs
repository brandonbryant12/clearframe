//! Palette tokens and colour arithmetic.
//!
//! Jobs carry a complete palette resolved from library/palettes by `film/catalog.mjs`;
//! the renderer only fills gaps from a paper fallback.
use serde_json::Value;

/// Paper, the fallback for any colour a job leaves out. The palettes themselves live in
/// library/palettes/*.json; jobs carry the resolved colours, so the renderer keeps no copy.
const FALLBACK: [&str; 8] = ["#f5f3ed", "#e9e7df", "#222831", "#616b76", "#315cce", "#c2641f", "#17745c", "#bd453c"];
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
        let get = |index: usize| {
            theme
                .get(KEYS[index])
                .and_then(Value::as_str)
                .filter(|v| parse(v).is_some())
                .unwrap_or(FALLBACK[index])
                .to_owned()
        };
        let bg = get(0);
        let dark = luminance(&bg) < 0.18;
        Self {
            bg,
            surface: get(1),
            ink: get(2),
            muted: get(3),
            accent: get(4),
            accent2: get(5),
            positive: get(6),
            negative: get(7),
            dark,
        }
    }
    /// A colour-blocked variant: the frame takes `accent`, `accent2`, the inverse or the
    /// surface colour, and text/accent colours are re-chosen to stay readable on it.
    pub fn toned(self, tone: &str) -> Self {
        let bg = match tone {
            "accent" => self.accent.clone(),
            "accent2" => self.accent2.clone(),
            "invert" => self.ink.clone(),
            "surface" => self.surface.clone(),
            _ => return self,
        };
        let ink = if contrast(&self.ink, &bg) >= contrast(&self.bg, &bg) { self.ink.clone() } else { self.bg.clone() };
        let best = |options: &[&str], min: f32| -> String {
            options.iter().copied().find(|c| contrast(c, &bg) >= min).unwrap_or(ink.as_str()).to_owned()
        };
        let accent = best(&[&self.accent, &self.accent2], 3.0);
        let accent2 = best(&[&self.accent2, &self.accent], 3.0);
        let (positive, negative) = (best(&[&self.positive], 3.0), best(&[&self.negative], 3.0));
        Self {
            surface: mix(&bg, &ink, 0.1),
            muted: mix(&ink, &bg, 0.32),
            positive,
            negative,
            dark: luminance(&bg) < 0.18,
            accent,
            accent2,
            ink,
            bg,
        }
    }
    /// Hairlines for axes, rails and dividers: between surface and muted.
    pub fn line(&self) -> String {
        mix(&self.surface, &self.muted, if self.dark { 0.32 } else { 0.28 })
    }
    /// A soft accent wash for markers, focus areas and badges.
    pub fn wash(&self, color: &str) -> String {
        mix(&self.bg, color, if self.dark { 0.26 } else { 0.18 })
    }
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
    let digits = hex.strip_prefix('#').filter(|d| d.len() == 6 && d.bytes().all(|b| b.is_ascii_hexdigit()))?;
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

pub fn contrast(a: &str, b: &str) -> f32 {
    let (x, y) = (luminance(a), luminance(b));
    (x.max(y) + 0.05) / (x.min(y) + 0.05)
}

pub fn luminance(hex: &str) -> f32 {
    let Some(rgb) = parse(hex) else { return 1.0 };
    let linear = rgb.map(|v| if v <= 0.04045 { v / 12.92 } else { ((v + 0.055) / 1.055).powf(2.4) });
    linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    #[test]
    fn palettes_accept_scoped_overrides_and_ignore_invalid_colors() {
        let p = Palette::from_theme(&serde_json::json!({"bg":"#101721","accent":"#FF8800","muted":"blue"}));
        assert_eq!(p.accent, "#FF8800");
        assert_eq!(p.bg, "#101721");
        assert_eq!(p.muted, FALLBACK[3], "an invalid colour falls back");
        assert!(p.dark);
        assert!(!Palette::from_theme(&Value::Null).dark);
    }
    #[test]
    fn mixing_is_exact_at_the_ends_and_tolerates_bad_input() {
        assert_eq!(mix("#000000", "#ffffff", 0.0), "#000000");
        assert_eq!(mix("#000000", "#ffffff", 1.0), "#ffffff");
        assert_eq!(mix("#000000", "#ffffff", 0.5), "#808080");
        assert_eq!(mix("nope", "#ffffff", 0.5), "nope");
        assert_eq!(parse("#aébbb"), None, "non-ASCII input must not panic on a char boundary");
        assert_eq!(parse("#12345g"), None);
    }
    /// The library palettes, read from library/palettes/*.json (the single source of truth).
    pub(crate) fn library_palettes() -> Vec<(String, Value)> {
        let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../library/palettes");
        let mut out: Vec<(String, Value)> = std::fs::read_dir(&dir)
            .expect("library/palettes")
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.extension().is_some_and(|x| x == "json"))
            .map(|p| {
                let item: Value = serde_json::from_slice(&std::fs::read(&p).unwrap()).unwrap();
                (p.file_stem().unwrap().to_string_lossy().into_owned(), item["colors"].clone())
            })
            .collect();
        out.sort_by(|a, b| a.0.cmp(&b.0));
        assert!(out.len() >= 8, "found the library palettes");
        out
    }
    pub(crate) fn library_palette(name: &str) -> Value {
        library_palettes().into_iter().find(|(n, _)| n == name).expect("palette").1
    }
    #[test]
    fn toned_scenes_keep_readable_text_on_their_new_background() {
        // Library files already guarantee contrast on their own background; toned()
        // must keep text readable when a scene swaps the background for another role.
        for (name, colors) in library_palettes() {
            for tone in ["accent", "accent2", "invert", "surface"] {
                let p = Palette::from_theme(&colors).toned(tone);
                assert!(contrast(&p.ink, &p.bg) >= 3.0, "{name}/{tone} ink {}", contrast(&p.ink, &p.bg));
                assert!(contrast(&p.accent, &p.bg) >= 1.5, "{name}/{tone} accent");
            }
        }
    }
}
