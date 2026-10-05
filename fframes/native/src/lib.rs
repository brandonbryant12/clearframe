//! ClearFrame's content-driven native renderer. No authoring code runs per job.
use fframes::{AudioMap, Duration, FFramesContext, Frame, Scene, Scenes, Svgr, Video};
use serde::Deserialize;
use serde_json::Value;

pub mod audit;
pub mod constants;
pub mod design;
pub mod icons;
pub mod lens;
pub mod motion;
mod scenes;
pub mod text;
pub use scenes::{format_number, zero_scale};

/// Draw only part of a beat: 0 the whole beat, 1 only its ground (tone and plate), 2 all but
/// its ground. The ClearFrame scene engine draws native layers between the two.
pub fn with_part<T>(part: u8, render: impl FnOnce() -> T) -> T {
    scenes::PART.with(|p| p.set(part));
    let out = render();
    scenes::PART.with(|p| p.set(0));
    out
}

/// Draw `render` with the words of the beat at `alpha` (1 is normal). The ClearFrame scene
/// engine composes dissolves itself and uses this for the outgoing beat, whose words clear
/// before the pictures cross, as `NativeFilm::render_frame` does.
pub fn with_text_alpha<T>(alpha: f32, render: impl FnOnce() -> T) -> T {
    scenes::TEXT_ALPHA.with(|a| a.set(alpha));
    let out = render();
    scenes::TEXT_ALPHA.with(|a| a.set(1.0));
    out
}

pub const BLOCKS: &[&str] = &[
    "title",
    "statement",
    "stat",
    "kpis",
    "bars",
    "line",
    "waffle",
    "ring",
    "delta",
    "compare",
    "steps",
    "timeline",
    "funnel",
    "quote",
    "list",
    "matrix",
    "equation",
    "callout",
    "endcard",
    "image",
    "video",
    "kinetic",
    "icon-grid",
    "flow",
    "cycle",
    "breathing",
    "chapter",
    "highlight",
    "donut",
    "magnitude",
    "checklist",
    "annotate",
    "canvas",
    // A beat whose picture is drawn by the scene engine's native layers: the block layer
    // keeps its heading, source line, captions, speaker and transitions.
    "stage",
];
/// Scene entrances. `panel`, `iris` and `whip` are graphic transitions: the outgoing scene's
/// exit and the incoming entrance share one continuous movement across the cut.
pub const TRANSITIONS: &[&str] =
    &["cut", "fade", "rise", "wipe", "push", "zoom", "panel", "iris", "whip", "flash", "dissolve"];

#[derive(Debug, Clone, Deserialize)]
pub struct Caption {
    pub start: f32,
    pub end: f32,
    pub text: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(default)]
pub struct Motion {
    pub preset: String,
    pub intensity: f32,
}
impl Default for Motion {
    fn default() -> Self {
        Self { preset: "gentle".into(), intensity: 0.6 }
    }
}

#[derive(Debug, Clone, Default)]
pub struct Environment {
    pub width: f32,
    pub height: f32,
    pub theme: Value,
    pub motion: Motion,
    pub captions: bool,
    pub index: usize,
    pub total: usize,
    /// The film draws an editorial frame; scenes keep their source line clear of its footer.
    pub framed: bool,
    /// Film-wide default for how type arrives.
    pub text_motion: String,
    /// `plate` (phrase on a soft plate) or `pop` (social: heavy outlined type, spoken word on a pill).
    pub caption_style: String,
    /// The film's type voice (display family, emphasis, case, tracking, leading).
    pub voice: text::Voice,
}

#[derive(Debug, Deserialize)]
pub struct Beat {
    pub id: String,
    pub block: String,
    pub frames: usize,
    pub start_frame: usize,
    pub cue_seconds: f32,
    /// When a number block's count or fill starts, if later than its entrance (`cue_seconds`):
    /// the card arrives with the voice and the figure still lands on its word.
    #[serde(default)]
    pub count_seconds: Option<f32>,
    #[serde(default = "cut")]
    pub transition: String,
    /// How the scene leaves: none, fade, push, zoom or wipe (set from the next entrance).
    #[serde(default = "none")]
    pub exit: String,
    /// Scene seconds by which every value and staged element has reached its final state;
    /// the exit never starts earlier.
    #[serde(default)]
    pub settle_seconds: f32,
    pub props: Value,
    #[serde(default)]
    pub captions: Vec<Caption>,
    #[serde(default)]
    pub words: Vec<Caption>,
    #[serde(default)]
    pub motion: Option<Motion>,
    /// Author-drawn canvas elements under and over the block: `{under: [...], over: [...]}`.
    #[serde(default)]
    pub art: Option<Value>,
    /// Slow camera move over the scene: `{move: in|out|left|right|up|down|none, amount}`.
    #[serde(default)]
    pub camera: Option<Value>,
    /// An image or footage plate behind or beside the block: `{file, video, side, treatment, drift, scrim}`.
    #[serde(default)]
    pub plate: Option<Value>,
    /// Colour-blocked scene: `accent`, `accent2`, `invert` or `surface` fills the frame and
    /// re-derives readable text colours for it.
    #[serde(default)]
    pub tone: Option<String>,
    /// Graphic-transition styling for this scene's entrance and exit: `{color, origin: [x, y]}`
    /// with a palette token and a 0–1 origin (iris centre, panel direction).
    #[serde(default)]
    pub enter_style: Option<Value>,
    #[serde(default)]
    pub exit_style: Option<Value>,
    /// Section label shown by the film frame (chapter or authored label).
    #[serde(default)]
    pub label: String,
    /// Who is speaking: `{name, role, color, continues}` (continues: the previous beat had the
    /// same speaker, so the tag holds instead of re-entering).
    #[serde(default)]
    pub speaker: Option<Value>,
    /// How type arrives in this scene: lines, words, letters or cascade (film default otherwise).
    #[serde(default)]
    pub text_motion: Option<String>,
    /// This scene's own type voice, when it differs from the film's.
    #[serde(default, rename = "type")]
    pub type_voice: Option<text::Voice>,
    /// Where the title sits: `top` (default) or `bottom`, a lower third under the picture.
    #[serde(default)]
    pub heading: String,
    /// Voice level per scene frame, 0–100, prepared from this beat's narration audio.
    #[serde(default)]
    pub levels: Vec<u8>,
    /// The resolved lens for this beat (film `lens` merged with the beat's): letterbox,
    /// grade, bloom, aberration, leak, handheld and motion blur.
    #[serde(default)]
    pub lens: Value,
    #[serde(skip)]
    pub environment: Environment,
}
fn cut() -> String {
    "cut".into()
}
fn plate() -> String {
    "plate".into()
}
fn lines() -> String {
    "lines".into()
}
fn none() -> String {
    "none".into()
}
fn paper() -> Value {
    Value::String("paper".into())
}

