//! The compatibility path: block internals that are not yet native scene nodes are drawn by
//! the existing block code (`clearframe-native`) as an SVG input layer, converted to a usvg
//! tree and drawn into the engine's own Skia canvas. Only one beat's own content is drawn
//! here: the backdrop, dissolves, film chrome, lens, grain and letterbox are composited by the
//! engine, not by this layer.
use clearframe_native::Film;
use fframes::{AudioMap, Duration, FFramesContext, Frame, MediaDirectory, Previewer, RenderOptions, Scene, Scenes, Svgr, Video};
use fframes_skia_renderer::render::{RenderCache, render_tree};
use fframes_skia_renderer::skia_safe::Canvas;
use std::cell::Cell;

thread_local! {
    /// Which beat, at which of its own frames, the next tree draws (and its words' alpha).
    static REQUEST: Cell<(usize, usize, f32, u8)> = const { Cell::new((0, 0, 1.0, 0)) };
}

/// The prepared job seen as an FFFrames `Video` whose frame is one beat's scene alone.
pub struct LayerFilm<const W: usize, const H: usize, const RATE: usize>(pub Film);

impl<const W: usize, const H: usize, const RATE: usize> Video for LayerFilm<W, H, RATE> {
    const WIDTH: usize = W;
    const HEIGHT: usize = H;
    const FPS: usize = RATE;
    fn duration(&self) -> Duration<'_> {
        Duration::Auto
    }
    fn audio(&self) -> AudioMap<'_> {
        AudioMap::none()
    }
    fn define_scenes(&self) -> Scenes<'_> {
        Scenes::from(self.0.beats.iter().map(|b| b as &dyn Scene).collect::<Vec<_>>())
    }
    fn render_frame<'a>(&'a self, frame: Frame, ctx: &FFramesContext<'a, '_>) -> Svgr<'a> {
        let (index, local, alpha, part) = REQUEST.with(Cell::get);
        let beat = &self.0.beats[index];
        let env = &beat.environment;
        // Scene-relative frame with the previewer's caches and decoders.
        let offset = frame.index.saturating_sub(local);
        let mut scene_frame = Frame::clone_with_scene_offset(&frame, offset);
        scene_frame.index = local;
        let body = clearframe_native::with_part(part, || {
            clearframe_native::with_text_alpha(alpha, || Scene::render_frame(beat, scene_frame, ctx))
        });
        fframes::svgr!(<svg xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={format!("0 0 {} {}", env.width, env.height)}>{body}</svg>)
    }
}

/// Draws beats of one prepared job; type-erased over the compiled canvas sizes and rates.
pub trait Layers {
    /// Draw beat `beat` at its own frame `local` (film frame `global`) into `canvas`, scaled
    /// from the job's canvas to `width`×`height`. `part`: 0 all, 1 ground only, 2 the rest.
    #[allow(clippy::too_many_arguments)]
    fn draw(&mut self, canvas: &Canvas, beat: usize, local: usize, global: usize, alpha: f32, part: u8, width: f32, height: f32)
    -> Result<(), String>;
    /// The usvg tree of a beat's frame, for the frame audit.
    fn tree(&mut self, beat: usize, local: usize, global: usize) -> Result<fframes::usvgr::Tree, String>;
    /// Converter diagnostics for a beat's frame: (severity, key, message).
    fn inspect(&mut self, beat: usize, local: usize, global: usize) -> Result<Vec<(fframes::diagnostics::Severity, String, String)>, String>;
}

struct Bridge<const W: usize, const H: usize, const RATE: usize> {
    previewer: Previewer<'static, 'static, LayerFilm<W, H, RATE>>,
    cache: RenderCache,
}

