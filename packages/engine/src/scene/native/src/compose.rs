//! The frame compositor. One Skia GPU canvas per frame, in this order:
//!
//! 1. background colour, then the backdrop, vignette, every beat on screen and the film chrome;
//! 2. for each beat: its ground (tone, plate) from its block, native `under` layers, the
//!    block content, native `over` layers. A wipe draws the outgoing beat, held, ahead of the
//!    edge and the incoming one behind it, so the frame is never empty;
//! 3. stages (native layers spanning beats) around the beats;
//! 4. the editorial frame, grain and review guides on top.
//!
//! Native layers with a shutter are sampled several times inside the frame interval and
//! accumulated in half-float, which is real temporal motion blur rather than a smear.
use crate::blocks::{self, Ctx, Film};
use crate::design::Palette;
use crate::draw::{self, Node};
use crate::film;
use crate::gpu::{self, Gpu};
use crate::media::Media;
use crate::motion::{self, MotionStyle};
use crate::nodes::{self, Camera, Scope, TextMark};
use crate::plan::{Depth, Layer, Plan};
use skia_safe::{self as sk, AlphaType, BlendMode, Canvas, ColorType, ImageInfo, Paint, Rect, Surface, gpu as skgpu};
use std::cell::RefCell;
use std::path::Path;

pub struct Engine {
    pub plan: Plan,
    pub film: Film,
    /// Staged media and output scale, shared by blocks and native layers.
    ctx: Ctx,
    pub gpu: Option<Gpu>,
    pub surface: Surface,
    scratch: Option<Surface>,
    accum: Option<Surface>,
    /// Output pixels.
    pub width: i32,
    pub height: i32,
    /// Layout units (the shorter side is 1080).
    pub logical: (f32, f32),
    palette: Palette,
    /// Native type drawn in the last frame (for the audit).
    pub marks: Vec<TextMark>,
    /// The grain's noise at the output size (film::grain).
    grain: film::GrainCache,
}

