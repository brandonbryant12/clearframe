//! fframes is the film runtime; ClearFrame's engine draws the frames.
//!
//! `render` hands the film to `fframes::render` with [`Backend`], a custom
//! `FFramesRenderBackend`: fframes resolves the timeline, cuts the frames into the same
//! GOP-aligned segments on every render, encodes them in parallel with in-process FFmpeg and
//! libx264, and concatenates them; each of its render workers opens its own [`Engine`] (its own
//! Metal context, surfaces and footage decoders) and draws the frames it claims with the
//! ClearFrame display list. Nothing about how a frame looks changes: the same compositor draws
//! it, so stills, inspect and audit keep using the engine directly.
//!
//! The film's audio is still mixed by the Node finisher (engine/lib/audio.mjs), so the
//! fframes video carries no audio map yet.
use crate::compose::Engine;
use crate::yuv;
use fframes::{
    AVPixelFormat, AudioMap, AudioTimelineSamples, Color, Duration, EncoderOptions, FFramesContext, FFramesLogger,
    FFramesLoggerVariant, FFramesRenderBackend, FFramesRendererError, FFramesRendererResult, Frame, FramePool,
    FrameScheduler, RenderOptions, ResolvedRenderingTimeline, SegmentWriter, Svgr, Video, VideoFrame, usvgr,
};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::sync_channel;
use std::time::Instant;

/// The film as fframes sees it: a duration and a format. Size and rate are associated
/// constants in fframes, so every supported canvas and rate is its own type (see [`render`]).
pub struct Film<const W: usize, const H: usize, const FPS: usize> {
    frames: usize,
}

impl<const W: usize, const H: usize, const FPS: usize> Video for Film<W, H, FPS> {
    const FPS: usize = FPS;
    const WIDTH: usize = W;
    const HEIGHT: usize = H;
    const BACKGROUND_COLOR: Color = Color::BLACK;

    fn duration(&self) -> Duration<'_> {
        Duration::Frames(self.frames)
    }

    fn audio(&self) -> AudioMap<'_> {
        AudioMap::none()
    }

    /// Never called: [`Backend`] draws every frame with the engine.
    fn render_frame<'a>(&'a self, _frame: Frame, _ctx: &FFramesContext<'a, '_>) -> Svgr<'a> {
        Svgr::empty()
    }
}

/// The shortest segment fframes may cut: whole GOPs (250 frames, where the single-stream
/// encode placed its keyframes) for anything longer than four GOPs — fframes' default of one
/// second puts a keyframe every second and costs ~3× the bytes on an explainer's held frames
/// at the same CRF — and whole seconds that cut a short film into about four segments, so it
/// still encodes in parallel. It depends only on the frame count, never on the number of
/// workers, so every worker count encodes the same bytes.
fn segment_frames(frames: usize, fps: usize, gop: usize) -> usize {
    let fps = fps.max(1);
    ((frames / 4 / fps) * fps).clamp(fps, gop.max(fps))
}

/// What a worker hands its encoder thread: encoder-ready planes, or RGBA to convert.
enum Picture {
    Yuv(VideoFrame),
    Rgba(Vec<u8>),
}

/// Draws the claimed frames with one ClearFrame engine per fframes render worker.
pub struct Backend<'p> {
    pub plan: &'p Path,
    pub scale: f32,
    pub workers: usize,
    stats: Arc<Stats>,
}

/// Measured while rendering, summed over the workers.
#[derive(Default)]
pub struct Stats {
    draw_us: AtomicU64,
    read_us: AtomicU64,
    encode_us: AtomicU64,
    frames: AtomicU64,
    backend: std::sync::OnceLock<&'static str>,
}

fn us(t: Instant) -> u64 {
    t.elapsed().as_micros() as u64
}

