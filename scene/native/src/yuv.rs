//! Straight RGBA (sRGB values) → 8-bit YUV 4:2:0, BT.601 matrix, limited range: what the
//! finisher tags and what the engine's FFmpeg pipe produced. Each chroma sample is the average
//! of its 2×2 block, rounded; fframes' built-in converter takes the block's top-left pixel and
//! floors, which aliases coloured edges (about 3 dB worse against the engine's own stills).
//! Coefficients are 16-bit fixed point of 219/255 · Kr,g,b (luma) and 224/255 · the colour
//! differences (chroma); rows of Cb and Cr sum to zero, so greys stay neutral.

const Y: [i32; 3] = [16829, 33039, 6416];
const CB: [i32; 3] = [-9714, -19070, 28784];
const CR: [i32; 3] = [28784, -24103, -4681];

/// A destination plane: its bytes and the stride between rows.
pub struct Plane<'a> {
    pub data: &'a mut [u8],
    pub stride: usize,
}

#[inline(always)]
fn luma(r: i32, g: i32, b: i32) -> u8 {
    (16 + ((Y[0] * r + Y[1] * g + Y[2] * b + 32768) >> 16)) as u8
}

/// `sum` is the sum of `n` pixels' channels; the result is rounded to nearest.
#[inline(always)]
fn chroma(k: &[i32; 3], (r, g, b): (i32, i32, i32), n: i32) -> u8 {
    let scaled = k[0] * r + k[1] * g + k[2] * b; // × 65536 × n
    let d = 65536 * n;
    (128 + (scaled + d / 2).div_euclid(d)).clamp(0, 255) as u8
}

/// Convert `width`×`height` straight RGBA (no row padding) into the three planes.
pub fn rgba_to_i420(rgba: &[u8], width: usize, height: usize, y: Plane, u: Plane, v: Plane) {
    assert!(rgba.len() >= width * height * 4, "{} bytes do not hold a {width}x{height} RGBA frame", rgba.len());
    let px = |x: usize, row: usize| {
        let i = (row * width + x) * 4;
        (rgba[i] as i32, rgba[i + 1] as i32, rgba[i + 2] as i32)
    };
    for row in 0..height {
        let line = &rgba[row * width * 4..(row + 1) * width * 4];
        let out = &mut y.data[row * y.stride..row * y.stride + width];
        for (x, o) in out.iter_mut().enumerate() {
            *o = luma(line[x * 4] as i32, line[x * 4 + 1] as i32, line[x * 4 + 2] as i32);
        }
    }
    for cy in 0..height.div_ceil(2) {
        for cx in 0..width.div_ceil(2) {
            let (mut sum, mut n) = ((0, 0, 0), 0);
            for (dx, dy) in [(0, 0), (1, 0), (0, 1), (1, 1)] {
                let (x, row) = (cx * 2 + dx, cy * 2 + dy);
                if x < width && row < height {
                    let (r, g, b) = px(x, row);
                    sum = (sum.0 + r, sum.1 + g, sum.2 + b);
                    n += 1;
                }
            }
            u.data[cy * u.stride + cx] = chroma(&CB, sum, n);
            v.data[cy * v.stride + cx] = chroma(&CR, sum, n);
        }
    }
}

/// The same conversion on the GPU: three one-channel surfaces drawn from the frame with SkSL
/// (luma per pixel, each chroma plane from its 2×2 block) and read back straight into the
/// encoder's planes — 1.5 bytes a pixel cross to the CPU instead of 4, and the CPU is left to
/// the encoder.
pub struct GpuI420 {
    planes: [sk::Surface; 3],
}

const LUMA: &str = "uniform shader img; uniform float3 k;
float4 main(float2 p) {
    float3 c = float3(img.eval(p).rgb) * 255.0;
    return float4(0, 0, 0, (16.0 + dot(c, k)) / 255.0);
}";
const CHROMA: &str = "uniform shader img; uniform float3 k;
float4 main(float2 p) {
    float2 q = floor(p) * 2.0 + 0.5;
    float3 s = float3(img.eval(q).rgb) + float3(img.eval(q + float2(1, 0)).rgb)
             + float3(img.eval(q + float2(0, 1)).rgb) + float3(img.eval(q + float2(1, 1)).rgb);
    return float4(0, 0, 0, (128.0 + dot(s * (255.0 / 4.0), k)) / 255.0);
}";

use skia_safe as sk;

fn effect(source: &'static str) -> Result<sk::RuntimeEffect, String> {
    sk::RuntimeEffect::make_for_shader(source, None).map_err(|e| format!("yuv shader: {e}"))
}

fn coefficients(k: &[i32; 3]) -> sk::Data {
    let bytes: Vec<u8> = k.iter().flat_map(|c| (*c as f32 / 65536.0).to_ne_bytes()).collect();
    sk::Data::new_copy(&bytes)
}