#[derive(Debug, Deserialize)]
pub struct Film {
    pub version: usize,
    pub width: usize,
    pub height: usize,
    pub fps: usize,
    pub frames: usize,
    #[serde(default)]
    pub title: String,
    #[serde(default = "paper")]
    pub theme: Value,
    #[serde(default)]
    pub backdrop: String,
    #[serde(default)]
    pub chrome: bool,
    #[serde(default)]
    pub captions: bool,
    #[serde(default)]
    pub motion: Motion,
    /// Film-wide surface texture: `{grain: 0–1, vignette: 0–1, animate: bool}`.
    #[serde(default)]
    pub texture: Value,
    /// Default arrival of type in every scene: lines, words, letters or cascade.
    #[serde(default = "lines")]
    pub text_motion: String,
    /// The type voice resolved from `library/types`; absent for the default Inter look.
    #[serde(default, rename = "type")]
    pub type_voice: Option<text::Voice>,
    #[serde(default = "plate")]
    pub caption_style: String,
    /// Editorial frame chrome: brand, section label, footers and a progress line.
    #[serde(default)]
    pub frame: Option<Value>,
    /// Review aid: a labelled 100 px coordinate grid over every frame (never in deliverables).
    #[serde(default)]
    pub guides: bool,
    pub beats: Vec<Beat>,
}

impl Film {
    pub fn read(file: &str) -> Result<Self, Box<dyn std::error::Error>> {
        Self::from_json(&std::fs::read(file)?)
    }

    pub fn from_json(bytes: &[u8]) -> Result<Self, Box<dyn std::error::Error>> {
        let mut film: Self = serde_json::from_slice(bytes)?;
        if film.version != 2
            || film.beats.is_empty()
            || ![(1920, 1080), (1080, 1920), (1080, 1080), (1080, 1350), (640, 360)]
                .contains(&(film.width, film.height))
            || ![24, 25, 30, 50, 60].contains(&film.fps)
        {
            return Err("job requires version 2, a supported canvas, and 24/25/30/50/60 fps".into());
        }
        let scale = 1080.0 / film.width.min(film.height) as f32;
        let total = film.beats.len();
        let voice = film.type_voice.clone().unwrap_or_default();
        if !voice.valid() {
            return Err(format!("job type voice {} names an unknown face set or emphasis", voice.id).into());
        }
        let mut offset = 0;
        for (index, beat) in film.beats.iter_mut().enumerate() {
            if !BLOCKS.contains(&beat.block.as_str())
                || beat.frames == 0
                || beat.start_frame != offset
                || !beat.cue_seconds.is_finite()
                || beat.cue_seconds < 0.0
                || !beat.props.is_object()
                || !TRANSITIONS.contains(&beat.transition.as_str())
                || motion::ExitKind::parse(&beat.exit).is_none()
                || !beat.settle_seconds.is_finite()
                || beat.settle_seconds < 0.0
                || !["", "none", "accent", "accent2", "invert", "surface"].contains(&beat.tone.as_deref().unwrap_or(""))
                || !beat.type_voice.as_ref().is_none_or(text::Voice::valid)
            {
                return Err(format!("invalid native scene {}", beat.id).into());
            }
            let duration = beat.frames as f32 / film.fps as f32;
            for cues in [&beat.captions, &beat.words] {
                let mut previous_end = 0.0;
                for cue in cues {
                    if !cue.start.is_finite()
                        || !cue.end.is_finite()
                        || cue.start < previous_end
                        || cue.end <= cue.start
                        || cue.end > duration + 0.001
                        || cue.text.trim().is_empty()
                    {
                        return Err(format!("invalid or overlapping cues in {}", beat.id).into());
                    }
                    previous_end = cue.end;
                }
            }
            if beat.block == "kinetic" && beat.words.is_empty() {
                return Err(format!("kinetic scene {} requires timed words", beat.id).into());
            }
            scenes::validate_diagram(&beat.block, &beat.props)
                .and_then(|_| scenes::validate_layers(beat.art.as_ref(), beat.camera.as_ref(), beat.plate.as_ref()))
                .map_err(|message| format!("invalid native scene {}: {message}", beat.id))?;
            let motion = beat.motion.clone().unwrap_or_else(|| film.motion.clone());
            if !["gentle", "snappy", "spring"].contains(&motion.preset.as_str())
                || !motion.intensity.is_finite()
                || !(0.0..=1.0).contains(&motion.intensity)
            {
                return Err("motion must use gentle/snappy/spring and intensity 0..1".into());
            }
            beat.environment = Environment {
                width: film.width as f32 * scale,
                height: film.height as f32 * scale,
                theme: film.theme.clone(),
                motion,
                captions: film.captions,
                index,
                total,
                framed: film.frame.is_some(),
                text_motion: film.text_motion.clone(),
                caption_style: film.caption_style.clone(),
                voice: voice.clone(),
            };
            offset += beat.frames;
        }
        if offset != film.frames {
            return Err("job frame total does not match scenes".into());
        }
        Ok(film)
    }
}