impl Engine {
    /// Open a plan for output at `scale` × its format (drafts use 0.5).
    pub fn open(plan_file: &Path, scale: f32) -> Result<Engine, String> {
        let plan = Plan::read(plan_file)?;
        let media_dir = plan.media_path();
        crate::fonts::use_dir(&media_dir);
        let film = Film::read(&plan.job_path().to_string_lossy()).map_err(|e| format!("{}: {e}", plan.job))?;
        if (film.width as u32, film.height as u32, film.fps as u32, film.frames)
            != (plan.format.width, plan.format.height, plan.format.fps, plan.format.frames)
        {
            return Err("the plan's format does not match its block job; prepare again".into());
        }
        for layer in &plan.layers {
            if let Some(id) = &layer.beat {
                if !film.beats.iter().any(|b| &b.id == id) {
                    return Err(format!("layer {} names unknown beat {id}", layer.id));
                }
            }
        }
        if !(scale.is_finite() && scale > 0.0 && scale <= 2.0) {
            return Err("scale must be greater than zero and at most 2".into());
        }
        // Even dimensions, rounded as film/render-geometry.mjs does.
        let even =
            |n: u32| if scale == 1.0 { n as i32 } else { (((n as f32 * scale) / 2.0).round() as i32 * 2).max(2) };
        let (width, height) = (even(plan.format.width), even(plan.format.height));
        if width < 2 || height < 2 {
            return Err("scaled output must have positive even dimensions".into());
        }
        let k = 1080.0 / plan.format.width.min(plan.format.height) as f32;
        let logical = (plan.format.width as f32 * k, plan.format.height as f32 * k);
        let mut gpu = Gpu::new()?;
        let surface = gpu::surface(gpu.as_mut(), width, height)?;
        let ctx = Ctx {
            media: RefCell::new(Media::new(&media_dir, plan.format.fps as usize)),
            scale: width as f32 / logical.0,
        };
        let palette = Palette::from_theme(&film.theme);
        Ok(Engine {
            plan,
            film,
            ctx,
            gpu,
            surface,
            scratch: None,
            accum: None,
            width,
            height,
            logical,
            palette,
            marks: vec![],
            grain: film::GrainCache::default(),
        })
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
        let scale = self.width as f32 / lw;
        let mut surface = self.surface.clone();
        let canvas = surface.canvas();
        canvas.restore_to_count(1);
        canvas.reset_matrix();
        canvas.clear(paint_color(&self.palette.bg));
        canvas.scale((scale, scale));
        // 1. The picture.
        canvas.save();
        let mut bg = Paint::default();
        bg.set_color(paint_color(&self.palette.bg));
        canvas.draw_rect(Rect::from_wh(lw, lh), &bg);
        film::backdrop(canvas, &self.film.backdrop, lw, lh, &self.palette);
        film::vignette(canvas, &self.film.texture, lw, lh, &self.palette);
        self.stages(canvas, frame, Depth::Under, &mut errors);
        let beat = &self.film.beats[i];
        let local = frame - beat.start_frame;
        let edge = if beat.transition == "wipe" {
            let motion = &beat.environment.motion;
            let m = MotionStyle::new(&motion.preset, motion.intensity);
            motion::wipe_edge(&m, local as f32 / fps, beat.frames as f32 / fps)
        } else {
            1.0
        };
        if edge < 1.0 {
            // The edge sits on a whole output pixel and neither side is antialiased, so the two
            // scenes meet without a seam of background between them.
            let x = (lw * edge * scale).round() / scale;
            blocks::set_footer(1);
            if i > 0 {
                let prev = &self.film.beats[i - 1];
                canvas.save();
                canvas.clip_rect(Rect::from_ltrb(x, 0.0, lw, lh), None, Some(false));
                // The leaving scene's type is on its way out under the edge: the frame audit
                // judges only the scene that is arriving.
                let marks = self.marks.len();
                self.beat(canvas, i - 1, prev.frames + local, frame, &mut errors);
                self.marks.truncate(marks);
                canvas.restore();
            }
            canvas.save();
            canvas.clip_rect(Rect::from_ltrb(0.0, 0.0, x, lh), None, Some(false));
            self.beat(canvas, i, local, frame, &mut errors);
            canvas.restore();
            self.footer(canvas, i, local, frame, &mut errors);
        } else if i > 0 && beat.transition == "push" && (local as f32 / fps) < push_seconds(beat) {
            // A push: the leaving scene and the arriving one are one strip, so the frame is never
            // empty; the arriving scene's own offset is the other half (blocks/compositor.rs).
            let m = MotionStyle::new(&beat.environment.motion.preset, beat.environment.motion.intensity);
            let p = motion::out_expo(local as f32 / fps / (m.duration() + 0.15));
            let prev = &self.film.beats[i - 1];
            blocks::set_footer(1);
            canvas.save();
            canvas.translate((-lw * p, 0.0));
            let marks = self.marks.len();
            self.beat(canvas, i - 1, prev.frames + local, frame, &mut errors);
            self.marks.truncate(marks);
            canvas.restore();
            self.beat(canvas, i, local, frame, &mut errors);
            self.footer(canvas, i, local, frame, &mut errors);
        } else if let (true, Some([rx, ry, rw, rh])) = (i > 0 && beat.transition == "into", beat.into) {
            if (local as f32 / fps) < motion::INTO_SECONDS {
                // Into: the camera goes forward through an element of the leaving scene (a screen,
                // a page, a tile) until it overfills the frame and the scene has faded behind it;
                // the arriving scene comes up on its own ground from slightly closer and settles,
                // so the move carries through the cut without one scene's type over the other's.
                let e = local as f32 / fps / motion::INTO_SECONDS;
                let z = motion::in_out_cubic((e / 0.7).min(1.0));
                let big = (lw / rw.max(1.0)).max(lh / rh.max(1.0)) * 1.08;
                let s = big.max(1.0).powf(z);
                let (cx, cy) = (rx + rw / 2.0, ry + rh / 2.0);
                let gone = motion::clamp01((e - 0.38) / 0.3);
                let prev = &self.film.beats[i - 1];
                blocks::set_footer(1);
                if gone < 1.0 {
                    canvas.save();
                    canvas.translate((cx + (lw / 2.0 - cx) * z, cy + (lh / 2.0 - cy) * z));
                    canvas.scale((s, s));
                    canvas.translate((-cx, -cy));
                    // Rushing past the camera, the scene blurs: giant type reads as motion, not
                    // as a fragment of a word.
                    let mut paint = Paint::default();
                    paint.set_alpha_f(1.0 - motion::in_out_cubic(gone));
                    // In frame pixels it grows with the zoom; the layer is scaled by the zoom, so
                    // it is set divided by it.
                    let sigma = (10.0 * (s - 1.0)).min(48.0) / s.max(1.0);
                    if sigma > 0.3 {
                        paint.set_image_filter(sk::image_filters::blur((sigma, sigma), None, None, None));
                    }
                    canvas.save_layer(&sk::canvas::SaveLayerRec::default().paint(&paint));
                    let marks = self.marks.len();
                    self.beat(canvas, i - 1, prev.frames + local, frame, &mut errors);
                    self.marks.truncate(marks);
                    canvas.restore();
                    canvas.restore();
                }
                let q = motion::in_out_cubic(motion::clamp01((e - 0.55) / 0.45));
                if q > 0.0 {
                    let k = 1.0 + 0.06 * (1.0 - q);
                    canvas.save_layer_alpha_f(None, q);
                    canvas.translate((lw / 2.0, lh / 2.0));
                    canvas.scale((k, k));
                    canvas.translate((-lw / 2.0, -lh / 2.0));
                    self.beat(canvas, i, local, frame, &mut errors);
                    canvas.restore();
                }
                self.footer(canvas, i, local, frame, &mut errors);
            } else {
                self.beat(canvas, i, local, frame, &mut errors);
            }
        } else {
            self.beat(canvas, i, local, frame, &mut errors);
        }
        self.stages(canvas, frame, Depth::Over, &mut errors);
        if self.film.chrome {
            let progress = frame as f32 / self.film.frames.max(1) as f32;
            film::chrome(canvas, &self.film.title, lw, &self.palette, progress, &mut self.marks);
        }
        canvas.restore();
        // 4. Over the picture.
        if let Some(spec) = self.film.frame.clone() {
            let tone = self.film.beats[i].tone.clone().unwrap_or_default();
            let palette = Palette::from_theme(&self.film.theme).toned(&tone);
            let label = self.film.beats[i].label.clone();
            film::frame(
                canvas,
                &spec,
                &label,
                lw,
                lh,
                &palette,
                frame as f32 / self.film.frames.max(1) as f32,
                &mut self.marks,
            );
        }
        film::grain(canvas, &self.film.texture, lw, lh, &self.palette, seconds, &mut self.grain);
        if self.film.guides {
            film::guides(canvas, lw, lh);
        }
        canvas.restore_to_count(1);
        canvas.reset_matrix();
        if errors.is_empty() { Ok(()) } else { Err(errors.join("\n")) }
    }

