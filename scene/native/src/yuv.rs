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