impl FFramesRenderBackend for Backend<'_> {
    #[allow(clippy::too_many_arguments)]
    fn render<'a, 'media: 'a, TVideo: Video + Sync + Sized + Send>(
        self,
        output: impl AsRef<Path>,
        _video: &'a TVideo,
        logger: Arc<dyn FFramesLogger>,
        _usvg_options: &'a usvgr::Options,
        render_options: &'a RenderOptions<'a, 'media>,
        _font_db: &'a usvgr::fontdb::Database,
        timeline: &'a ResolvedRenderingTimeline<AudioTimelineSamples>,
        ctx: &'a FFramesContext<'a, 'media>,
    ) -> FFramesRendererResult<()> {
        let output = output.as_ref();
        let extension = output.extension().ok_or(FFramesRendererError::InvalidOutput)?.to_string_lossy().into_owned();
        let directory = render_options
            .tmp_files_directory
            .cloned()
            .unwrap_or_else(|| std::env::temp_dir().join(format!("clearframe-segments-{}", std::process::id())));
        std::fs::create_dir_all(&directory)?;
        // Segments are in output frames; `offset` maps them back to film frames for a range.
        let range = render_options.output_frame_range(ctx.duration_in_frames);
        let offset = range.start;
        let size = &ctx.current_video_size;
        let scheduler = FrameScheduler::new(
            range.len(),
            self.workers.max(1),
            segment_frames(range.len(), ctx.time_base.fps, render_options.video_encoder_options.gop_size.max(1) as usize),
        );
        let writer = SegmentWriter::new(
            &directory,
            &extension,
            (size.width as i32, size.height as i32, ctx.time_base.fps as i32),
            render_options,
            &logger,
        );
        let input = writer
            .encoder_info()
            .and_then(|encoder| self.negotiate_encoder_input(&encoder))
            .map_err(|err| FFramesRendererError::RenderChunkError(0, err))?;
        let writer = writer.with_encoder_input(input);
        let failed = AtomicBool::new(false);
        let (w, h) = (size.width as i32, size.height as i32);
        let stats = &self.stats;
        let plan = self.plan;
        let scale = self.scale;

        let work = |worker: usize| -> FFramesRendererResult<()> {
            let mut engine = Engine::open(plan, scale).map_err(FFramesRendererError::Custom)?;
            if (engine.width, engine.height) != (w, h) {
                return Err(FFramesRendererError::Custom(format!(
                    "the engine draws {}x{} but fframes encodes {w}x{h}",
                    engine.width, engine.height
                )));
            }
            let _ = stats.backend.set(engine.backend());
            let chunk = |err| FFramesRendererError::RenderChunkError(worker, err);
            // yuv420p/BT.601 frames are converted by ClearFrame (chroma averaged per 2×2 block,
            // yuv.rs): on the GPU when there is one, else on this worker's encoder thread. Any
            // other negotiated format goes through fframes' own converter.
            let i420 = writer.encoder_input().pixel_format == AVPixelFormat::AV_PIX_FMT_YUV420P
                && writer.encoder_input().color_matrix == fframes::pix_fmt::YuvMatrix::Bt601;
            let pool = if i420 { Some(FramePool::new(AVPixelFormat::AV_PIX_FMT_YUV420P, w, h).map_err(chunk)?) } else { None };
            let mut gpu_yuv = match (&pool, std::env::var("CLEARFRAME_GPU_YUV").as_deref() != Ok("0")) {
                (Some(_), true) => yuv::GpuI420::new(&mut engine).map_err(FFramesRendererError::Custom)?,
                _ => None,
            };
            let ch = (h as usize).div_ceil(2);
            let planes = |frame: &VideoFrame| {
                let plane = |i: usize, rows: usize| {
                    let (data, stride) = frame.plane(i);
                    // SAFETY: the pool allocated `stride × rows` bytes for plane i of this frame,
                    // and nothing else writes it until the frame is submitted.
                    yuv::Plane { data: unsafe { std::slice::from_raw_parts_mut(data, stride as usize * rows) }, stride: stride as usize }
                };
                [plane(0, h as usize), plane(1, ch), plane(2, ch)]
            };
            // Drawing overlaps encoding: this worker's encoder thread takes its frames in claim
            // order (a segment's frames stay in order) through a queue of two; RGBA buffers come
            // back for reuse, so no frame allocates.
            let (to_encoder, frames) = sync_channel::<(fframes::FrameClaim, Picture)>(2);
            let (to_painter, spare) = sync_channel::<Vec<u8>>(3);
            for _ in 0..3 {
                let _ = to_painter.send(Vec::new());
            }
            std::thread::scope(|s| -> FFramesRendererResult<()> {
                let (writer, pool) = (&writer, &pool);
                let encoder = s.spawn(move || -> FFramesRendererResult<()> {
                    for (claim, picture) in frames {
                        let t = Instant::now();
                        match (picture, pool) {
                            (Picture::Yuv(frame), _) => writer.submit_frame(claim, frame).map_err(chunk)?,
                            (Picture::Rgba(pixels), Some(pool)) => {
                                let frame = pool.get().map_err(chunk)?;
                                let [y, u, v] = planes(&frame);
                                yuv::rgba_to_i420(&pixels, w as usize, h as usize, y, u, v);
                                writer.submit_frame(claim, frame).map_err(chunk)?;
                                let _ = to_painter.send(pixels);
                            }
                            (Picture::Rgba(pixels), None) => {
                                writer.submit(claim, &pixels).map_err(chunk)?;
                                let _ = to_painter.send(pixels);
                            }
                        }
                        stats.encode_us.fetch_add(us(t), Ordering::Relaxed);
                    }
                    Ok(())
                });
                let mut done = 0;
                let drawn: FFramesRendererResult<()> = (|| {
                    while let Some(claim) = scheduler.claim(worker) {
                        if failed.load(Ordering::Relaxed) {
                            return Ok(());
                        }
                        let frame = claim.frame + offset;
                        let t = Instant::now();
                        engine.render(frame).map_err(|e| FFramesRendererError::Custom(format!("frame {frame}: {e}")))?;
                        stats.draw_us.fetch_add(us(t), Ordering::Relaxed);
                        let t = Instant::now();
                        let picture = match (&mut gpu_yuv, pool) {
                            (Some(conv), Some(pool)) => {
                                let out = pool.get().map_err(chunk)?;
                                conv.read(&mut engine, planes(&out)).map_err(FFramesRendererError::Custom)?;
                                Picture::Yuv(out)
                            }
                            _ => {
                                let mut pixels = spare.recv().unwrap_or_default();
                                engine.read(&mut pixels).map_err(FFramesRendererError::Custom)?;
                                Picture::Rgba(pixels)
                            }
                        };
                        stats.read_us.fetch_add(us(t), Ordering::Relaxed);
                        if to_encoder.send((claim, picture)).is_err() {
                            break; // the encoder stopped; its error is reported below
                        }
                        stats.frames.fetch_add(1, Ordering::Relaxed);
                        logger.log_frame(done, worker);
                        done += 1;
                    }
                    Ok(())
                })();
                drop(to_encoder);
                let encoded = encoder.join().map_err(|_| FFramesRendererError::Internal("an encoder thread panicked".to_owned()))?;
                drawn.and(encoded)
            })
        };

        std::thread::scope(|scope| {
            let handles: Vec<_> = (0..scheduler.workers())
                .map(|worker| {
                    let (work, failed) = (&work, &failed);
                    scope.spawn(move || {
                        let result = work(worker);
                        if result.is_err() {
                            failed.store(true, Ordering::Relaxed);
                        }
                        result
                    })
                })
                .collect();
            handles
                .into_iter()
                .map(|h| h.join().map_err(|_| FFramesRendererError::Internal("a render worker panicked".to_owned()))?)
                .collect::<FFramesRendererResult<Vec<_>>>()
        })?;

        let files = writer.finish().map_err(|err| FFramesRendererError::RenderChunkError(0, err))?;
        // SAFETY: the segment files were all written and closed by `finish`.
        unsafe {
            fframes::concatenator::concat_video_files_with_audio(
                files.as_slice(),
                output,
                timeline.audio_map.as_ref(),
                render_options,
                ctx,
                &logger,
            )
            .map_err(FFramesRendererError::ConcatChunkError)?;
        }
        for f in &files {
            let _ = std::fs::remove_file(f);
        }
        let _ = std::fs::remove_dir(&directory);
        Ok(())
    }

    fn render_frame<'a, 'media: 'a, TVideo: Video + Sync + Sized + Send>(
        self,
        frame: Frame,
        _video: &'a TVideo,
        _usvg_options: &usvgr::Options,
        _font_db: &usvgr::fontdb::Database,
        _ctx: FFramesContext<'a, 'media>,
    ) -> FFramesRendererResult<Vec<u8>> {
        let mut engine = Engine::open(self.plan, self.scale).map_err(FFramesRendererError::Custom)?;
        engine.render(frame.index).map_err(FFramesRendererError::Custom)?;
        let mut pixels = Vec::new();
        engine.read(&mut pixels).map_err(FFramesRendererError::Custom)?;
        Ok(pixels)
    }
}

