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
    ("pop", ["#ffd84a", "#ffe685", "#141414", "#4a3f12", "#b01030", "#1d3fbf", "#0f6b3a", "#b3122b"]),
    ("electric", ["#08080f", "#16162a", "#f4f4ff", "#a6a8c8", "#5cf2d6", "#ff5ccd", "#5cf2a0", "#ff7a90"]),
    ("blueprint", ["#0d2b52", "#173d6e", "#f1f6ff", "#a9c1e3", "#7fd4ff", "#ffd166", "#8ee3b4", "#ff9e8f"]),
    ("clay", ["#efe3d6", "#e2d2c1", "#2b1d17", "#6b5446", "#a8431f", "#2e5f6e", "#3f6b43", "#a8431f"]),
    ("noir", ["#111111", "#1d1d1d", "#f2efe9", "#a39e96", "#e9c46a", "#e76f51", "#8fbf9f", "#e76f51"]),
    ("sketchbook", ["#f2ecdf", "#e6dece", "#433e39", "#6d655c", "#c2344d", "#3a67b3", "#3b7449", "#c2344d"]),
    ("mosaic", ["#16225e", "#223387", "#f3ead3", "#9aa6cf", "#e9b949", "#e2643c", "#3cc0b4", "#e2643c"]),
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
            theme
                .get(KEYS[index])
                .and_then(Value::as_str)
                .filter(|v| parse(v).is_some())
                .unwrap_or(preset[index])
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

/// Persistent film background. Every layer is a pure function of the global time.
pub fn backdrop<'a>(kind: &str, w: f32, h: f32, p: &Palette, seconds: f32) -> Svgr<'a> {
    let mut shapes = vec![];
    match kind {
        "grid" => {
            for x in (0..w as usize).step_by(80) {
                shapes.push(
                    fframes::svgr!(<line x1={x} x2={x} y1="0" y2={h} stroke={p.muted.clone()} stroke-width="1" />),
                );
            }
            for y in (0..h as usize).step_by(80) {
                shapes.push(
                    fframes::svgr!(<line x1="0" x2={w} y1={y} y2={y} stroke={p.muted.clone()} stroke-width="1" />),
                );
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
        "paper" => return paper(w, h, p),
        "mosaic" => return mosaic_bed(w, h, p),
        _ => {}
    }
    fframes::svgr!(<g opacity="0.09">{shapes}</g>)
}

/// The ground a mosaic film is set in: running-bond rows of small tesserae in shades of the
/// background on darker grout, a little brighter towards the centre. Static and cached per
/// frame size and palette, so it costs a handful of paths a frame.
fn mosaic_bed<'a>(w: f32, h: f32, p: &Palette) -> Svgr<'a> {
    use std::collections::HashMap;
    use std::sync::{Arc, Mutex, OnceLock};
    type Bed = Arc<(String, Vec<(String, String)>)>;
    static CACHE: OnceLock<Mutex<HashMap<String, Bed>>> = OnceLock::new();
    let key = format!("{w}x{h}{}", p.bg);
    let cache = CACHE.get_or_init(Default::default);
    let hit = cache.lock().unwrap().get(&key).cloned();
    let bed = hit.unwrap_or_else(|| {
        let hash = |a: u64, b: u64| {
            let mut z = a.wrapping_mul(0x9E37_79B9_7F4A_7C15) ^ b.wrapping_mul(0xBF58_476D_1CE4_E5B9);
            z = (z ^ (z >> 29)).wrapping_mul(0x94D0_49BB_1331_11EB);
            ((z ^ (z >> 32)) & 0xFFFF) as f32 / 65535.0
        };
        let (tile, gap) = (22.0f32, 3.0f32);
        let pitch = tile + gap;
        let mut paths = vec![String::new(); 5];
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
                for (i, (u, v)) in [(-1.0, -1.0), (1.0, -1.0), (1.0, 1.0), (-1.0, 1.0)].into_iter().enumerate() {
                    let (px, py) = (x + jx + (u * cs - v * sn) * s, y + jy + (u * sn + v * cs) * s);
                    out.push_str(&format!("{}{:.1} {:.1}", if i == 0 { "M" } else { "L" }, px, py));
                }
                out.push('Z');
            }
        }
        let (toward, grout) =
            if p.dark { ("#ffffff", mix(&p.bg, "#000000", 0.5)) } else { ("#000000", mix(&p.bg, "#000000", 0.3)) };
        let shades =
            paths.into_iter().enumerate().map(|(i, d)| (mix(&p.bg, toward, 0.02 + 0.03 * i as f32), d)).collect();
        let bed = Arc::new((grout, shades));
        cache.lock().unwrap().insert(key, bed.clone());
        bed
    });
    let (grout, shades) = &*bed;
    let tiles: Vec<_> =
        shades.iter().map(|(color, d)| fframes::svgr!(<path d={d.clone()} fill={color.clone()} />)).collect();
    fframes::svgr!(<g><rect width={w} height={h} fill={grout.clone()} />{tiles}</g>)
}

