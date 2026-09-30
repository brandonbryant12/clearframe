//! The film lens: letterbox, grade, bloom, chromatic aberration, light leaks and a handheld
//! drift, applied over the composed frame. Each beat carries its resolved `lens` (film
//! settings merged with the beat's own), so every effect is a pure function of the frame.
use crate::design::Palette;
use fframes::Svgr;
use serde_json::Value;
use std::f32::consts::TAU;

#[derive(Clone, Debug, Default, PartialEq)]
pub struct Lens {
    /// Picture aspect inside black bars (2.39, 2, 1.85); 0 for none.
    pub letterbox: f32,
    pub grade: String,
    pub grade_amount: f32,
    pub bloom: f32,
    pub aberration: f32,
    pub leak: f32,
    pub handheld: f32,
    /// Shutter for motion blur on camera moves: 0.5 is a 180° shutter.
    pub blur: f32,
}

impl Lens {
    pub fn from(v: &Value) -> Self {
        let unit = |k: &str| v.get(k).and_then(Value::as_f64).unwrap_or(0.0).clamp(0.0, 1.0) as f32;
        Lens {
            letterbox: v.get("letterbox").and_then(Value::as_f64).unwrap_or(0.0).clamp(0.0, 4.0) as f32,
            grade: v.get("grade").and_then(Value::as_str).unwrap_or("none").to_owned(),
            grade_amount: v.get("gradeAmount").and_then(Value::as_f64).map_or(0.7, |x| x.clamp(0.0, 1.0) as f32),
            bloom: unit("bloom"),
            aberration: unit("aberration"),
            leak: unit("leak"),
            handheld: unit("handheld"),
            blur: unit("blur"),
        }
    }
    fn filtered(&self) -> bool {
        (self.grade != "none" && self.grade_amount > 0.0) || self.bloom > 0.0 || self.aberration > 0.0
    }
}

/// Height of each black bar for a picture `aspect` in a `w`×`h` frame (0 when it fits).
/// Letterbox is a landscape convention: vertical and square frames keep their full height.
pub fn bar(aspect: f32, w: f32, h: f32) -> f32 {
    if aspect <= 0.0 || h >= w || w / aspect >= h { 0.0 } else { (h - w / aspect) / 2.0 }
}

/// Tone curves per look: (saturation, red, green, blue), each curve six points from black
/// to white. Split-toning lives in the curves: teal-orange lifts blue in the shadows and red
/// in the highlights, as a colourist would.
fn look(name: &str) -> Option<(f32, [f32; 6], [f32; 6], [f32; 6])> {
    Some(match name {
        "teal-orange" => (
            1.08,
            [0.0, 0.17, 0.40, 0.64, 0.86, 1.0],
            [0.02, 0.20, 0.41, 0.61, 0.80, 0.96],
            [0.08, 0.26, 0.43, 0.58, 0.74, 0.88],
        ),
        "warm" => (
            1.04,
            [0.0, 0.22, 0.43, 0.63, 0.82, 1.0],
            [0.0, 0.20, 0.40, 0.60, 0.79, 0.97],
            [0.0, 0.17, 0.35, 0.54, 0.73, 0.90],
        ),
        "cool" => (
            0.96,
            [0.0, 0.17, 0.36, 0.56, 0.76, 0.94],
            [0.0, 0.20, 0.40, 0.60, 0.80, 0.98],
            [0.03, 0.24, 0.44, 0.64, 0.83, 1.0],
        ),
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
        "sepia" => (
            0.0,
            [0.05, 0.28, 0.50, 0.70, 0.87, 1.0],
            [0.03, 0.22, 0.42, 0.62, 0.80, 0.94],
            [0.02, 0.15, 0.32, 0.50, 0.68, 0.80],
        ),
        _ => return None,
    })
}