impl<const W: usize, const H: usize, const RATE: usize> Layers for Bridge<W, H, RATE> {
    fn draw(
        &mut self,
        canvas: &Canvas,
        beat: usize,
        local: usize,
        global: usize,
        alpha: f32,
        part: u8,
        width: f32,
        height: f32,
    ) -> Result<(), String> {
        let tree = self.tree_with(beat, local, global, alpha, part)?;
        canvas.save();
        canvas.scale((width / W as f32, height / H as f32));
        render_tree(&tree, canvas, &mut self.cache);
        canvas.restore();
        Ok(())
    }
    fn tree(&mut self, beat: usize, local: usize, global: usize) -> Result<fframes::usvgr::Tree, String> {
        self.tree_with(beat, local, global, 1.0, 0)
    }
    fn inspect(&mut self, beat: usize, local: usize, global: usize) -> Result<Vec<(fframes::diagnostics::Severity, String, String)>, String> {
        REQUEST.with(|r| r.set((beat, local, 1.0, 0)));
        let report = self.previewer.inspect(global).map_err(|e| format!("{e:?}"));
        REQUEST.with(|r| r.set((0, 0, 1.0, 0)));
        Ok(report?.diagnostics.into_iter().map(|d| (d.severity, d.key, d.message)).collect())
    }
}

impl<const W: usize, const H: usize, const RATE: usize> Bridge<W, H, RATE> {
    fn tree_with(&mut self, beat: usize, local: usize, global: usize, alpha: f32, part: u8) -> Result<fframes::usvgr::Tree, String> {
        REQUEST.with(|r| r.set((beat, local, alpha, part)));
        let tree = self.previewer.svg_tree(global).map_err(|e| format!("block layer {beat} at frame {global}: {e:?}"));
        REQUEST.with(|r| r.set((0, 0, 1.0, 0)));
        tree
    }
}

fn open_canvas<const W: usize, const H: usize, const RATE: usize>(
    film: Film,
    media: &'static fframes::DynamicMediaProvider<'static>,
) -> Result<Box<dyn Layers>, String> {
    // The bridge lives for the process: the film and media it borrows are leaked once per job.
    let video: &'static LayerFilm<W, H, RATE> = Box::leak(Box::new(LayerFilm(film)));
    let options = RenderOptions { media: Some(media), load_system_fonts: false, default_font: "Inter", ..Default::default() };
    let previewer = Previewer::new(video, &options).map_err(|e| format!("{e:?}"))?;
    Ok(Box::new(Bridge { previewer, cache: RenderCache::new() }))
}

fn open_rate<const W: usize, const H: usize>(film: Film, media: &'static fframes::DynamicMediaProvider<'static>) -> Result<Box<dyn Layers>, String> {
    match film.fps {
        24 => open_canvas::<W, H, 24>(film, media),
        25 => open_canvas::<W, H, 25>(film, media),
        30 => open_canvas::<W, H, 30>(film, media),
        50 => open_canvas::<W, H, 50>(film, media),
        60 => open_canvas::<W, H, 60>(film, media),
        rate => Err(format!("block layers support 24/25/30/50/60 fps, not {rate}")),
    }
}

/// Open the block layers of a prepared job (`job.json`) with its staged media folder.
pub fn open(job: &std::path::Path, media_dir: &std::path::Path) -> Result<Box<dyn Layers>, String> {
    clearframe_native::text::use_font_dir(media_dir);
    let film = Film::read(&job.to_string_lossy()).map_err(|e| format!("{}: {e}", job.display()))?;
    let directory: &'static MediaDirectory =
        Box::leak(Box::new(MediaDirectory::read_folder(media_dir).map_err(|e| format!("{e:?}"))?));
    let media: &'static fframes::DynamicMediaProvider<'static> =
        Box::leak(Box::new(directory.process_media_source().map_err(|e| format!("{e:?}"))?));
    match (film.width, film.height) {
        (1920, 1080) => open_rate::<1920, 1080>(film, media),
        (1080, 1920) => open_rate::<1080, 1920>(film, media),
        (1080, 1080) => open_rate::<1080, 1080>(film, media),
        (1080, 1350) => open_rate::<1080, 1350>(film, media),
        (640, 360) => open_rate::<640, 360>(film, media),
        (w, h) => Err(format!("block layers support the five ClearFrame canvases, not {w}x{h}")),
    }
}
