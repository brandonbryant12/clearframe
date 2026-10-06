//! The blocks: each beat of the prepared job (`job.json`) drawn as a display list
//! (`crate::draw::Node`) from its props, timing and palette. No authoring code runs per job;
//! every frame is a pure function of the job, the staged media and the frame number.
use crate::draw::Node;
use crate::media::Media;
use crate::{motion, text};
use serde::Deserialize;
use serde_json::Value;
use std::cell::RefCell;

mod scenes;

/// A beat's frame: `index` within the beat, `global_index` within the film.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
    pub index: usize,
    pub global_index: usize,
    pub fps: usize,
}
impl Frame {
    pub fn new(index: usize, global_index: usize, fps: usize) -> Self {
        Frame { index, global_index, fps }
    }
    /// Beat-local seconds.
    pub fn seconds(&self) -> f32 {
        self.index as f32 / self.fps as f32
    }
}

/// What a block reads besides its beat: staged media, and how many output pixels one job
/// unit covers (footage is decoded no larger than it is drawn).
pub struct Ctx {
    pub media: RefCell<Media>,
    pub scale: f32,
}

/// Draw beat `beat` of `film` at its own frame `local` (film frame `global`). `alpha` is the
/// opacity of its words (below 1 for the outgoing beat of a dissolve, whose words clear before
/// the pictures cross); `part` 0 draws everything, 1 only its ground (tone and plate), 2 all
/// but its ground, so native layers can sit between the two.
pub fn draw_beat(film: &Film, beat: usize, local: usize, global: usize, ctx: &Ctx, alpha: f32, part: u8) -> Node {
    let b = &film.beats[beat];
    scenes::PART.with(|p| p.set(part));
    scenes::TEXT_ALPHA.with(|a| a.set(alpha));
    let node = scenes::render(b, Frame::new(local, global, film.fps), ctx);
    scenes::PART.with(|p| p.set(0));
    scenes::TEXT_ALPHA.with(|a| a.set(1.0));
    node
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

#[cfg(test)]
mod tests {
    use super::*;
    fn ctx() -> Ctx {
        Ctx { media: RefCell::new(Media::new(std::path::Path::new("."), 30)), scale: 1.0 }
    }
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
        let scene = draw_beat(&film, 0, 30, 30, &ctx(), 1.0, 0);
        let tree = format!("{scene:?}");
        for text in ["09:10", "Detected", "09:18", "Contained", "Service log"] {
            assert!(tree.contains(text), "missing {text}");
        }
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
                let render = |index| format!("{:?}", draw_beat(&film, 0, index, index, &ctx(), 1.0, 0));
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
            let failure = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                let _ = draw_beat(&film, 0, 30, 30, &ctx(), 1.0, 0);
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
        let render = |index| format!("{:?}", draw_beat(&film, 0, index, index, &ctx(), 1.0, 0));
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
            let frame = format!("{:?}", draw_beat(&film, 0, 58, 58, &ctx(), 1.0, 0));
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
        let noir = crate::design::tests::library_palette("noir");
        let value = serde_json::json!({"version":2,"width":1920,"height":1080,"fps":30,"frames":120,"theme":noir,
            "beats":[
                {"id":"a","block":"statement","frames":60,"start_frame":0,"cue_seconds":0,"exit":"panel","props":{"text":"Before"}},
                {"id":"b","block":"statement","frames":60,"start_frame":60,"cue_seconds":0,"transition":"panel","tone":"accent","props":{"text":"After"}}]});
        let film = Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap();
        let accent = "#e9c46a";
        let leaving = format!("{:?}", draw_beat(&film, 0, 59, 59, &ctx(), 1.0, 0));
        let arriving = format!("{:?}", draw_beat(&film, 1, 0, 60, &ctx(), 1.0, 0));
        assert!(leaving.contains(accent), "outgoing cover uses the film accent");
        assert!(arriving.contains(accent), "incoming reveal uses the same accent, not the toned scene's");
        let toned = crate::design::Palette::from_theme(&noir).toned("accent");
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
        let frame = format!("{:?}", draw_beat(&film, 0, 59, 59, &ctx(), 1.0, 0));
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
        let render = |index| format!("{:?}", draw_beat(&film, 0, index, index, &ctx(), 1.0, 0));
        assert!(render(13).contains("Look"), "held across the 0.1s gap");
        assert!(render(42).contains("closely"), "held 0.5s after the last word");
        assert!(!render(48).contains("closely"), "cleared after maxGap of silence");
    }
}
