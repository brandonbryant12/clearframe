//! The frame compositor. One Skia GPU canvas per frame, in this order:
//!
//! 1. background colour, then — inside the lens layer (grade, bloom and aberration as one GPU
//!    filter graph) and the handheld transform — the backdrop, vignette, every beat on screen
//!    and the film chrome;
//! 2. for each beat: its ground (tone, plate) from the block layer, native `under` layers,
//!    the block content, native `over` layers. A dissolve draws the outgoing beat under the
//!    incoming one as two real layers;
//! 3. stages (native layers spanning beats) around the beats;
//! 4. light leaks, the editorial frame, grain, letterbox bars and review guides on top.
//!
//! Native layers with a shutter are sampled several times inside the frame interval and
//! accumulated in half-float, which is real temporal motion blur rather than a smear.
use crate::film;
use crate::gpu::{self, Gpu};
use crate::legacy::{self, Layers};
use crate::media::Media;
use crate::nodes::{self, Camera, Scope, TextMark};
use crate::plan::{Depth, Layer, Plan};
use clearframe_native::Film;
use clearframe_native::design::Palette;
use clearframe_native::lens::Lens;
use clearframe_native::motion::{self, MotionStyle};
use fframes_skia_renderer::skia_safe::{
    self as sk, AlphaType, BlendMode, Canvas, ColorType, ImageInfo, Paint, Rect, Surface, gpu as skgpu,
};
use std::path::Path;

pub struct Engine {
    pub plan: Plan,
    pub film: Film,
    blocks: Box<dyn Layers>,
    pub gpu: Option<Gpu>,
    pub surface: Surface,
    scratch: Option<Surface>,
    accum: Option<Surface>,
    media: Media,
    /// Output pixels.
    pub width: i32,
    pub height: i32,
    /// Layout units (the shorter side is 1080).
    pub logical: (f32, f32),
    palette: Palette,
    /// Native type drawn in the last frame (for the audit).
    pub marks: Vec<TextMark>,
}

impl Engine {
    /// Open a plan for output at `scale` × its format (drafts use 0.5).
    pub fn open(plan_file: &Path, scale: f32) -> Result<Engine, String> {
        let plan = Plan::read(plan_file)?;
        let media_dir = plan.media_path();
        crate::fonts::use_dir(&media_dir);
        let film = Film::read(&plan.job_path().to_string_lossy()).map_err(|e| format!("{}: {e}", plan.job))?;
        if (film.width as u32, film.height as u32, film.fps as u32, film.frames) != (plan.format.width, plan.format.height, plan.format.fps, plan.format.frames) {
            return Err("the plan's format does not match its block job; prepare again".into());
        }
        for layer in &plan.layers {
            if let Some(id) = &layer.beat {
                if !film.beats.iter().any(|b| &b.id == id) {
                    return Err(format!("layer {} names unknown beat {id}", layer.id));
                }
            }
        }
        let blocks = legacy::open(&plan.job_path(), &media_dir)?;
        if !(scale.is_finite() && scale > 0.0 && scale <= 2.0) {
            return Err("scale must be greater than zero and at most 2".into());
        }
        // Even dimensions, rounded as FFFrames' VideoSize::new_scaled (fframes/render-geometry.mjs).
        let even = |n: u32| if scale == 1.0 { n as i32 } else { (((n as f32 * scale) / 2.0).round() as i32 * 2).max(2) };
        let (width, height) = (even(plan.format.width), even(plan.format.height));
        if width < 2 || height < 2 {
            return Err("scaled output must have positive even dimensions".into());
        }
        let k = 1080.0 / plan.format.width.min(plan.format.height) as f32;
        let logical = (plan.format.width as f32 * k, plan.format.height as f32 * k);
        let mut gpu = Gpu::new()?;
        let surface = gpu::surface(gpu.as_mut(), width, height)?;
        let media = Media::new(&media_dir, plan.format.fps as usize);
        let palette = Palette::from_theme(&film.theme);
        Ok(Engine { plan, film, blocks, gpu, surface, scratch: None, accum: None, media, width, height, logical, palette, marks: vec![] })
    }