fn table(curve: [f32; 6], amount: f32) -> String {
    curve
        .iter()
        .enumerate()
        .map(|(i, v)| {
            let linear = i as f32 / 5.0;
            format!("{:.4}", linear + (v - linear) * amount)
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// One filter over the whole picture: grade, then bloom on the highlights, then aberration.
pub fn filter<'a>(lens: &Lens, w: f32, h: f32) -> Option<(String, Svgr<'a>)> {
    if !lens.filtered() {
        return None;
    }
    let id = "cf-lens".to_owned();
    let mut steps: Vec<Svgr<'a>> = vec![];
    let mut last = "SourceGraphic".to_owned();
    if let Some((sat, r, g, b)) = look(&lens.grade).filter(|_| lens.grade_amount > 0.0) {
        let k = lens.grade_amount;
        let saturation = 1.0 + (sat - 1.0) * k;
        steps.push(fframes::svgr!(<feColorMatrix in={last.clone()} type="saturate" values={format!("{saturation:.3}")} result="cf-sat" />));
        steps.push(fframes::svgr!(<feComponentTransfer in="cf-sat" result="cf-graded">
            <feFuncR type="table" tableValues={table(r, k)} />
            <feFuncG type="table" tableValues={table(g, k)} />
            <feFuncB type="table" tableValues={table(b, k)} />
        </feComponentTransfer>));
        last = "cf-graded".into();
    }
    if lens.bloom > 0.0 {
        // Keep what is brighter than ~60%, blur it wide and add it back as light.
        let spread = (8.0 + 22.0 * lens.bloom) * h / 1080.0;
        let gain = format!("{:.3}", 0.3 + 0.6 * lens.bloom);
        steps.push(fframes::svgr!(<feComponentTransfer in={last.clone()} result="cf-hi">
            <feFuncR type="linear" slope="2.5" intercept="-1.5" />
            <feFuncG type="linear" slope="2.5" intercept="-1.5" />
            <feFuncB type="linear" slope="2.5" intercept="-1.5" />
        </feComponentTransfer>));
        steps
            .push(fframes::svgr!(<feGaussianBlur in="cf-hi" stdDeviation={format!("{spread:.2}")} result="cf-glow" />));
        steps.push(fframes::svgr!(<feComponentTransfer in="cf-glow" result="cf-glow2">
            <feFuncR type="linear" slope={gain.clone()} />
            <feFuncG type="linear" slope={gain.clone()} />
            <feFuncB type="linear" slope={gain} />
        </feComponentTransfer>));
        steps.push(fframes::svgr!(<feBlend in={last.clone()} in2="cf-glow2" mode="screen" result="cf-bloomed" />));
        last = "cf-bloomed".into();
    }
    if lens.aberration > 0.0 {
        // Red and blue slip apart by a couple of pixels, as a fast lens does at the edges.
        let px = format!("{:.2}", 3.2 * lens.aberration * h / 1080.0);
        let neg = format!("-{px}");
        steps.push(fframes::svgr!(<feColorMatrix in={last.clone()} type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cf-r" />));
        steps.push(fframes::svgr!(<feOffset in="cf-r" dx={px} dy="0" result="cf-r2" />));
        steps.push(fframes::svgr!(<feColorMatrix in={last.clone()} type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cf-g" />));
        steps.push(fframes::svgr!(<feColorMatrix in={last} type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cf-b" />));
        steps.push(fframes::svgr!(<feOffset in="cf-b" dx={neg} dy="0" result="cf-b2" />));
        steps.push(fframes::svgr!(<feBlend in="cf-r2" in2="cf-g" mode="screen" result="cf-rg" />));
        steps.push(fframes::svgr!(<feBlend in="cf-rg" in2="cf-b2" mode="screen" />));
    }
    let defs = fframes::svgr!(<defs><filter id={id.clone()} filterUnits="userSpaceOnUse" x="0" y="0" width={w} height={h} color-interpolation-filters="sRGB">{steps}</filter></defs>);
    Some((id, defs))
}

/// A handheld operator: a slow, seeded sway of position and roll, with a slight overscan so
/// the frame edge never shows. Sums of incommensurate sines, so it never visibly repeats.
pub fn handheld(amount: f32, seconds: f32, w: f32, h: f32) -> Option<String> {
    if amount <= 0.0 {
        return None;
    }
    let wave = |f: [f32; 3], p: [f32; 3]| {
        0.6 * (TAU * f[0] * seconds + p[0]).sin()
            + 0.3 * (TAU * f[1] * seconds + p[1]).sin()
            + 0.1 * (TAU * f[2] * seconds + p[2]).sin()
    };
    let reach = amount * 0.006 * w;
    let dx = reach * wave([0.19, 0.53, 1.37], [1.3, 0.2, 2.1]);
    let dy = reach * 0.7 * wave([0.23, 0.61, 1.61], [0.4, 2.6, 1.1]);
    let roll = amount * 0.3 * wave([0.11, 0.37, 0.89], [2.2, 1.0, 0.3]);
    let over = 1.0 + amount * 0.022;
    let (cx, cy) = (w / 2.0, h / 2.0);
    Some(format!(
        "translate({:.2} {:.2}) rotate({roll:.3} {cx} {cy}) translate({cx} {cy}) scale({over:.4}) translate({} {})",
        dx, dy, -cx, -cy
    ))
}

/// Light leaking past the lens: two warm, blurred blooms drifting slowly at the frame edges.
pub fn leak<'a>(amount: f32, seconds: f32, w: f32, h: f32, p: &Palette) -> Svgr<'a> {
    if amount <= 0.0 {
        return fframes::svgr!(<g />);
    }
    let t = seconds;
    let blob = |id: &str, cx: f32, cy: f32, r: f32, inner: &str, outer: &str, alpha: f32| {
        fframes::svgr!(<g opacity={alpha.clamp(0.0, 1.0)}>
            <defs><radialGradient id={id.to_owned()} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={r}>
                <stop offset="0" stop-color={inner.to_owned()} stop-opacity="0.95" />
                <stop offset="0.4" stop-color={outer.to_owned()} stop-opacity="0.45" />
                <stop offset="1" stop-color={outer.to_owned()} stop-opacity="0" />
            </radialGradient></defs>
            <rect width={w} height={h} fill={format!("url(#{id})")} />
        </g>)
    };
    let a = blob(
        "cf-leak-a",
        w * (-0.04 + 0.1 * (0.13 * TAU * t / 4.0).sin()),
        h * (0.32 + 0.2 * (0.21 * TAU * t / 4.0 + 1.0).sin()),
        w * 0.42 * (1.0 + 0.12 * (0.3 * t).sin()),
        "#ffd9a0",
        "#ff7a3c",
        0.75 + 0.25 * (0.17 * TAU * t / 3.0).sin(),
    );
    let b = blob(
        "cf-leak-b",
        w * (1.03 + 0.08 * (0.11 * TAU * t / 4.0 + 2.0).sin()),
        h * (0.72 + 0.15 * (0.19 * TAU * t / 4.0).sin()),
        w * 0.36 * (1.0 + 0.1 * (0.23 * t + 1.0).sin()),
        "#ffe2b8",
        &p.accent2,
        0.55 + 0.35 * (0.13 * TAU * t / 3.0 + 1.4).sin(),
    );
    let strength = amount * if p.dark { 0.55 } else { 0.3 };
    fframes::svgr!(<g opacity={strength} mix-blend-mode="screen">{a}{b}</g>)
}

/// Black bars top and bottom.
pub fn letterbox<'a>(bar: f32, w: f32, h: f32) -> Svgr<'a> {
    if bar <= 0.25 {
        return fframes::svgr!(<g />);
    }
    fframes::svgr!(<g>
        <rect x="0" y="0" width={w} height={bar} fill="#000000" />
        <rect x="0" y={h - bar} width={w} height={bar} fill="#000000" />
    </g>)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn lens_parses_clamps_and_sizes_bars() {
        let l = Lens::from(&serde_json::json!({"letterbox":2.39,"grade":"teal-orange","bloom":3,"handheld":0.5}));
        assert_eq!(l.bloom, 1.0);
        assert_eq!(l.grade_amount, 0.7);
        assert!((bar(2.39, 1920.0, 1080.0) - 138.3).abs() < 0.5);
        assert_eq!(bar(2.39, 1080.0, 1920.0), 0.0, "vertical frames keep their height");
        assert_eq!(bar(0.0, 1920.0, 1080.0), 0.0);
        assert_eq!(bar(1.5, 1920.0, 1080.0), 0.0, "a taller picture than the frame needs no bars");
        assert!(filter(&l, 1920.0, 1080.0).is_some());
        assert!(filter(&Lens::from(&Value::Null), 1920.0, 1080.0).is_none());
        assert_eq!(handheld(0.5, 3.0, 1920.0, 1080.0), handheld(0.5, 3.0, 1920.0, 1080.0));
        assert_ne!(handheld(0.5, 3.0, 1920.0, 1080.0), handheld(0.5, 3.5, 1920.0, 1080.0));
    }
}
