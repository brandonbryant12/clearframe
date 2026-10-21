//! Filter graphs for block effects (shadows, glows, blurs, image treatments, thermal and
//! printed looks), built from Skia image filters with the SVG filter model's meaning: every
//! step is confined to the filter region, works in sRGB or linear-light RGB (the SVG default)
//! with conversions where a result crosses spaces, and the output is handed back in sRGB.
//!
//! ```ignore
//! let fx = Fx::new(region);
//! let soft = fx.blur(&fx.source_alpha(), 8.0, 8.0, Space::Linear);
//! node.filter_in(fx.finish(&fx.merge(&[soft, fx.source()], Space::Linear)), region)
//! ```
use skia_safe::{self as sk, BlendMode, ColorFilter, ImageFilter, Rect, color_filters, image_filters};

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Space {
    Srgb,
    Linear,
}

/// A step's result: `None` is the element itself (SourceGraphic, always sRGB).
#[derive(Clone)]
pub struct Out {
    filter: Option<ImageFilter>,
    space: Space,
}

pub struct Fx {
    pub region: Rect,
}

fn convert(filter: Option<ImageFilter>, from: Space, to: Space) -> Option<ImageFilter> {
    if from == to {
        return filter;
    }
    let cf = match to {
        Space::Linear => color_filters::srgb_to_linear_gamma(),
        Space::Srgb => color_filters::linear_to_srgb_gamma(),
    };
    image_filters::color_filter(cf, filter, None)
}

/// A 256-entry table from SVG `type="table"` values (piecewise linear).
pub fn table(values: &[f32]) -> [u8; 256] {
    let mut t = [0u8; 256];
    if values.is_empty() {
        for (i, v) in t.iter_mut().enumerate() {
            *v = i as u8;
        }
        return t;
    }
    if values.len() == 1 {
        t.fill((values[0].clamp(0.0, 1.0) * 255.0 + 0.5) as u8);
        return t;
    }
    let n = values.len() - 1;
    for (i, v) in t.iter_mut().enumerate() {
        let x = i as f32 / 255.0;
        let k = ((x * n as f32).floor() as usize).min(n - 1);
        let frac = x * n as f32 - k as f32;
        let y = values[k] + frac * (values[k + 1] - values[k]);
        *v = (y.clamp(0.0, 1.0) * 255.0 + 0.5) as u8;
    }
    t
}

/// A table for SVG `type="linear"` (`slope`, `intercept`).
pub fn linear_table(slope: f32, intercept: f32) -> [u8; 256] {
    let mut t = [0u8; 256];
    for (i, v) in t.iter_mut().enumerate() {
        *v = ((slope * i as f32 / 255.0 + intercept).clamp(0.0, 1.0) * 255.0 + 0.5) as u8;
    }
    t
}

/// `feColorMatrix type="saturate"`.
pub fn saturate(s: f32) -> [f32; 20] {
    [
        0.213 + 0.787 * s,
        0.715 - 0.715 * s,
        0.072 - 0.072 * s,
        0.0,
        0.0,
        0.213 - 0.213 * s,
        0.715 + 0.285 * s,
        0.072 - 0.072 * s,
        0.0,
        0.0,
        0.213 - 0.213 * s,
        0.715 - 0.715 * s,
        0.072 + 0.928 * s,
        0.0,
        0.0,
        0.0,
        0.0,
        0.0,
        1.0,
        0.0,
    ]
}