    /// One beat at its own frame `local`: ground, native under layers, block content, native
    /// over layers. Without native layers the block layer is drawn whole.
    fn beat(&mut self, canvas: &Canvas, index: usize, local: usize, frame: usize, errors: &mut Vec<String>) {
        let id = self.film.beats[index].id.clone();
        let has = |z: Depth| self.plan.layers.iter().any(|l| l.beat.as_deref() == Some(id.as_str()) && l.z == z);
        let (under, over) = (has(Depth::Under), has(Depth::Over));
        // The layer's own clock follows the beat frame being drawn (the beat a wipe holds ahead
        // of its edge runs on past its end).
        let beat_frame = self.film.beats[index].start_frame + local;
        let block = |part: u8, errors: &mut Vec<String>| match self.block(index, local, frame, part) {
            Ok(node) => draw::paint(canvas, &node),
            Err(e) => errors.push(e),
        };
        if under {
            block(1, errors);
            self.layers_of(canvas, Some(&id), Depth::Under, beat_frame, errors);
            self.block(index, local, frame, 2)
                .map(|n| draw::paint(canvas, &n))
                .unwrap_or_else(|e| errors.push(e));
        } else {
            block(0, errors);
        }
        if over {
            self.layers_of(canvas, Some(&id), Depth::Over, beat_frame, errors);
        }
    }

    /// A beat's captions and source line on their own, still and whole over a transition; the
    /// beats around it were drawn without theirs. Leaves footers on for what follows.
    fn footer(&mut self, canvas: &Canvas, index: usize, local: usize, frame: usize, errors: &mut Vec<String>) {
        blocks::set_footer(2);
        match self.block(index, local, frame, 0) {
            Ok(node) => draw::paint(canvas, &node),
            Err(e) => errors.push(e),
        }
        blocks::set_footer(0);
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
            // A beat's own layers run on with the beat (a wipe holds the outgoing beat past its
            // last frame); stages are drawn over their span.
            .filter(|(_, l)| {
                l.beat.as_deref() == beat
                    && l.z == z
                    && frame >= l.start
                    && (beat.is_some() || frame < l.start + l.frames)
            })
            .map(|(i, _)| i)
            .collect();
        for i in picked {
            if let Err(e) = self.layer(canvas, i, frame) {
                errors.push(e);
            }
        }
    }