impl Scene for Beat {
    fn duration(&self) -> Duration<'_> {
        Duration::Frames(self.frames)
    }
    fn render_frame<'a>(&'a self, frame: Frame, ctx: &FFramesContext<'a, '_>) -> Svgr<'a> {
        scenes::render(self, frame, ctx)
    }
}

impl<const W: usize, const H: usize, const RATE: usize> NativeFilm<W, H, RATE> {
    /// A consistent editorial frame around every scene: brand mark top-left (serif italic),
    /// the current section label top-right and footers bottom-left/right (monospace), and a
    /// hairline progress rail with an accent segment.
    fn frame_chrome<'a>(&self, w: f32, h: f32, global: usize) -> Svgr<'a> {
        let Some(spec) = self.0.frame.as_ref() else { return fframes::svgr!(<g />) };
        let text = |v: &Value, key: &str| v.get(key).and_then(Value::as_str).unwrap_or("").to_owned();
        let beat = self.0.beats.iter().rev().find(|b| b.start_frame <= global).unwrap_or(&self.0.beats[0]);
        let local = design::Palette::from_theme(&self.0.theme).toned(beat.tone.as_deref().unwrap_or(""));
        let (ink, muted, accent) = (local.ink.clone(), local.muted.clone(), local.accent.clone());
        // Aligned to the scenes' content grid.
        let margin = if w / h > 1.3 { 120.0 } else { 86.0 };
        let brand = text(spec, "brand");
        let label = if spec.get("label").and_then(Value::as_bool) == Some(false) {
            String::new()
        } else {
            beat.label.to_uppercase()
        };
        let (left, right) = (text(spec, "left").to_uppercase(), text(spec, "right").to_uppercase());
        let mono = text::Font::Mono;
        let label_w = text::measure(mono, &label, 20.0, 2.4);
        let right_w = text::measure(mono, &right, 18.0, 2.2);
        let progress = global as f32 / self.0.frames.max(1) as f32;
        let rail_y = h - 46.0;
        let footer_y = rail_y - 16.0;
        let mut nodes = vec![];
        if !brand.is_empty() {
            // Inside title-safe (5% of the frame), like everything a viewer reads.
            nodes.push(fframes::svgr!(<text x={margin} y="100" font-family="Instrument Serif" font-style="italic" font-weight="400" font-size="44" fill={ink.clone()}>{brand}</text>));
        }
        if !label.is_empty() {
            nodes.push(fframes::svgr!(<text x={w - margin - label_w} y="74" font-family="IBM Plex Mono" font-weight="500" font-size="20" letter-spacing="2.4" fill={muted.clone()}>{label}</text>));
        }
        if !left.is_empty() {
            nodes.push(fframes::svgr!(<text x={margin} y={footer_y} font-family="IBM Plex Mono" font-weight="500" font-size="18" letter-spacing="2.2" fill={muted.clone()}>{left}</text>));
        }
        if !right.is_empty() {
            nodes.push(fframes::svgr!(<text x={w - margin - right_w} y={footer_y} font-family="IBM Plex Mono" font-weight="500" font-size="18" letter-spacing="2.2" fill={muted.clone()}>{right}</text>));
        }
        if spec.get("progress").and_then(Value::as_bool).unwrap_or(true) {
            let span = w - 2.0 * margin;
            nodes.push(fframes::svgr!(<rect x={margin} y={rail_y} width={span} height="2" fill={muted.clone()} opacity="0.35" />));
            if span * progress > 0.5 {
                nodes.push(fframes::svgr!(<rect x={margin} y={rail_y - 1.0} width={span * progress} height="4" fill={accent} />));
            }
        }
        fframes::svgr!(<g>{nodes}</g>)
    }
}

