//! GPU materials: SkSL runtime shaders that paint a shape (or a whole layer) as a function of
//! position, a seed and scene time. Deterministic per backend: the same frame number and inputs
//! give the same shader evaluation. Colours always come from the film palette.
use fframes_skia_renderer::skia_safe::{Matrix, RuntimeEffect, Shader, runtime_effect::RuntimeShaderBuilder};
use std::cell::RefCell;
use std::collections::HashMap;

const COMMON: &str = r#"
uniform float4 bounds;   // x, y, w, h of the element
uniform float time;      // scene seconds
uniform float seed;
uniform float scale;     // feature size multiplier
uniform float amount;    // strength 0..1
uniform half4 c0;        // primary colour (the element's fill)
uniform half4 c1;        // secondary colour
uniform half4 c2;        // highlight
float hash(float2 p) { p = fract(p * float2(123.34, 456.21) + seed * 0.137); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(float2 p) {
    float2 i = floor(p); float2 f = fract(p);
    float a = hash(i), b = hash(i + float2(1, 0)), c = hash(i + float2(0, 1)), d = hash(i + float2(1, 1));
    float2 u = f * f * (3 - 2 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(float2 p) { float v = 0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + 17.0; a *= 0.5; } return v; }
float2 uv(float2 p) { return (p - bounds.xy) / max(bounds.zw, float2(1)); }
"#;

/// (name, body). Each body defines `half4 main(float2 p)` and may use COMMON.
const PRESETS: &[(&str, &str)] = &[
    // A slow flowing field between two palette colours: auroras, heat, liquid light.
    ("noise", r#"
half4 main(float2 p) {
    float2 q = uv(p) * 3.0 / max(scale, 0.05);
    float2 w = float2(fbm(q + float2(0, time * 0.12)), fbm(q + float2(5.2, 1.3) - time * 0.09));
    float n = fbm(q + 2.4 * w);
    half3 col = mix(c0.rgb, c1.rgb, half(smoothstep(0.25, 0.8, n)));
    col = mix(col, c2.rgb, half(amount * pow(smoothstep(0.55, 0.95, n), 2.0)));
    return half4(col, 1) * c0.a;
}"#),
    // Brushed metal catching a moving light: a banded reflection with a travelling specular.
    ("sheen", r#"
half4 main(float2 p) {
    float2 q = uv(p);
    float band = 0.5 + 0.5 * sin((q.x * 1.3 + q.y * 0.6) * 9.0 / max(scale, 0.05));
    float travel = fract(time * 0.18 + seed * 0.01);
    float spec = exp(-pow((q.x + q.y * 0.35 - (travel * 1.8 - 0.4)) * 7.0, 2.0));
    float brush = vnoise(float2(q.x * 3.0, q.y * 380.0 / max(scale, 0.05))) * 0.08;
    half3 col = mix(c0.rgb * 0.82, c1.rgb, half(0.35 * band + brush));
    col = mix(col, c2.rgb, half(amount * spec));
    return half4(col, 1) * c0.a;
}"#),
    // An offset-print dot screen: dot size follows a soft diagonal tone ramp of the fill.
    ("halftone", r#"
half4 main(float2 p) {
    float cell = 9.0 * max(scale, 0.2);
    float a = 0.785398;
    float2 r = float2(cos(a) * p.x - sin(a) * p.y, sin(a) * p.x + cos(a) * p.y) / cell;
    float2 f = fract(r) - 0.5;
    float2 q = uv(p);
    float tone = clamp(0.25 + 0.65 * (1.0 - length(q - float2(0.3, 0.25))) + 0.1 * sin(time * 0.8 + q.x * 4.0), 0.0, 1.0);
    float radius = sqrt(tone) * 0.62 * mix(0.6, 1.0, amount);
    float d = length(f) - radius;
    float ink = 1.0 - smoothstep(-0.06, 0.06, d);
    return half4(mix(c1.rgb, c0.rgb, half(ink)), 1) * c0.a;
}"#),
    // Film grain in the fill colour, changing eight times a second.
    ("grain", r#"
half4 main(float2 p) {
    float tick = floor(time * 8.0);
    float g = hash(floor(p / max(scale, 0.5)) + tick * 7.13) - 0.5;
    half3 col = c0.rgb + half(g * 0.22 * amount);
    return half4(col, 1) * c0.a;
}"#),
    // Glass: a cool translucent body, darker at the rim, a soft caustic and a sharp edge highlight.
    ("glass", r#"
half4 main(float2 p) {
    float2 q = uv(p);
    float2 e = min(q, 1.0 - q);
    float rim = 1.0 - smoothstep(0.0, 0.12, min(e.x, e.y));
    float caustic = fbm(q * 4.0 / max(scale, 0.05) + float2(time * 0.07, -time * 0.05));
    float hi = exp(-pow((q.x - q.y * 0.4 - 0.15 - 0.2 * sin(time * 0.3)) * 10.0, 2.0));
    half3 col = mix(c0.rgb, c1.rgb, half(0.35 + 0.4 * caustic));
    col = mix(col, c2.rgb, half(0.55 * hi * amount + 0.3 * rim));
    half alpha = half(0.62 + 0.3 * rim) * c0.a;
    return half4(col * alpha, alpha);
}"#),
    // Chrome: a horizon reflection (dark ground, bright sky band) that slides as time passes.
    ("chrome", r#"
half4 main(float2 p) {
    float2 q = uv(p);
    float y = q.y + 0.15 * sin(q.x * 3.0 + time * 0.4) + 0.05 * (fbm(q * 6.0) - 0.5);
    float sky = smoothstep(0.42, 0.5, y) - smoothstep(0.5, 0.62, y) * 0.6;
    half3 ground = c1.rgb * 0.35;
    half3 col = mix(ground, c2.rgb, half(clamp(sky + (1.0 - y) * 0.35, 0.0, 1.0)));
    col = mix(col, c0.rgb, 0.18);
    return half4(col, 1) * c0.a;
}"#),
    // Gold leaf: warm metallic bands with a slow glint.
    ("gold", r#"
half4 main(float2 p) {
    float2 q = uv(p);
    float b = 0.5 + 0.5 * sin((q.y * 2.5 - q.x * 0.8) * 6.283 / max(scale, 0.05) + fbm(q * 5.0) * 2.0);
    float glint = exp(-pow((q.x - fract(time * 0.12 + seed * 0.03) * 1.6 + 0.3) * 6.0, 2.0));
    half3 dark = half3(0.42, 0.27, 0.07), mid = half3(0.84, 0.64, 0.26), light = half3(1.0, 0.9, 0.62);
    half3 col = mix(dark, mid, half(b));
    col = mix(col, light, half(glint * amount + 0.25 * b * b));
    return half4(mix(col, c0.rgb, 0.12), 1) * c0.a;
}"#),
    // Thermal camera ramp: cold to hot across a flowing field.
    ("thermal", r#"
half4 main(float2 p) {
    float2 q = uv(p);
    float t = clamp(0.65 * (1.0 - q.y) + 0.45 * fbm(q * 3.0 / max(scale, 0.05) + time * 0.1) - 0.1, 0.0, 1.0);
    half3 a = half3(0.05, 0.02, 0.25), b = half3(0.55, 0.0, 0.55), c = half3(0.95, 0.35, 0.05), d = half3(1.0, 0.95, 0.6);
    half3 col = t < 0.33 ? mix(a, b, half(t / 0.33)) : t < 0.66 ? mix(b, c, half((t - 0.33) / 0.33)) : mix(c, d, half((t - 0.66) / 0.34));
    return half4(col, 1) * c0.a;
}"#),
    // CRT / monitor lines over the fill, rolling slowly.
    ("scanlines", r#"
half4 main(float2 p) {
    float line = 0.5 + 0.5 * sin((p.y + time * 18.0) * 3.14159 / (2.0 * max(scale, 0.5)));
    half3 col = c0.rgb * half(1.0 - 0.28 * amount * line);
    float roll = smoothstep(0.0, 0.08, abs(fract(uv(p).y - time * 0.07) - 0.5));
    col *= half(0.92 + 0.08 * roll);
    return half4(col, 1) * c0.a;
}"#),
];

pub const NAMES: &[&str] = &["noise", "sheen", "halftone", "grain", "glass", "chrome", "gold", "thermal", "scanlines", "neon"];

thread_local! {
    static EFFECTS: RefCell<HashMap<&'static str, RuntimeEffect>> = RefCell::new(HashMap::new());
}

fn effect(name: &str) -> Option<RuntimeEffect> {
    let (key, body) = PRESETS.iter().find(|(n, _)| *n == name)?;
    EFFECTS.with(|cache| {
        let mut cache = cache.borrow_mut();
        if let Some(e) = cache.get(key) {
            return Some(e.clone());
        }
        let source = format!("{COMMON}\n{body}");
        let e = RuntimeEffect::make_for_shader(source, None).unwrap_or_else(|err| panic!("material {key}: {err}"));
        cache.insert(key, e.clone());
        Some(e)
    })
}

pub struct Params {
    pub bounds: (f32, f32, f32, f32),
    pub time: f32,
    pub seed: f32,
    pub scale: f32,
    pub amount: f32,
    pub colors: [[f32; 4]; 3],
}

/// The shader for a material preset, or `None` for a name that is drawn another way (`neon`).
pub fn shader(name: &str, p: &Params) -> Option<Shader> {
    let e = effect(name)?;
    let mut b = RuntimeShaderBuilder::new(e);
    let (x, y, w, h) = p.bounds;
    let _ = b.set_uniform_float("bounds", &[x, y, w, h]);
    let _ = b.set_uniform_float("time", &[p.time]);
    let _ = b.set_uniform_float("seed", &[p.seed]);
    let _ = b.set_uniform_float("scale", &[p.scale]);
    let _ = b.set_uniform_float("amount", &[p.amount]);
    for (i, c) in p.colors.iter().enumerate() {
        let _ = b.set_uniform_float(format!("c{i}"), c);
    }
    b.make_shader(&Matrix::new_identity())
}

#[cfg(test)]
mod tests {
    #[test]
    fn every_preset_compiles() {
        for (name, _) in super::PRESETS {
            assert!(super::effect(name).is_some(), "{name}");
        }
        assert!(super::effect("neon").is_none(), "neon is a glow, not a fill shader");
    }
}