/// Drawing paper: soft blotches and fine fibres over the palette background. Static, so it
/// costs almost nothing to encode.
fn paper<'a>(w: f32, h: f32, p: &Palette) -> Svgr<'a> {
    let tone = if p.dark { "#ffffff" } else { "#6b5a3e" };
    fframes::svgr!(<g>
        <defs>
            <filter id="cf-paper-blotch" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="3" seed="11" />
                <feColorMatrix type="matrix" values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 1.4 -0.55" />
            </filter>
            <filter id="cf-paper-fibre" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.9 0.06" numOctaves="2" seed="4" />
                <feColorMatrix type="matrix" values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 2.2 -1.25" />
            </filter>
        </defs>
        <rect width={w} height={h} fill={tone.to_owned()} filter="url(#cf-paper-blotch)" opacity="0.07" />
        <rect width={w} height={h} fill={tone.to_owned()} filter="url(#cf-paper-fibre)" opacity="0.08" />
    </g>)
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

/// Film-wide surface: a vignette under the scenes and optional grain over everything.
/// Grain is static unless `animate` is set, when it changes eight times a second (a filmic
/// flicker that costs encoder bits; keep it for films that want a tactile look).
pub fn texture<'a>(texture: &Value, w: f32, h: f32, p: &Palette, seconds: f32) -> (Svgr<'a>, Svgr<'a>) {
    let amount = |key: &str| -> f32 {
        match texture {
            Value::String(s) => match (s.as_str(), key) {
                ("film", _) => 0.6,
                ("grain", "grain") | ("vignette", "vignette") => 0.6,
                _ => 0.0,
            },
            Value::Object(_) => texture.get(key).and_then(Value::as_f64).unwrap_or(0.0).clamp(0.0, 1.0) as f32,
            _ => 0.0,
        }
    };
    let (grain, vignette) = (amount("grain"), amount("vignette"));
    let animate = texture.get("animate").and_then(Value::as_bool).unwrap_or(texture.as_str() == Some("film"));
    let vignette_node = if vignette > 0.0 {
        let edge = if p.dark { "#000000" } else { p.ink.as_str() };
        let strength = vignette * if p.dark { 0.55 } else { 0.22 };
        fframes::svgr!(<g>
            <defs><radialGradient id="cf-vignette" gradientUnits="userSpaceOnUse" cx={w / 2.0} cy={h / 2.0} r={(w * w + h * h).sqrt() * 0.56}>
                <stop offset="0.45" stop-color={edge.to_owned()} stop-opacity="0" />
                <stop offset="1" stop-color={edge.to_owned()} stop-opacity={strength} />
            </radialGradient></defs>
            <rect width={w} height={h} fill="url(#cf-vignette)" />
        </g>)
    } else {
        fframes::svgr!(<g />)
    };
    let grain_node = if grain > 0.0 {
        let seed = if animate { (seconds * 8.0).floor() as i32 % 97 + 1 } else { 7 };
        let opacity = grain * if p.dark { 0.16 } else { 0.12 };
        fframes::svgr!(<g opacity={opacity}>
            <defs><filter id="cf-grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
                <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} stitchTiles="stitch" />
                <feColorMatrix type="matrix" values="0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0.33 0.33 0.33 0 0 0 0 0 0 1" />
            </filter></defs>
            <rect width={w} height={h} filter="url(#cf-grain)" mix-blend-mode="overlay" />
        </g>)
    } else {
        fframes::svgr!(<g />)
    };
    (vignette_node, grain_node)
}

/// A labelled coordinate grid for placing art: thin lines every 100 px, labels every 200.
pub fn guides<'a>(w: f32, h: f32) -> Svgr<'a> {
    let mut nodes = vec![];
    for x in (0..=w as usize).step_by(100) {
        let major = x % 200 == 0;
        nodes.push(fframes::svgr!(<line x1={x} x2={x} y1="0" y2={h} stroke="#ff2d7a" stroke-width={if major { 1.4 } else { 0.7 }} opacity="0.55" />));
        if major && x > 0 {
            nodes.push(fframes::svgr!(<text x={x as f32 + 4.0} y="22" font-family="Inter" font-size="18" font-weight="600" fill="#ff2d7a">{x.to_string()}</text>));
        }
    }
    for y in (0..=h as usize).step_by(100) {
        let major = y % 200 == 0;
        nodes.push(fframes::svgr!(<line x1="0" x2={w} y1={y} y2={y} stroke="#ff2d7a" stroke-width={if major { 1.4 } else { 0.7 }} opacity="0.55" />));
        if major && y > 0 {
            nodes.push(fframes::svgr!(<text x="4" y={y as f32 - 4.0} font-family="Inter" font-size="18" font-weight="600" fill="#ff2d7a">{y.to_string()}</text>));
        }
    }
    fframes::svgr!(<g>{nodes}</g>)
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
        assert_eq!(parse("#aébbb"), None, "non-ASCII input must not panic on a char boundary");
        assert_eq!(parse("#12345g"), None);
    }
    #[test]
    fn toned_scenes_keep_readable_text_on_their_new_background() {
        for (name, _) in PRESETS {
            for tone in ["accent", "accent2", "invert", "surface"] {
                let p = Palette::from_theme(&Value::String((*name).into())).toned(tone);
                assert!(contrast(&p.ink, &p.bg) >= 3.0, "{name}/{tone} ink {}", contrast(&p.ink, &p.bg));
                assert!(contrast(&p.accent, &p.bg) >= 1.5, "{name}/{tone} accent");
            }
        }
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