/// All supported canvases and rates are compiled once; content is supplied at runtime.
pub struct NativeFilm<const W: usize, const H: usize, const RATE: usize>(pub Film);
impl<const W: usize, const H: usize, const RATE: usize> Video for NativeFilm<W, H, RATE> {
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
        let env = &self.0.beats[0].environment;
        let palette = design::Palette::from_theme(&self.0.theme);
        let background = design::backdrop(
            &self.0.backdrop,
            env.width,
            env.height,
            &palette,
            frame.global_index as f32 / RATE as f32,
        );
        let rail =
            if self.0.chrome { frame.global_index as f32 / self.0.frames.max(1) as f32 * env.width } else { 0.0 };
        let progress = if rail > 0.0 {
            fframes::svgr!(<rect x="0" y="0" height="4" width={rail} fill={palette.accent.clone()} />)
        } else {
            fframes::svgr!(<g />)
        };
        let chrome = if self.0.chrome {
            fframes::svgr!(<g>
                <text x={env.width * 0.065} y="66" font-family="Inter" font-size="22" font-weight="400" fill={palette.muted.clone()}>{self.0.title.as_str()}</text>
                {progress}
            </g>)
        } else {
            fframes::svgr!(<g />)
        };
        let seconds = frame.global_index as f32 / RATE as f32;
        let (vignette, grain) = design::texture(&self.0.texture, env.width, env.height, &palette, seconds);
        let (w, h) = (env.width, env.height);
        // The lens of the beat on screen; letterbox bars ease between beats that differ.
        let i = self.0.beats.iter().rposition(|b| b.start_frame <= frame.global_index).unwrap_or(0);
        let beat = &self.0.beats[i];
        let mut lens = lens::Lens::from(&beat.lens);
        // Bloom lifts highlights out of a dark picture; on a light paper every pixel is a
        // highlight, and the bloom only bleeds the paper into the shapes and softens them.
        if !palette.dark {
            lens.bloom = 0.0;
        }
        let mut bar = lens::bar(lens.letterbox, w, h);
        if i > 0 {
            let before = lens::bar(lens::Lens::from(&self.0.beats[i - 1].lens).letterbox, w, h);
            let q = motion::in_out_cubic(motion::clamp01(
                (frame.global_index - beat.start_frame) as f32 / RATE as f32 / 0.7,
            ));
            bar = before + (bar - before) * q;
        }
        // A dissolve: the outgoing beat runs on under the incoming one while it fades up, so
        // two pictures share the screen (a fade dips through the backdrop instead).
        let local = frame.global_index - beat.start_frame;
        let span = ((0.7 * RATE as f32) as usize).min(beat.frames / 2).max(1);
        let scenes = if beat.transition == "dissolve" && i > 0 && local < span {
            let prev = &self.0.beats[i - 1];
            let q = motion::in_out_cubic((local as f32 + 1.0) / span as f32);
            // Its words clear in the first third of the dissolve; only the pictures cross.
            let words = (1.0 - (local as f32 + 1.0) / (span as f32 * 0.35)).clamp(0.0, 1.0);
            scenes::TEXT_ALPHA.with(|a| a.set(words));
            let behind = Scene::render_frame(prev, Frame::new(prev.frames + local, frame.global_index, RATE), ctx);
            scenes::TEXT_ALPHA.with(|a| a.set(1.0));
            fframes::svgr!(<g>{behind}<g opacity={q}>{ctx.render_scenes(&frame)}</g></g>)
        } else {
            ctx.render_scenes(&frame)
        };
        let picture = fframes::svgr!(<g>
            <rect width={w} height={h} fill={palette.bg.clone()} />
            {background}
            {vignette}
            {scenes}
            {chrome}
        </g>);
        let picture = match lens::handheld(lens.handheld, seconds, w, h) {
            Some(t) => fframes::svgr!(<g transform={t}>{picture}</g>),
            None => picture,
        };
        let picture = match lens::filter(&lens, w, h) {
            Some((id, defs)) => fframes::svgr!(<g>{defs}<g filter={format!("url(#{id})")}>{picture}</g></g>),
            None => picture,
        };
        fframes::svgr!(<svg xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={format!("0 0 {} {}",env.width,env.height)}>
            <rect width={w} height={h} fill={palette.bg.clone()} />
            {picture}
            {lens::leak(lens.leak, seconds, w, h, &palette)}
            {self.frame_chrome(env.width, env.height, frame.global_index)}
            {grain}
            {lens::letterbox(bar, w, h)}
            {if self.0.guides { design::guides(env.width, env.height) } else { fframes::svgr!(<g />) }}
        </svg>)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn job() -> Value {
        serde_json::json!({"version":2,"width":1920,"height":1080,"fps":30,"frames":60,
            "beats":[{"id":"a","block":"statement","frames":60,"start_frame":0,
                "cue_seconds":0,"props":{"text":"One useful point"}}]})
    }
    #[test]
    fn supported_canvases_and_rates_need_no_source_changes() {
        for (width, height) in [(1920, 1080), (1080, 1920), (1080, 1080), (1080, 1350), (640, 360)] {
            for fps in [24, 25, 30, 50, 60] {
                let mut value = job();
                value["width"] = width.into();
                value["height"] = height.into();
                value["fps"] = fps.into();
                let film = Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap();
                assert_eq!(
                    film.beats[0].environment.width / film.beats[0].environment.height,
                    width as f32 / height as f32
                );
            }
        }
    }
    #[test]
    fn inconsistent_frame_ranges_are_rejected() {
        let mut value = job();
        value["beats"][0]["start_frame"] = 1.into();
        assert!(Film::from_json(&serde_json::to_vec(&value).unwrap()).is_err());
    }
    #[test]
    fn kinetic_requires_nonoverlapping_timed_words() {
        let mut value = job();
        value["beats"][0]["block"] = "kinetic".into();
        assert!(Film::from_json(&serde_json::to_vec(&value).unwrap()).is_err());
        value["beats"][0]["words"] = serde_json::json!([
            {"text":"One","start":0.0,"end":0.4},{"text":"point","start":0.3,"end":0.8}]);
        assert!(Film::from_json(&serde_json::to_vec(&value).unwrap()).is_err());
        value["beats"][0]["words"][1]["start"] = 0.4.into();
        assert!(Film::from_json(&serde_json::to_vec(&value).unwrap()).is_ok());
    }
    #[test]
    fn timeline_renders_time_labels_titles_and_sources_together() {
        let mut value = job();
        value["beats"][0]["block"] = "timeline".into();
        value["beats"][0]["props"] = serde_json::json!({"source":"Service log","items":[
            {"label":"09:10","title":"Detected","detail":"Alert received","at":0.0},
            {"label":"09:18","title":"Contained","detail":"Traffic rerouted","at":0.2}]});
        let film = Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap();
        let ctx = FFramesContext {
            time_base: fframes::TimeBase { fps: 30, sample_rate: 48000 },
            current_video_size: fframes::VideoSize { width: 1920, height: 1080 },
            duration_in_frames: 60,
            mode: fframes::FFramesMode::Renderer,
            scenes: None,
            media_source: None,
            font_source: None,
            abort_signal: None,
        };
        let scene = film.beats[0].render_frame(Frame::new(30, 30, 30), &ctx);
        let tree = format!("{scene:?}");
        for text in ["09:10", "Detected", "09:18", "Contained", "Service log"] {
            assert!(tree.contains(text), "missing {text}");
        }
    }
    #[test]
    fn chrome_keeps_film_title_and_progress_without_a_scene_counter() {
        let mut value = job();
        value["title"] = "A field notebook".into();
        value["chrome"] = true.into();
        let film = NativeFilm::<1920, 1080, 30>(Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap());
        let ctx = FFramesContext {
            time_base: fframes::TimeBase { fps: 30, sample_rate: 48000 },
            current_video_size: fframes::VideoSize { width: 1920, height: 1080 },
            duration_in_frames: 60,
            mode: fframes::FFramesMode::Renderer,
            scenes: None,
            media_source: None,
            font_source: None,
            abort_signal: None,
        };
        let frame = format!("{:?}", film.render_frame(Frame::new(30, 30, 30), &ctx));
        assert!(frame.contains("A field notebook"));
        assert!(frame.contains("960"), "halfway progress rail must remain");
        assert!(!frame.contains("01 / 01"), "normal chrome must not show scene fractions");
        assert!(!frame.contains("text-anchor"), "the former right-aligned counter must be absent");
    }
    #[test]
    fn diagrams_render_labels_icons_support_and_captions_and_seek_deterministically() {
        let examples = [
            (
                "icon-grid",
                serde_json::json!({"items":[
                {"icon":"book-open","label":"Read","detail":"Keep a field notebook"},
                {"icon":"leaf","label":"Observe","detail":"Look for new growth","at":1.2}]}),
            ),
            (
                "flow",
                serde_json::json!({"nodes":[
                {"icon":"utensils","label":"Prepare","detail":"Lay out the ingredients"},
                {"icon":"chef-hat","label":"Cook","detail":"Follow the recipe","at":1.2}]}),
            ),
            (
                "cycle",
                serde_json::json!({"nodes":[
                {"icon":"sun","label":"Warmth"},{"icon":"cloud-rain","label":"Rain"},
                {"icon":"sprout","label":"Growth"}],"period":4}),
            ),
            (
                "breathing",
                serde_json::json!({"phases":[
                {"label":"Expand","seconds":2,"scale":"expand"},
                {"label":"Contract","seconds":2,"scale":"contract"}]}),
            ),
        ];
        for (width, height) in [(1920, 1080), (1080, 1920), (1080, 1350), (1080, 1080)] {
            for (block, props) in &examples {
                let mut value = job();
                value["width"] = width.into();
                value["height"] = height.into();
                value["frames"] = 240.into();
                value["captions"] = true.into();
                value["beats"][0]["block"] = (*block).into();
                value["beats"][0]["frames"] = 240.into();
                value["beats"][0]["props"] = props.clone();
                value["beats"][0]["props"]["source"] = "Illustrative diagram".into();
                value["beats"][0]["props"]["support"] = "One clear explanation".into();
                value["beats"][0]["captions"] =
                    serde_json::json!([{"start":0,"end":8,"text":"Narration stays readable"}]);
                let film = Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap();
                let ctx = FFramesContext {
                    time_base: fframes::TimeBase { fps: 30, sample_rate: 48000 },
                    current_video_size: fframes::VideoSize { width, height },
                    duration_in_frames: 240,
                    mode: fframes::FFramesMode::Renderer,
                    scenes: None,
                    media_source: None,
                    font_source: None,
                    abort_signal: None,
                };
                let render = |index| format!("{:?}", film.beats[0].render_frame(Frame::new(index, index, 30), &ctx));
                let first = render(30);
                let later = render(72);
                assert_ne!(first, later, "{block} must animate");
                assert_eq!(first, render(30), "{block} must reproduce earlier seeks");
                for text in ["Illustrative diagram", "One clear explanation", "Narration stays readable"] {
                    assert!(first.contains(text), "{block} {width}x{height} omitted {text}");
                }
                if *block == "breathing" {
                    assert!(first.contains("Expand"));
                    assert!(later.contains("Contract"));
                } else {
                    // Items not yet cued are omitted, not drawn invisibly; all have arrived later.
                    for entry in props.get("items").or_else(|| props.get("nodes")).unwrap().as_array().unwrap() {
                        assert!(
                            later.contains(entry["label"].as_str().unwrap()),
                            "{block} {width}x{height} omitted a label"
                        );
                    }
                    assert!(first.contains("path"), "{block} must contain native icon geometry");
                }
            }
        }
    }
    #[test]
    fn diagram_jobs_reject_unknown_icons_and_invalid_phase_durations() {
        let mut value = job();
        value["beats"][0]["block"] = "icon-grid".into();
        value["beats"][0]["props"] = serde_json::json!({"items":[{"icon":"untrusted.svg","label":"A"}]});
        assert!(Film::from_json(&serde_json::to_vec(&value).unwrap()).is_err());
        value["beats"][0]["block"] = "breathing".into();
        value["beats"][0]["props"] =
            serde_json::json!({"phases":[{"label":"In","seconds":0},{"label":"Out","seconds":2}]});
        assert!(Film::from_json(&serde_json::to_vec(&value).unwrap()).is_err());
        value["beats"][0]["props"]["phases"][0]["seconds"] = 2.into();
        assert!(Film::from_json(&serde_json::to_vec(&value).unwrap()).is_ok());
    }
    #[test]
    fn unfit_cycle_labels_fail_with_scene_context_instead_of_overlapping() {
        for label in ["A\nB\nC\nD\nE\nF".to_owned(), "W".repeat(40)] {
            let mut value = job();
            value["beats"][0]["id"] = "garden-cycle".into();
            value["beats"][0]["block"] = "cycle".into();
            value["beats"][0]["props"] = serde_json::json!({"nodes":[
                {"icon":"sun","label":label},{"icon":"cloud-rain","label":"Rain"},{"icon":"sprout","label":"Growth"}]});
            let film = Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap();
            let ctx = FFramesContext {
                time_base: fframes::TimeBase { fps: 30, sample_rate: 48000 },
                current_video_size: fframes::VideoSize { width: 1920, height: 1080 },
                duration_in_frames: 60,
                mode: fframes::FFramesMode::Renderer,
                scenes: None,
                media_source: None,
                font_source: None,
                abort_signal: None,
            };
            let failure = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                let _ = film.beats[0].render_frame(Frame::new(30, 30, 30), &ctx);
            }))
            .expect_err("an unfit label must fail rendering");
            let message = failure
                .downcast_ref::<String>()
                .map(String::as_str)
                .or_else(|| failure.downcast_ref::<&str>().copied())
                .unwrap_or("");
            for required in ["Text overflow", "garden-cycle", "cycle", "Shorten or reflow", "14px"] {
                assert!(message.contains(required), "missing diagnostic context {required}: {message}");
            }
        }
    }
    #[test]
    fn kinetic_renders_stable_phrases_across_silence_and_backward_seeks() {
        let mut value = job();
        value["frames"] = 120.into();
        value["beats"][0]["block"] = "kinetic".into();
        value["beats"][0]["frames"] = 120.into();
        value["beats"][0]["props"] = serde_json::json!({"maxWords":7,"maxGap":0.6,"maxDuration":4});
        value["beats"][0]["words"] = serde_json::json!([
            {"text":"Look","start":0,"end":0.4},{"text":"closely","start":0.5,"end":0.9},
            {"text":"Then","start":2,"end":2.3},{"text":"begin","start":2.4,"end":2.8}]);
        let film = Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap();
        let ctx = FFramesContext {
            time_base: fframes::TimeBase { fps: 30, sample_rate: 48000 },
            current_video_size: fframes::VideoSize { width: 1920, height: 1080 },
            duration_in_frames: 120,
            mode: fframes::FFramesMode::Renderer,
            scenes: None,
            media_source: None,
            font_source: None,
            abort_signal: None,
        };
        let render = |index| format!("{:?}", film.beats[0].render_frame(Frame::new(index, index, 30), &ctx));
        let first = render(6);
        assert!(first.contains("Look") && first.contains("closely") && !first.contains("Then"));
        let next = render(60);
        assert!(next.contains("Then") && next.contains("begin") && !next.contains("Look"));
        assert_eq!(first, render(6));
    }
    #[test]
    fn exits_wait_for_values_to_settle_and_numerals_lead_with_the_sign() {
        let mut value = job();
        value["beats"][0]["block"] = "stat".into();
        value["beats"][0]["exit"] = "fade".into();
        value["beats"][0]["props"] = serde_json::json!({"value":-3,"prefix":"$","label":"Change"});
        value["beats"][0]["settle_seconds"] = 1.96.into();
        let render = |settle: f64| {
            let mut v = value.clone();
            v["beats"][0]["settle_seconds"] = settle.into();
            let film = Film::from_json(&serde_json::to_vec(&v).unwrap()).unwrap();
            let ctx = FFramesContext {
                time_base: fframes::TimeBase { fps: 30, sample_rate: 48000 },
                current_video_size: fframes::VideoSize { width: 1920, height: 1080 },
                duration_in_frames: 60,
                mode: fframes::FFramesMode::Renderer,
                scenes: None,
                media_source: None,
                font_source: None,
                abort_signal: None,
            };
            let frame = format!("{:?}", film.beats[0].render_frame(Frame::new(58, 58, 30), &ctx));
            frame
        };
        let frame = render(1.96);
        assert_ne!(frame, render(0.0), "without a settle time the exit is already running at frame 58");
        assert_eq!(frame, render(1.99), "with values settling at the cut there is no exit to draw");
        let (sign, dollar) = (frame.find("\"−\"").expect("sign"), frame.find("\"$\"").expect("prefix"));
        assert!(sign < dollar, "the sign precedes the prefix, as in format_number");
        value["beats"][0]["settle_seconds"] = (-1.0).into();
        assert!(Film::from_json(&serde_json::to_vec(&value).unwrap()).is_err());
    }
    #[test]
    fn graphic_transitions_keep_the_film_accent_across_a_cut_into_a_toned_scene() {
        let noir = design::tests::library_palette("noir");
        let value = serde_json::json!({"version":2,"width":1920,"height":1080,"fps":30,"frames":120,"theme":noir,
            "beats":[
                {"id":"a","block":"statement","frames":60,"start_frame":0,"cue_seconds":0,"exit":"panel","props":{"text":"Before"}},
                {"id":"b","block":"statement","frames":60,"start_frame":60,"cue_seconds":0,"transition":"panel","tone":"accent","props":{"text":"After"}}]});
        let film = Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap();
        let ctx = FFramesContext {
            time_base: fframes::TimeBase { fps: 30, sample_rate: 48000 },
            current_video_size: fframes::VideoSize { width: 1920, height: 1080 },
            duration_in_frames: 120,
            mode: fframes::FFramesMode::Renderer,
            scenes: None,
            media_source: None,
            font_source: None,
            abort_signal: None,
        };
        let accent = "#e9c46a";
        let leaving = format!("{:?}", film.beats[0].render_frame(Frame::new(59, 59, 30), &ctx));
        let arriving = format!("{:?}", film.beats[1].render_frame(Frame::new(0, 60, 30), &ctx));
        assert!(leaving.contains(accent), "outgoing cover uses the film accent");
        assert!(arriving.contains(accent), "incoming reveal uses the same accent, not the toned scene's");
        let toned = design::Palette::from_theme(&noir).toned("accent");
        assert_eq!(toned.bg, accent);
        assert_ne!(toned.accent, accent, "the toned scene re-derives a readable accent");
    }
    #[test]
    fn magnitude_fits_long_values_on_a_vertical_canvas() {
        let mut value = job();
        value["width"] = 1080.into();
        value["height"] = 1920.into();
        value["beats"][0]["block"] = "magnitude".into();
        value["beats"][0]["props"] = serde_json::json!({"format":{"suffix":" people"},"items":[
            {"label":"A team","value":12},{"label":"A company","value":1200},{"label":"A city","value":90000},{"label":"A country","value":8000000}]});
        let film = Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap();
        let ctx = FFramesContext {
            time_base: fframes::TimeBase { fps: 30, sample_rate: 48000 },
            current_video_size: fframes::VideoSize { width: 1080, height: 1920 },
            duration_in_frames: 60,
            mode: fframes::FFramesMode::Renderer,
            scenes: None,
            media_source: None,
            font_source: None,
            abort_signal: None,
        };
        let frame = format!("{:?}", film.beats[0].render_frame(Frame::new(59, 59, 30), &ctx));
        assert!(frame.contains("8,000,000 people"));
    }
    #[test]
    fn word_mode_holds_through_short_pauses_and_clears_in_silence() {
        let mut value = job();
        value["frames"] = 90.into();
        value["beats"][0]["block"] = "kinetic".into();
        value["beats"][0]["frames"] = 90.into();
        value["beats"][0]["props"] = serde_json::json!({"mode":"word","maxGap":0.6});
        value["beats"][0]["words"] =
            serde_json::json!([{"text":"Look","start":0,"end":0.4},{"text":"closely","start":0.5,"end":0.9}]);
        let film = Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap();
        let ctx = FFramesContext {
            time_base: fframes::TimeBase { fps: 30, sample_rate: 48000 },
            current_video_size: fframes::VideoSize { width: 1920, height: 1080 },
            duration_in_frames: 90,
            mode: fframes::FFramesMode::Renderer,
            scenes: None,
            media_source: None,
            font_source: None,
            abort_signal: None,
        };
        let render = |index| format!("{:?}", film.beats[0].render_frame(Frame::new(index, index, 30), &ctx));
        assert!(render(13).contains("Look"), "held across the 0.1s gap");
        assert!(render(42).contains("closely"), "held 0.5s after the last word");
        assert!(!render(48).contains("closely"), "cleared after maxGap of silence");
    }
    #[test]
    fn video_decoder_drains_exact_last_b_frame_and_survives_backward_seeks() {
        use fframes::FFramesSyncedVideoFrame;
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/bframes.mp4");
        unsafe {
            let mut decoder = fframes::media::FFmpegDecoder::new(&path, 30, 2).unwrap();
            assert!(decoder.decode_up_to(118).unwrap());
            let previous = decoder.get_raw_frame().into_image().href();
            assert!(decoder.decode_up_to(119).unwrap(), "last delayed B-frame must drain");
            let final_frame = decoder.get_raw_frame();
            assert!((final_frame.timestamp_seconds() - 119.0 / 30.0).abs() < 0.0001);
            let final_pixels = final_frame.into_image().href();
            assert_ne!(previous.data, final_pixels.data, "must decode the final sample, not freeze frame118");
            assert!(decoder.decode_up_to(119).unwrap());
            assert!(!decoder.decode_up_to(120).unwrap(), "the first frame beyond the clip must remain absent");
            assert!(decoder.decode_up_to(30).unwrap());
            assert!((decoder.get_raw_frame().timestamp_seconds() - 1.0).abs() < 0.0001);
            assert!(decoder.decode_up_to(119).unwrap());
            assert_eq!(final_pixels.data, decoder.get_raw_frame().into_image().href().data);
        }
    }
    #[test]
    fn video_decoder_preserves_the_final_sample_interval_at_a_higher_output_rate() {
        use fframes::FFramesSyncedVideoFrame;
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/bframes.mp4");
        unsafe {
            // Existing fixture: 120 frames at 30 fps. Output: 240 at 60 fps.
            let mut decoder = fframes::media::FFmpegDecoder::new(&path, 60, 2).unwrap();
            assert!(decoder.decode_up_to(236).unwrap());
            let previous = decoder.get_raw_frame().into_image().href();
            assert!(decoder.decode_up_to(238).unwrap());
            let final_pixels = decoder.get_raw_frame().into_image().href();
            assert_ne!(previous.data, final_pixels.data);
            for _ in 0..2 {
                assert!(decoder.decode_up_to(239).unwrap(), "final source sample is still present at 239/60 seconds");
                assert!((decoder.get_raw_frame().timestamp_seconds() - 119.0 / 30.0).abs() < 0.0001);
                assert_eq!(final_pixels.data, decoder.get_raw_frame().into_image().href().data);
            }
            for _ in 0..2 {
                assert!(!decoder.decode_up_to(240).unwrap(), "stream end remains exclusive");
            }
            assert!(!decoder.decode_up_to(600).unwrap(), "a far request beyond stream end does not seek");
            assert!(decoder.decode_up_to(60).unwrap());
            assert!((decoder.get_raw_frame().timestamp_seconds() - 1.0).abs() < 0.0001);
            assert!(decoder.decode_up_to(239).unwrap(), "a direct seek into the final interval also decodes it");
            assert_eq!(final_pixels.data, decoder.get_raw_frame().into_image().href().data);
        }
    }
    #[test]
    fn video_decoder_preserves_the_final_sample_when_output_duration_is_not_integral() {
        use fframes::FFramesSyncedVideoFrame;
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures/bframes-49-at-24fps.mp4");
        unsafe {
            // 49/24 seconds is 61.25 output frames at 30 fps. Rounding that
            // duration to 61 must not discard the valid sample at 61/30.
            let mut decoder = fframes::media::FFmpegDecoder::new(&path, 30, 1).unwrap();
            assert!(decoder.decode_up_to(60).unwrap());
            assert!((decoder.get_raw_frame().timestamp_seconds() - 2.0).abs() < 0.0001);
            let final_pixels = decoder.get_raw_frame().into_image().href();
            for _ in 0..2 {
                assert!(decoder.decode_up_to(61).unwrap(), "61/30 seconds precedes the exact stream end at 49/24");
                assert!((decoder.get_raw_frame().timestamp_seconds() - 2.0).abs() < 0.0001);
                assert_eq!(final_pixels.data, decoder.get_raw_frame().into_image().href().data);
            }
            for _ in 0..2 {
                assert!(!decoder.decode_up_to(62).unwrap(), "62/30 seconds is beyond the exact stream end");
            }
            assert!(decoder.decode_up_to(30).unwrap(), "backward seek after EOF must remain supported");
            assert!((decoder.get_raw_frame().timestamp_seconds() - 1.0).abs() < 0.0001);
            for _ in 0..2 {
                assert!(decoder.decode_up_to(61).unwrap(), "seeking directly into the final interval must decode it");
                assert!((decoder.get_raw_frame().timestamp_seconds() - 2.0).abs() < 0.0001);
                assert_eq!(final_pixels.data, decoder.get_raw_frame().into_image().href().data);
            }
            assert!(!decoder.decode_up_to(62).unwrap());
        }
    }
}