/// The encoder settings of a draft or final render: libx264 at the same CRF, preset and
/// adaptive quantisation the engine's own FFmpeg pipe used, and a 250-frame GOP that the
/// segments align to. `threads` codec threads per segment (segments also run in parallel).
fn x264(draft: bool, threads: &str) -> [(&'static str, String); 4] {
    let (crf, preset) = if draft { ("21", "veryfast") } else { ("16", "medium") };
    [("crf", crf.into()), ("preset", preset.into()), ("threads", threads.into()), ("aq-mode", "3".into())]
}

/// Render film frames `[a, b)` of `plan` to `out` (H.264 MP4, no audio) through fframes.
pub fn render(plan: &Path, scale: f32, draft: bool, a: usize, b: usize, out: &Path) -> Result<serde_json::Value, String> {
    // The film's format; every worker's engine checks that it draws at fframes' output size.
    let format = crate::plan::Plan::read(plan)?.format;
    let (width, height, fps, frames) = (format.width as usize, format.height as usize, format.fps as usize, format.frames);
    let size = fframes::VideoSize::new_scaled(width, height, scale as f64);
    let (out_w, out_h) = (size.width, size.height);
    let backend_name = if cfg!(target_os = "macos") { "skia-metal" } else { "skia-raster" };
    let workers = std::env::var("CLEARFRAME_RENDER_WORKERS").ok().and_then(|s| s.parse().ok()).unwrap_or(2usize).clamp(1, 4);
    let stats = Arc::new(Stats::default());
    let start = Instant::now();
    let tmp: PathBuf = out.with_extension("segments");
    let threads = std::env::var("CLEARFRAME_ENCODER_THREADS").ok().and_then(|s| s.parse::<u8>().ok()).unwrap_or(2).clamp(1, 4);
    let owned = x264(draft, &threads.to_string());
    let params: Vec<(&str, &str)> = owned.iter().map(|(k, v)| (*k, v.as_str())).collect();
    let options = RenderOptions {
        logger: if std::env::var("CLEARFRAME_PROGRESS").is_ok() {
            FFramesLoggerVariant::Compact
        } else {
            FFramesLoggerVariant::Quiet
        },
        scale_resolution: scale as f64,
        tmp_files_directory: Some(&tmp),
        frame_range: Some(a..b),
        video_encoder_options: EncoderOptions {
            preferred_encoder: Some("libx264"),
            gop_size: 250,
            qmin: 0,
            qmax: 69,
            codec_params: Some(&params),
            ..Default::default()
        },
        ..Default::default()
    };
    let backend = Backend { plan, scale, workers, stats: stats.clone() };
    macro_rules! go {
        ($w:literal, $h:literal, $fps:literal) => {
            fframes::render(out, &Film::<$w, $h, $fps> { frames }, backend, &options)
        };
    }
    macro_rules! rate {
        ($w:literal, $h:literal) => {
            match fps {
                24 => go!($w, $h, 24),
                25 => go!($w, $h, 25),
                30 => go!($w, $h, 30),
                50 => go!($w, $h, 50),
                60 => go!($w, $h, 60),
                _ => return Err(format!("unsupported frame rate {fps}")),
            }
        };
    }
    let result = match (width, height) {
        (1920, 1080) => rate!(1920, 1080),
        (1080, 1920) => rate!(1080, 1920),
        (1080, 1080) => rate!(1080, 1080),
        (1080, 1350) => rate!(1080, 1350),
        (640, 360) => rate!(640, 360),
        _ => return Err(format!("unsupported canvas {width}x{height}")),
    };
    let _ = std::fs::remove_dir_all(&tmp);
    result.map_err(|e| format!("fframes render failed: {e:?}"))?;
    let ms = |v: &AtomicU64| v.load(Ordering::Relaxed) as f64 / 1e3;
    Ok(serde_json::json!({
        "runtime": "fframes", "frames": stats.frames.load(Ordering::Relaxed), "range": [a, b],
        "seconds": start.elapsed().as_secs_f64(), "workers": workers, "encoderThreads": threads,
        "drawMs": ms(&stats.draw_us), "readbackMs": ms(&stats.read_us), "encodeSubmitMs": ms(&stats.encode_us),
        "backend": stats.backend.get().copied().unwrap_or(backend_name),
        "width": out_w, "height": out_h, "fps": fps
    }))
}