impl GpuI420 {
    /// One-channel planes on the engine's GPU context; `None` without a GPU.
    pub fn new(engine: &mut crate::compose::Engine) -> Result<Option<Self>, String> {
        let (w, h) = (engine.width, engine.height);
        let Some(gpu) = engine.gpu.as_mut() else { return Ok(None) };
        let mut plane = |pw: i32, ph: i32| {
            let info = sk::ImageInfo::new((pw, ph), sk::ColorType::Alpha8, sk::AlphaType::Premul, None);
            sk::gpu::surfaces::render_target(
                &mut gpu.context,
                sk::gpu::Budgeted::Yes,
                &info,
                None,
                sk::gpu::SurfaceOrigin::TopLeft,
                None,
                false,
                None,
            )
            .ok_or_else(|| format!("cannot create a {pw}x{ph} one-channel surface"))
        };
        let (cw, ch) = ((w + 1) / 2, (h + 1) / 2);
        Ok(Some(GpuI420 { planes: [plane(w, h)?, plane(cw, ch)?, plane(cw, ch)?] }))
    }

    /// Convert the engine's current frame into `y`, `u` and `v`.
    pub fn read(&mut self, engine: &mut crate::compose::Engine, out: [Plane; 3]) -> Result<(), String> {
        thread_local! {
            static EFFECTS: (sk::RuntimeEffect, sk::RuntimeEffect) =
                (effect(LUMA).expect("luma shader"), effect(CHROMA).expect("chroma shader"));
        }
        let image = engine.surface.image_snapshot();
        let source = image
            .to_shader((sk::TileMode::Clamp, sk::TileMode::Clamp), sk::SamplingOptions::default(), None)
            .ok_or("cannot sample the frame")?;
        EFFECTS.with(|(luma, chroma)| -> Result<(), String> {
            for (i, (effect, k)) in [(luma, &Y), (chroma, &CB), (chroma, &CR)].into_iter().enumerate() {
                let shader = effect
                    .make_shader(coefficients(k), &[source.clone().into()], None)
                    .ok_or("cannot make the yuv shader")?;
                let surface = &mut self.planes[i];
                let (pw, ph) = (surface.width(), surface.height());
                let mut paint = sk::Paint::default();
                paint.set_shader(shader);
                paint.set_blend_mode(sk::BlendMode::Src);
                surface.canvas().draw_rect(sk::Rect::from_wh(pw as f32, ph as f32), &paint);
            }
            Ok(())
        })?;
        if let Some(g) = engine.gpu.as_mut() {
            g.context.flush_and_submit();
        }
        for (surface, plane) in self.planes.iter_mut().zip(out) {
            let (pw, ph) = (surface.width(), surface.height());
            let info = sk::ImageInfo::new((pw, ph), sk::ColorType::Alpha8, sk::AlphaType::Premul, None);
            if plane.data.len() < plane.stride * (ph as usize - 1) + pw as usize {
                return Err("a yuv plane is smaller than the frame".into());
            }
            if !surface.read_pixels(&info, plane.data, plane.stride, (0, 0)) {
                return Err(format!("failed to read a {pw}x{ph} yuv plane back"));
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn convert(rgba: &[u8], w: usize, h: usize) -> (Vec<u8>, Vec<u8>, Vec<u8>) {
        let (cw, ch) = (w.div_ceil(2), h.div_ceil(2));
        let (mut y, mut u, mut v) = (vec![0; w * h], vec![0; cw * ch], vec![0; cw * ch]);
        rgba_to_i420(
            rgba,
            w,
            h,
            Plane { data: &mut y, stride: w },
            Plane { data: &mut u, stride: cw },
            Plane { data: &mut v, stride: cw },
        );
        (y, u, v)
    }

    #[test]
    fn limited_range_bt601_levels() {
        // black, white, pure red, a mid grey: the standard 8-bit BT.601 limited-range codes
        for (rgb, want) in [
            ([0, 0, 0], (16, 128, 128)),
            ([255, 255, 255], (235, 128, 128)),
            ([255, 0, 0], (81, 90, 240)),
            ([128, 128, 128], (126, 128, 128)),
        ] {
            let rgba: Vec<u8> = (0..4).flat_map(|_| [rgb[0], rgb[1], rgb[2], 255]).collect();
            let (y, u, v) = convert(&rgba, 2, 2);
            assert_eq!((y[0], u[0], v[0]), want, "{rgb:?}");
        }
    }

    #[test]
    fn chroma_is_the_block_average() {
        // a red pixel in a 2x2 block of white: chroma moves a quarter of the way to red's,
        // where point sampling would give all or nothing
        let mut rgba = vec![255u8; 16];
        rgba[0..4].copy_from_slice(&[255, 0, 0, 255]);
        let (_, u, v) = convert(&rgba, 2, 2);
        assert_eq!((u[0], v[0]), (119, 156));
        // odd sizes average the pixels that exist
        let (y, u, _) = convert(&[0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255], 3, 1);
        assert_eq!((y.len(), u.len(), y[1]), (3, 2, 235));
        assert_eq!(u[1], 128);
    }
}