    fn scope<'m>(
        media: &'m mut Media,
        film: &Film,
        layer: &Layer,
        palette: &Palette,
        fps: f32,
        pixel: f32,
        t: f32,
        view: (f32, f32),
    ) -> Scope<'m> {
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
            sample: 0.0,
            locating: false,
            depth: 0,
            words: 1.0,
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
            let mut media = self.ctx.media.borrow_mut();
            let mut scope = Self::scope(&mut media, &self.film, &layer, &palette, fps, pixel, t, self.logical);
            nodes::draw(canvas, &mut scope, &layer.elements, 0.0, 0.0, t);
            if alpha < 0.999 {
                canvas.restore();
            }
            let (texts, errors) = (scope.texts, scope.errors);
            drop(media);
            self.marks.extend(texts);
            return if errors.is_empty() { Ok(()) } else { Err(errors.join("\n")) };
        }
        // Temporal motion blur: `samples` evaluations spread over the open shutter, summed at
        // equal weight in a half-float surface, then composited once.
        let (w, h) = (self.width, self.height);
        let matrix = canvas.local_to_device_as_3x3();
        if self.accum.is_none() {
            let info = ImageInfo::new((w, h), ColorType::RGBAF16, AlphaType::Premul, None);
            self.accum = Some(
                match self.gpu.as_mut() {
                    Some(g) => skgpu::surfaces::render_target(
                        &mut g.context,
                        skgpu::Budgeted::Yes,
                        &info,
                        None,
                        skgpu::SurfaceOrigin::TopLeft,
                        None,
                        false,
                        None,
                    ),
                    None => sk::surfaces::raster(&info, None, None),
                }
                .ok_or("cannot create the motion-blur accumulation surface")?,
            );
            self.scratch = Some(gpu::surface(self.gpu.as_mut(), w, h)?);
        }
        let mut accum = self.accum.clone().unwrap();
        let mut scratch = self.scratch.clone().unwrap();
        accum.canvas().clear(sk::Color::TRANSPARENT);
        let mut errors = vec![];
        let mut texts = vec![];
        for k in 0..samples {
            // The shutter never opens before the layer exists.
            let offset = (k as f32 / (samples - 1) as f32 - 0.5) * layer.shutter;
            let ts = (t + offset / fps).max(0.0);
            let sc = scratch.canvas();
            sc.clear(sk::Color::TRANSPARENT);
            sc.save();
            sc.set_matrix(&matrix.into());
            let mut media = self.ctx.media.borrow_mut();
            let mut scope = Self::scope(&mut media, &self.film, &layer, &palette, fps, pixel, ts, self.logical);
            scope.sample = ts - t;
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

    /// Beat `index`'s block at its frame `local` (film frame `frame`). A block that cannot be
    /// drawn (text that does not fit its box, missing media) fails the frame with its reason.
    fn block(&self, index: usize, local: usize, frame: usize, part: u8) -> Result<Node, String> {
        let film = &self.film;
        let ctx = &self.ctx;
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            blocks::draw_beat(film, index, local, frame, ctx, 1.0, part)
        }))
        .map_err(|e| {
            let why = e
                .downcast_ref::<String>()
                .cloned()
                .or_else(|| e.downcast_ref::<&str>().map(|s| s.to_string()))
                .unwrap_or_default();
            format!("beat {} at frame {frame}: {why}", film.beats[index].id)
        })
    }

    /// The block drawn at a film frame, in format pixels (the frame audit's units).
    pub fn block_tree(&mut self, frame: usize) -> Result<(String, Node), String> {
        let i = self.beat_at(frame);
        let b = &self.film.beats[i];
        let (id, local) = (b.id.clone(), frame - b.start_frame);
        let k = self.plan.format.width as f32 / self.logical.0;
        Ok((id, self.block(i, local, frame, 0)?.scale(k, k)))
    }
}

/// Straight RGBA rows as PNG. Review stills favour speed: one filter and light compression (a
/// grain-textured 1080p frame at zlib's default effort takes hundreds of milliseconds).
pub fn encode_png(pixels: &[u8], width: i32, height: i32) -> Result<Vec<u8>, String> {
    let mut pixels = pixels.to_vec();
    let info = ImageInfo::new((width, height), ColorType::RGBA8888, AlphaType::Unpremul, None);
    let pixmap = sk::Pixmap::new(&info, &mut pixels, width as usize * 4).ok_or("PNG pixmap")?;
    let mut options = sk::png_encoder::Options::default();
    options.filter_flags = sk::png_encoder::FilterFlag::SUB;
    options.z_lib_level = 2;
    let mut out = Vec::new();
    if !sk::png_encoder::encode(&pixmap, &mut out, &options) {
        return Err("PNG encoding failed".into());
    }
    Ok(out)
}

fn paint_color(hex: &str) -> sk::Color {
    crate::paint::color(crate::paint::hex(hex, 1.0))
}

/// Seconds a push holds the leaving scene beside the arriving one.
fn push_seconds(beat: &blocks::Beat) -> f32 {
    MotionStyle::new(&beat.environment.motion.preset, beat.environment.motion.intensity).duration() + 0.15
}