    pub fn backend(&self) -> &'static str {
        self.gpu.as_ref().map_or("skia-raster", |g| g.backend)
    }

    fn beat_at(&self, frame: usize) -> usize {
        self.film.beats.iter().rposition(|b| b.start_frame <= frame).unwrap_or(0)
    }

    /// Draw film frame `frame` into the engine surface.
    pub fn render(&mut self, frame: usize) -> Result<(), String> {
        if frame >= self.plan.format.frames {
            return Err(format!("frame {frame} is outside the film (0..{})", self.plan.format.frames));
        }
        self.marks.clear();
        let mut errors: Vec<String> = vec![];
        let (lw, lh) = self.logical;
        let fps = self.plan.format.fps as f32;
        let seconds = frame as f32 / fps;
        let i = self.beat_at(frame);
        let mut lens = Lens::from(&self.film.beats[i].lens);
        // Bloom lifts highlights out of a dark picture; on light paper it only softens shapes.
        if !self.palette.dark {
            lens.bloom = 0.0;
        }
        let mut bar = film::bar(&lens, lw, lh);
        if i > 0 {
            let before = film::bar(&Lens::from(&self.film.beats[i - 1].lens), lw, lh);
            let q = motion::in_out_cubic(motion::clamp01((frame - self.film.beats[i].start_frame) as f32 / fps / 0.7));
            bar = before + (bar - before) * q;
        }
        let scale = self.width as f32 / lw;
        let mut surface = self.surface.clone();
        let canvas = surface.canvas();
        canvas.restore_to_count(1);
        canvas.reset_matrix();
        canvas.clear(paint_color(&self.palette.bg));
        canvas.scale((scale, scale));
        // 1. The picture, through the lens.
        canvas.save();
        if let Some(filter) = film::lens_filter(&lens, lh) {
            let mut lp = Paint::default();
            lp.set_image_filter(filter);
            canvas.save_layer(&sk::canvas::SaveLayerRec::default().paint(&lp));
        }
        film::handheld(canvas, lens.handheld, seconds, lw, lh);
        let mut bg = Paint::default();
        bg.set_color(paint_color(&self.palette.bg));
        canvas.draw_rect(Rect::from_wh(lw, lh), &bg);
        film::backdrop(canvas, &self.film.backdrop, lw, lh, &self.palette, seconds);
        film::vignette(canvas, &self.film.texture, lw, lh, &self.palette);
        self.stages(canvas, frame, Depth::Under, &mut errors);
        let beat = &self.film.beats[i];
        let local = frame - beat.start_frame;
        let span = ((0.7 * fps) as usize).min(beat.frames / 2).max(1);
        if beat.transition == "dissolve" && i > 0 && local < span {
            let prev = &self.film.beats[i - 1];
            let q = motion::in_out_cubic((local as f32 + 1.0) / span as f32);
            let words = (1.0 - (local as f32 + 1.0) / (span as f32 * 0.35)).clamp(0.0, 1.0);
            self.beat(canvas, i - 1, prev.frames + local, frame, words, &mut errors);
            canvas.save_layer_alpha_f(None, q);
            self.beat(canvas, i, local, frame, 1.0, &mut errors);
            canvas.restore();
        } else {
            self.beat(canvas, i, local, frame, 1.0, &mut errors);
        }
        self.stages(canvas, frame, Depth::Over, &mut errors);
        if self.film.chrome {
            let progress = frame as f32 / self.film.frames.max(1) as f32;
            film::chrome(canvas, &self.film.title, lw, &self.palette, progress, &mut self.marks);
        }
        canvas.restore();
        // 4. Over the picture.
        film::leak(canvas, lens.leak, seconds, lw, lh, &self.palette);
        if let Some(spec) = self.film.frame.clone() {
            let tone = self.film.beats[i].tone.clone().unwrap_or_default();
            let palette = Palette::from_theme(&self.film.theme).toned(&tone);
            let label = self.film.beats[i].label.clone();
            film::frame(canvas, &spec, &label, lw, lh, &palette, frame as f32 / self.film.frames.max(1) as f32, &mut self.marks);
        }
        film::grain(canvas, &self.film.texture, lw, lh, &self.palette, seconds);
        film::letterbox(canvas, bar, lw, lh);
        if self.film.guides {
            film::guides(canvas, lw, lh);
        }
        canvas.restore_to_count(1);
        canvas.reset_matrix();
        if errors.is_empty() { Ok(()) } else { Err(errors.join("\n")) }
    }

    /// One beat at its own frame `local`: ground, native under layers, block content, native
    /// over layers. Without native layers the block layer is drawn whole.
    fn beat(&mut self, canvas: &Canvas, index: usize, local: usize, frame: usize, words: f32, errors: &mut Vec<String>) {
        let id = self.film.beats[index].id.clone();
        let (lw, lh) = self.logical;
        let has = |z: Depth| self.plan.layers.iter().any(|l| l.beat.as_deref() == Some(id.as_str()) && l.z == z);
        let (under, over) = (has(Depth::Under), has(Depth::Over));
        // The layer's own clock follows the beat frame being drawn (a dissolve's outgoing beat
        // runs on past its end).
        let beat_frame = self.film.beats[index].start_frame + local;
        if under {
            if let Err(e) = self.blocks.draw(canvas, index, local, frame, words, 1, lw, lh) {
                errors.push(e);
            }
            self.layers_of(canvas, Some(&id), Depth::Under, beat_frame, errors);
            if let Err(e) = self.blocks.draw(canvas, index, local, frame, words, 2, lw, lh) {
                errors.push(e);
            }
        } else if let Err(e) = self.blocks.draw(canvas, index, local, frame, words, 0, lw, lh) {
            errors.push(e);
        }
        if over {
            self.layers_of(canvas, Some(&id), Depth::Over, beat_frame, errors);
        }
    }

    fn stages(&mut self, canvas: &Canvas, frame: usize, z: Depth, errors: &mut Vec<String>) {
        self.layers_of(canvas, None, z, frame, errors);
    }

    fn layers_of(&mut self, canvas: &Canvas, beat: Option<&str>, z: Depth, frame: usize, errors: &mut Vec<String>) {
        let picked: Vec<usize> = self
            .plan
            .layers
            .iter()
            .enumerate()
            .filter(|(_, l)| l.beat.as_deref() == beat && l.z == z && frame >= l.start && frame < l.start + l.frames)
            .map(|(i, _)| i)
            .collect();
        for i in picked {
            if let Err(e) = self.layer(canvas, i, frame) {
                errors.push(e);
            }
        }
    }

    fn scope<'m>(media: &'m mut Media, film: &Film, layer: &Layer, palette: &Palette, fps: f32, pixel: f32, t: f32, view: (f32, f32)) -> Scope<'m> {
        let motion = layer
            .motion
            .as_ref()
            .map(|m| {
                MotionStyle::new(
                    m.get("preset").and_then(|v| v.as_str()).unwrap_or(&film.motion.preset),
                    m.get("intensity").and_then(|v| v.as_f64()).map_or(film.motion.intensity, |v| v as f32),
                )
            })
            .unwrap_or_else(|| MotionStyle::new(&film.motion.preset, film.motion.intensity));
        Scope {
            palette: palette.clone(),
            motion,
            fps,
            media,
            camera: Camera::at(&layer.camera, t, view),
            pixel,
            origins: Default::default(),
            routes: Default::default(),
            texts: vec![],
            errors: vec![],
            sample: false,
        }
    }

    /// Draw native layer `index` at film frame `frame` (motion-blurred when it has a shutter).
    fn layer(&mut self, canvas: &Canvas, index: usize, frame: usize) -> Result<(), String> {
        let layer = self.plan.layers[index].clone();
        let fps = self.plan.format.fps as f32;
        let t = self.plan.layer_seconds(&layer, frame as f32);
        let length = layer.frames as f32 / fps;
        let mut alpha = 1.0f32;
        if layer.fade[0] > 0.0 {
            alpha = alpha.min(motion::clamp01((t + 1.0 / fps) / layer.fade[0]));
        }
        if layer.fade[1] > 0.0 {
            alpha = alpha.min(motion::clamp01((length - t) / layer.fade[1]));
        }
        if alpha <= 0.001 {
            return Ok(());
        }
        let palette = match layer.beat.as_deref().and_then(|id| self.film.beats.iter().find(|b| b.id == id)) {
            Some(b) => Palette::from_theme(&self.film.theme).toned(b.tone.as_deref().unwrap_or("")),
            None => self.palette.clone(),
        };
        let pixel = self.width as f32 / self.logical.0;
        let samples = if layer.shutter > 0.0 { layer.samples.max(1) } else { 1 };
        if samples <= 1 {
            if alpha < 0.999 {
                canvas.save_layer_alpha_f(None, alpha);
            }
            let mut scope = Self::scope(&mut self.media, &self.film, &layer, &palette, fps, pixel, t, self.logical);
            nodes::draw(canvas, &mut scope, &layer.elements, 0.0, 0.0, t);
            if alpha < 0.999 {
                canvas.restore();
            }
            self.marks.extend(scope.texts);
            return if scope.errors.is_empty() { Ok(()) } else { Err(scope.errors.join("\n")) };
        }
        // Temporal motion blur: `samples` evaluations spread over the open shutter, summed at
        // equal weight in a half-float surface, then composited once.
        let (w, h) = (self.width, self.height);
        let matrix = canvas.local_to_device_as_3x3();
        if self.accum.is_none() {
            let info = ImageInfo::new((w, h), ColorType::RGBAF16, AlphaType::Premul, None);
            self.accum = Some(match self.gpu.as_mut() {
                Some(g) => skgpu::surfaces::render_target(&mut g.context, skgpu::Budgeted::Yes, &info, None, skgpu::SurfaceOrigin::TopLeft, None, false, None),
                None => sk::surfaces::raster(&info, None, None),
            }
            .ok_or("cannot create the motion-blur accumulation surface")?);
            self.scratch = Some(gpu::surface(self.gpu.as_mut(), w, h)?);
        }
        let mut accum = self.accum.clone().unwrap();
        let mut scratch = self.scratch.clone().unwrap();
        accum.canvas().clear(sk::Color::TRANSPARENT);
        let mut errors = vec![];
        let mut texts = vec![];
        for k in 0..samples {
            let offset = (k as f32 / (samples - 1) as f32 - 0.5) * layer.shutter;
            let ts = t + offset / fps;
            let sc = scratch.canvas();
            sc.clear(sk::Color::TRANSPARENT);
            sc.save();
            sc.set_matrix(&matrix.into());
            let mut scope = Self::scope(&mut self.media, &self.film, &layer, &palette, fps, pixel, ts, self.logical);
            scope.sample = true;
            nodes::draw(sc, &mut scope, &layer.elements, 0.0, 0.0, ts);
            sc.restore();
            errors.extend(scope.errors);
            if k == samples / 2 {
                texts = scope.texts;
            }
            let image = scratch.image_snapshot();
            let mut add = Paint::default();
            add.set_blend_mode(BlendMode::Plus);
            add.set_alpha_f(1.0 / samples as f32);
            accum.canvas().draw_image(&image, (0, 0), Some(&add));
        }
        let image = accum.image_snapshot();
        canvas.save();
        canvas.reset_matrix();
        let mut p = Paint::default();
        p.set_alpha_f(alpha);
        canvas.draw_image(&image, (0, 0), Some(&p));
        canvas.restore();
        self.marks.extend(texts);
        if errors.is_empty() { Ok(()) } else { Err(errors.join("\n")) }
    }

    /// Read the drawn frame back as straight RGBA.
    pub fn read(&mut self, pixels: &mut Vec<u8>) -> Result<(), String> {
        gpu::read_rgba(self.gpu.as_mut(), &mut self.surface, pixels)
    }

    pub fn png(&mut self) -> Result<Vec<u8>, String> {
        if let Some(g) = self.gpu.as_mut() {
            g.context.flush_and_submit_surface(&mut self.surface, None);
        }
        let image = self.surface.image_snapshot();
        let data = image
            .encode(self.gpu.as_mut().map(|g| &mut g.context), sk::EncodedImageFormat::PNG, None)
            .ok_or("PNG encoding failed")?;
        Ok(data.as_bytes().to_vec())
    }

    /// The block layer's tree for one beat at a film frame (frame audit).
    pub fn block_tree(&mut self, frame: usize) -> Result<(String, fframes::usvgr::Tree), String> {
        let i = self.beat_at(frame);
        let b = &self.film.beats[i];
        let id = b.id.clone();
        let local = frame - b.start_frame;
        Ok((id, self.blocks.tree(i, local, frame)?))
    }

    pub fn blocks_inspect(&mut self, beat: usize, local: usize, frame: usize) -> Result<Vec<(fframes::diagnostics::Severity, String, String)>, String> {
        self.blocks.inspect(beat, local, frame)
    }
}

fn paint_color(hex: &str) -> sk::Color {
    crate::paint::color(crate::paint::hex(hex, 1.0))
}