impl Fx {
    pub fn new(region: Rect) -> Fx {
        Fx { region }
    }
    /// The default SVG filter region: the element's bounding box grown by 10% on every side.
    pub fn around(bounds: Rect) -> Fx {
        let (w, h) = (bounds.width(), bounds.height());
        Fx { region: Rect::from_xywh(bounds.left - 0.1 * w, bounds.top - 0.1 * h, 1.2 * w, 1.2 * h) }
    }
    fn crop(&self) -> Rect {
        self.region
    }
    fn input(&self, i: &Out, space: Space) -> Option<ImageFilter> {
        convert(i.filter.clone(), i.space, space)
    }
    pub fn source(&self) -> Out {
        Out { filter: None, space: Space::Srgb }
    }
    pub fn source_alpha(&self) -> Out {
        let m = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0];
        // Alpha alone reads the same in either space.
        Out {
            filter: image_filters::color_filter(color_filters::matrix_row_major(&m, None), None, None),
            space: Space::Srgb,
        }
    }
    fn out(&self, filter: Option<ImageFilter>, space: Space) -> Out {
        Out { filter, space }
    }
    pub fn blur(&self, i: &Out, sx: f32, sy: f32, space: Space) -> Out {
        self.out(image_filters::blur((sx.max(0.0), sy.max(0.0)), None, self.input(i, space), self.crop()), space)
    }
    pub fn offset(&self, i: &Out, dx: f32, dy: f32, space: Space) -> Out {
        self.out(image_filters::offset((dx, dy), self.input(i, space), self.crop()), space)
    }
    pub fn color(&self, i: &Out, cf: ColorFilter, space: Space) -> Out {
        self.out(image_filters::color_filter(cf, self.input(i, space), self.crop()), space)
    }
    pub fn matrix(&self, i: &Out, m: &[f32; 20], space: Space) -> Out {
        self.color(i, color_filters::matrix_row_major(m, None), space)
    }
    /// `feComponentTransfer`: tables for alpha, red, green, blue (`None` is identity).
    pub fn transfer(
        &self,
        i: &Out,
        a: Option<&[u8; 256]>,
        r: Option<&[u8; 256]>,
        g: Option<&[u8; 256]>,
        b: Option<&[u8; 256]>,
        space: Space,
    ) -> Out {
        match color_filters::table_argb(a, r, g, b) {
            Some(cf) => self.color(i, cf, space),
            None => i.clone(),
        }
    }
    /// `feFlood` (defined in sRGB).
    pub fn flood(&self, color: sk::Color4f) -> Out {
        self.out(image_filters::shader(sk::shaders::color(color.to_color()), self.crop()), Space::Srgb)
    }
    /// `feTurbulence type="fractalNoise"` (or turbulence), generated in `space`.
    pub fn noise(&self, frequency: (f32, f32), octaves: usize, seed: f32, fractal: bool, space: Space) -> Out {
        let shader = if fractal {
            sk::shaders::fractal_noise(frequency, octaves, seed, None)
        } else {
            sk::shaders::turbulence(frequency, octaves, seed, None)
        };
        self.out(shader.and_then(|s| image_filters::shader(s, self.crop())), space)
    }
    /// `feComposite`: `top` (SVG `in`) over/in/out/atop `under` (SVG `in2`).
    pub fn composite(&self, mode: BlendMode, top: &Out, under: &Out, space: Space) -> Out {
        self.out(image_filters::blend(mode, self.input(under, space), self.input(top, space), self.crop()), space)
    }
    /// `feComposite operator="arithmetic"`: k1·in·in2 + k2·in + k3·in2 + k4.
    #[allow(clippy::too_many_arguments)]
    pub fn arithmetic(&self, top: &Out, under: &Out, k: [f32; 4], space: Space) -> Out {
        self.out(
            image_filters::arithmetic(
                k[0],
                k[1],
                k[2],
                k[3],
                true,
                self.input(under, space),
                self.input(top, space),
                self.crop(),
            ),
            space,
        )
    }
    pub fn merge(&self, inputs: &[Out], space: Space) -> Out {
        let list: Vec<Option<ImageFilter>> = inputs.iter().map(|i| self.input(i, space)).collect();
        self.out(image_filters::merge(list, self.crop()), space)
    }
    /// The graph's output in sRGB, confined to the region.
    pub fn finish(&self, last: &Out) -> Option<ImageFilter> {
        let out = convert(last.filter.clone(), last.space, Space::Srgb);
        image_filters::crop(self.region, None, out)
    }
}
