//! ClearFrame's content-driven native renderer. No authoring code runs per job.
use fframes::{AudioMap, Duration, FFramesContext, Frame, Scene, Scenes, Svgr, Video};
use serde::Deserialize;
use serde_json::Value;

mod design;
mod icons;
mod motion;
mod scenes;
pub mod text;
pub use scenes::{format_number, zero_scale};

pub const BLOCKS: &[&str] = &[
    "title", "statement", "stat", "kpis", "bars", "line", "waffle", "ring", "delta",
    "compare", "steps", "timeline", "funnel", "quote", "list", "matrix", "equation",
    "callout", "endcard", "image", "video", "kinetic", "icon-grid", "flow", "cycle", "breathing",
    "chapter", "highlight", "donut", "magnitude", "checklist", "annotate",
];

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
    fn default() -> Self { Self { preset: "gentle".into(), intensity: 0.6 } }
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
}

#[derive(Debug, Deserialize)]
pub struct Beat {
    pub id: String,
    pub block: String,
    pub frames: usize,
    pub start_frame: usize,
    pub cue_seconds: f32,
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
    #[serde(skip)]
    pub environment: Environment,
}
fn cut() -> String { "cut".into() }
fn none() -> String { "none".into() }
fn paper() -> Value { Value::String("paper".into()) }

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
    pub beats: Vec<Beat>,
}

impl Film {
    pub fn read(file: &str) -> Result<Self, Box<dyn std::error::Error>> {
        Self::from_json(&std::fs::read(file)?)
    }

    pub fn from_json(bytes: &[u8]) -> Result<Self, Box<dyn std::error::Error>> {
        let mut film: Self = serde_json::from_slice(bytes)?;
        if film.version != 2 || film.beats.is_empty()
            || ![(1920,1080),(1080,1920),(1080,1080),(1080,1350),(640,360)].contains(&(film.width,film.height))
            || ![24,25,30,50,60].contains(&film.fps)
        { return Err("job requires version 2, a supported canvas, and 24/25/30/50/60 fps".into()); }
        let scale = 1080.0 / film.width.min(film.height) as f32;
        let total = film.beats.len();
        let mut offset = 0;
        for (index, beat) in film.beats.iter_mut().enumerate() {
            if !BLOCKS.contains(&beat.block.as_str()) || beat.frames == 0 || beat.start_frame != offset
                || !beat.cue_seconds.is_finite() || beat.cue_seconds < 0.0
                || !beat.props.is_object()
                || !["cut","fade","rise","wipe","push","zoom"].contains(&beat.transition.as_str())
                || motion::ExitKind::parse(&beat.exit).is_none()
                || !beat.settle_seconds.is_finite() || beat.settle_seconds < 0.0
            { return Err(format!("invalid native scene {}", beat.id).into()); }
            let duration = beat.frames as f32 / film.fps as f32;
            for cues in [&beat.captions, &beat.words] {
                let mut previous_end = 0.0;
                for cue in cues {
                    if !cue.start.is_finite() || !cue.end.is_finite() || cue.start < previous_end
                        || cue.end <= cue.start || cue.end > duration + 0.001 || cue.text.trim().is_empty()
                    { return Err(format!("invalid or overlapping cues in {}", beat.id).into()); }
                    previous_end = cue.end;
                }
            }
            if beat.block == "kinetic" && beat.words.is_empty() {
                return Err(format!("kinetic scene {} requires timed words", beat.id).into());
            }
            scenes::validate_diagram(&beat.block, &beat.props)
                .map_err(|message| format!("invalid native scene {}: {message}", beat.id))?;
            let motion = beat.motion.clone().unwrap_or_else(|| film.motion.clone());
            if !["gentle","snappy","spring"].contains(&motion.preset.as_str()) || !motion.intensity.is_finite()
                || !(0.0..=1.0).contains(&motion.intensity) {
                return Err("motion must use gentle/snappy/spring and intensity 0..1".into());
            }
            beat.environment = Environment {
                width: film.width as f32 * scale, height: film.height as f32 * scale,
                theme: film.theme.clone(), motion, captions: film.captions, index, total,
            };
            offset += beat.frames;
        }
        if offset != film.frames { return Err("job frame total does not match scenes".into()); }
        Ok(film)
    }
}

impl Scene for Beat {
    fn duration(&self) -> Duration<'_> { Duration::Frames(self.frames) }
    fn render_frame<'a>(&'a self, frame: Frame, ctx: &FFramesContext<'a, '_>) -> Svgr<'a> {
        scenes::render(self, frame, ctx)
    }
}

/// All supported canvases and rates are compiled once; content is supplied at runtime.
pub struct NativeFilm<const W: usize, const H: usize, const RATE: usize>(pub Film);
impl<const W: usize, const H: usize, const RATE: usize> Video for NativeFilm<W,H,RATE> {
    const WIDTH: usize = W;
    const HEIGHT: usize = H;
    const FPS: usize = RATE;
    fn duration(&self) -> Duration<'_> { Duration::Auto }
    fn audio(&self) -> AudioMap<'_> { AudioMap::none() }
    fn define_scenes(&self) -> Scenes<'_> {
        Scenes::from(self.0.beats.iter().map(|b| b as &dyn Scene).collect::<Vec<_>>())
    }
    fn render_frame<'a>(&'a self, frame: Frame, ctx: &FFramesContext<'a, '_>) -> Svgr<'a> {
        let env = &self.0.beats[0].environment;
        let palette = design::Palette::from_theme(&self.0.theme);
        let background = design::backdrop(&self.0.backdrop, env.width, env.height, &palette, frame.global_index as f32 / RATE as f32);
        let rail = if self.0.chrome { frame.global_index as f32 / self.0.frames.max(1) as f32 * env.width } else { 0.0 };
        let progress = if rail>0.0 { fframes::svgr!(<rect x="0" y="0" height="4" width={rail} fill={palette.accent.clone()} />) } else { fframes::svgr!(<g />) };
        let chrome = if self.0.chrome {
            fframes::svgr!(<g>
                <text x={env.width * 0.065} y="66" font-family="Inter" font-size="22" font-weight="400" fill={palette.muted.clone()}>{self.0.title.as_str()}</text>
                {progress}
            </g>)
        } else { fframes::svgr!(<g />) };
        fframes::svgr!(<svg xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={format!("0 0 {} {}",env.width,env.height)}>
            <rect width={env.width} height={env.height} fill={palette.bg.clone()} />
            {background}
            {ctx.render_scenes(&frame)}
            {chrome}
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
    #[test] fn supported_canvases_and_rates_need_no_source_changes() {
        for (width,height) in [(1920,1080),(1080,1920),(1080,1080),(1080,1350),(640,360)] {
            for fps in [24,25,30,50,60] {
                let mut value=job();value["width"]=width.into();value["height"]=height.into();value["fps"]=fps.into();
                let film=Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap();
                assert_eq!(film.beats[0].environment.width / film.beats[0].environment.height,width as f32/height as f32);
            }
        }
    }
    #[test] fn inconsistent_frame_ranges_are_rejected() {
        let mut value=job();value["beats"][0]["start_frame"]=1.into();
        assert!(Film::from_json(&serde_json::to_vec(&value).unwrap()).is_err());
    }
    #[test] fn kinetic_requires_nonoverlapping_timed_words() {
        let mut value=job();value["beats"][0]["block"]="kinetic".into();
        assert!(Film::from_json(&serde_json::to_vec(&value).unwrap()).is_err());
        value["beats"][0]["words"]=serde_json::json!([
            {"text":"One","start":0.0,"end":0.4},{"text":"point","start":0.3,"end":0.8}]);
        assert!(Film::from_json(&serde_json::to_vec(&value).unwrap()).is_err());
        value["beats"][0]["words"][1]["start"]=0.4.into();
        assert!(Film::from_json(&serde_json::to_vec(&value).unwrap()).is_ok());
    }
    #[test] fn timeline_renders_time_labels_titles_and_sources_together() {
        let mut value=job();value["beats"][0]["block"]="timeline".into();
        value["beats"][0]["props"]=serde_json::json!({"source":"Service log","items":[
            {"label":"09:10","title":"Detected","detail":"Alert received","at":0.0},
            {"label":"09:18","title":"Contained","detail":"Traffic rerouted","at":0.2}]});
        let film=Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap();
        let ctx=FFramesContext{time_base:fframes::TimeBase{fps:30,sample_rate:48000},
            current_video_size:fframes::VideoSize{width:1920,height:1080},duration_in_frames:60,
            mode:fframes::FFramesMode::Renderer,scenes:None,media_source:None,font_source:None,abort_signal:None};
        let scene=film.beats[0].render_frame(Frame::new(30,30,30),&ctx);
        let tree=format!("{scene:?}");
        for text in ["09:10","Detected","09:18","Contained","Service log"] {assert!(tree.contains(text),"missing {text}");}
    }
    #[test] fn chrome_keeps_film_title_and_progress_without_a_scene_counter() {
        let mut value = job();
        value["title"] = "A field notebook".into();
        value["chrome"] = true.into();
        let film = NativeFilm::<1920,1080,30>(Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap());
        let ctx = FFramesContext { time_base: fframes::TimeBase { fps:30, sample_rate:48000 },
            current_video_size: fframes::VideoSize { width:1920, height:1080 }, duration_in_frames:60,
            mode:fframes::FFramesMode::Renderer, scenes:None, media_source:None, font_source:None, abort_signal:None };
        let frame = format!("{:?}", film.render_frame(Frame::new(30,30,30), &ctx));
        assert!(frame.contains("A field notebook"));
        assert!(frame.contains("960"), "halfway progress rail must remain");
        assert!(!frame.contains("01 / 01"), "normal chrome must not show scene fractions");
        assert!(!frame.contains("text-anchor"), "the former right-aligned counter must be absent");
    }
    #[test] fn diagrams_render_labels_icons_support_and_captions_and_seek_deterministically() {
        let examples = [
            ("icon-grid", serde_json::json!({"items":[
                {"icon":"book-open","label":"Read","detail":"Keep a field notebook"},
                {"icon":"leaf","label":"Observe","detail":"Look for new growth","at":1.2}]})),
            ("flow", serde_json::json!({"nodes":[
                {"icon":"utensils","label":"Prepare","detail":"Lay out the ingredients"},
                {"icon":"chef-hat","label":"Cook","detail":"Follow the recipe","at":1.2}]})),
            ("cycle", serde_json::json!({"nodes":[
                {"icon":"sun","label":"Warmth"},{"icon":"cloud-rain","label":"Rain"},
                {"icon":"sprout","label":"Growth"}],"period":4})),
            ("breathing", serde_json::json!({"phases":[
                {"label":"Expand","seconds":2,"scale":"expand"},
                {"label":"Contract","seconds":2,"scale":"contract"}]})),
        ];
        for (width,height) in [(1920,1080),(1080,1920),(1080,1350),(1080,1080)] {
            for (block, props) in &examples {
                let mut value = job();
                value["width"] = width.into(); value["height"] = height.into();
                value["frames"] = 240.into(); value["captions"] = true.into();
                value["beats"][0]["block"] = (*block).into(); value["beats"][0]["frames"] = 240.into();
                value["beats"][0]["props"] = props.clone();
                value["beats"][0]["props"]["source"] = "Illustrative diagram".into();
                value["beats"][0]["props"]["support"] = "One clear explanation".into();
                value["beats"][0]["captions"] = serde_json::json!([{"start":0,"end":8,"text":"Narration stays readable"}]);
                let film = Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap();
                let ctx = FFramesContext { time_base: fframes::TimeBase { fps:30, sample_rate:48000 },
                    current_video_size: fframes::VideoSize { width, height }, duration_in_frames:240,
                    mode:fframes::FFramesMode::Renderer, scenes:None, media_source:None, font_source:None, abort_signal:None };
                let render = |index| format!("{:?}", film.beats[0].render_frame(Frame::new(index,index,30), &ctx));
                let first = render(30);
                let later = render(72);
                assert_ne!(first, later, "{block} must animate");
                assert_eq!(first, render(30), "{block} must reproduce earlier seeks");
                for text in ["Illustrative diagram","One clear explanation","Narration stays readable"] {
                    assert!(first.contains(text), "{block} {width}x{height} omitted {text}");
                }
                if *block == "breathing" {
                    assert!(first.contains("Expand")); assert!(later.contains("Contract"));
                } else {
                    // Items not yet cued are omitted, not drawn invisibly; all have arrived later.
                    for entry in props.get("items").or_else(|| props.get("nodes")).unwrap().as_array().unwrap() {
                        assert!(later.contains(entry["label"].as_str().unwrap()), "{block} {width}x{height} omitted a label");
                    }
                    assert!(first.contains("path"), "{block} must contain native icon geometry");
                }
            }
        }
    }
    #[test] fn diagram_jobs_reject_unknown_icons_and_invalid_phase_durations() {
        let mut value = job(); value["beats"][0]["block"] = "icon-grid".into();
        value["beats"][0]["props"] = serde_json::json!({"items":[{"icon":"untrusted.svg","label":"A"}]});
        assert!(Film::from_json(&serde_json::to_vec(&value).unwrap()).is_err());
        value["beats"][0]["block"] = "breathing".into();
        value["beats"][0]["props"] = serde_json::json!({"phases":[{"label":"In","seconds":0},{"label":"Out","seconds":2}]});
        assert!(Film::from_json(&serde_json::to_vec(&value).unwrap()).is_err());
        value["beats"][0]["props"]["phases"][0]["seconds"] = 2.into();
        assert!(Film::from_json(&serde_json::to_vec(&value).unwrap()).is_ok());
    }
    #[test] fn unfit_cycle_labels_fail_with_scene_context_instead_of_overlapping() {
        for label in ["A\nB\nC\nD\nE\nF".to_owned(), "W".repeat(40)] {
            let mut value=job();value["beats"][0]["id"]="garden-cycle".into();value["beats"][0]["block"]="cycle".into();
            value["beats"][0]["props"]=serde_json::json!({"nodes":[
                {"icon":"sun","label":label},{"icon":"cloud-rain","label":"Rain"},{"icon":"sprout","label":"Growth"}]});
            let film=Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap();
            let ctx=FFramesContext{time_base:fframes::TimeBase{fps:30,sample_rate:48000},
                current_video_size:fframes::VideoSize{width:1920,height:1080},duration_in_frames:60,
                mode:fframes::FFramesMode::Renderer,scenes:None,media_source:None,font_source:None,abort_signal:None};
            let failure=std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                let _=film.beats[0].render_frame(Frame::new(30,30,30),&ctx);
            })).expect_err("an unfit label must fail rendering");
            let message=failure.downcast_ref::<String>().map(String::as_str)
                .or_else(||failure.downcast_ref::<&str>().copied()).unwrap_or("");
            for required in ["Text overflow","garden-cycle","cycle","Shorten or reflow","14px"] {
                assert!(message.contains(required),"missing diagnostic context {required}: {message}");
            }
        }
    }
    #[test] fn kinetic_renders_stable_phrases_across_silence_and_backward_seeks() {
        let mut value = job(); value["frames"] = 120.into();
        value["beats"][0]["block"] = "kinetic".into(); value["beats"][0]["frames"] = 120.into();
        value["beats"][0]["props"] = serde_json::json!({"maxWords":7,"maxGap":0.6,"maxDuration":4});
        value["beats"][0]["words"] = serde_json::json!([
            {"text":"Look","start":0,"end":0.4},{"text":"closely","start":0.5,"end":0.9},
            {"text":"Then","start":2,"end":2.3},{"text":"begin","start":2.4,"end":2.8}]);
        let film = Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap();
        let ctx = FFramesContext { time_base: fframes::TimeBase { fps:30, sample_rate:48000 },
            current_video_size: fframes::VideoSize { width:1920, height:1080 }, duration_in_frames:120,
            mode:fframes::FFramesMode::Renderer, scenes:None, media_source:None, font_source:None, abort_signal:None };
        let render = |index| format!("{:?}", film.beats[0].render_frame(Frame::new(index,index,30), &ctx));
        let first = render(6);
        assert!(first.contains("Look") && first.contains("closely") && !first.contains("Then"));
        let next = render(60);
        assert!(next.contains("Then") && next.contains("begin") && !next.contains("Look"));
        assert_eq!(first, render(6));
    }
    #[test] fn exits_wait_for_values_to_settle_and_numerals_lead_with_the_sign() {
        let mut value = job(); value["beats"][0]["block"] = "stat".into(); value["beats"][0]["exit"] = "fade".into();
        value["beats"][0]["props"] = serde_json::json!({"value":-3,"prefix":"$","label":"Change"});
        value["beats"][0]["settle_seconds"] = 1.96.into();
        let render = |settle: f64| {
            let mut v = value.clone(); v["beats"][0]["settle_seconds"] = settle.into();
            let film = Film::from_json(&serde_json::to_vec(&v).unwrap()).unwrap();
            let ctx = FFramesContext { time_base: fframes::TimeBase { fps:30, sample_rate:48000 },
                current_video_size: fframes::VideoSize { width:1920, height:1080 }, duration_in_frames:60,
                mode:fframes::FFramesMode::Renderer, scenes:None, media_source:None, font_source:None, abort_signal:None };
            let frame = format!("{:?}", film.beats[0].render_frame(Frame::new(58,58,30), &ctx));
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
    #[test] fn magnitude_fits_long_values_on_a_vertical_canvas() {
        let mut value = job(); value["width"]=1080.into(); value["height"]=1920.into(); value["beats"][0]["block"] = "magnitude".into();
        value["beats"][0]["props"] = serde_json::json!({"format":{"suffix":" people"},"items":[
            {"label":"A team","value":12},{"label":"A company","value":1200},{"label":"A city","value":90000},{"label":"A country","value":8000000}]});
        let film = Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap();
        let ctx = FFramesContext { time_base: fframes::TimeBase { fps:30, sample_rate:48000 },
            current_video_size: fframes::VideoSize { width:1080, height:1920 }, duration_in_frames:60,
            mode:fframes::FFramesMode::Renderer, scenes:None, media_source:None, font_source:None, abort_signal:None };
        let frame = format!("{:?}", film.beats[0].render_frame(Frame::new(59,59,30), &ctx));
        assert!(frame.contains("8,000,000 people"));
    }
    #[test] fn word_mode_holds_through_short_pauses_and_clears_in_silence() {
        let mut value = job(); value["frames"] = 90.into();
        value["beats"][0]["block"] = "kinetic".into(); value["beats"][0]["frames"] = 90.into();
        value["beats"][0]["props"] = serde_json::json!({"mode":"word","maxGap":0.6});
        value["beats"][0]["words"] = serde_json::json!([{"text":"Look","start":0,"end":0.4},{"text":"closely","start":0.5,"end":0.9}]);
        let film = Film::from_json(&serde_json::to_vec(&value).unwrap()).unwrap();
        let ctx = FFramesContext { time_base: fframes::TimeBase { fps:30, sample_rate:48000 },
            current_video_size: fframes::VideoSize { width:1920, height:1080 }, duration_in_frames:90,
            mode:fframes::FFramesMode::Renderer, scenes:None, media_source:None, font_source:None, abort_signal:None };
        let render = |index| format!("{:?}", film.beats[0].render_frame(Frame::new(index,index,30), &ctx));
        assert!(render(13).contains("Look"), "held across the 0.1s gap");
        assert!(render(42).contains("closely"), "held 0.5s after the last word");
        assert!(!render(48).contains("closely"), "cleared after maxGap of silence");
    }
    #[test] fn video_decoder_drains_exact_last_b_frame_and_survives_backward_seeks() {
        use fframes::FFramesSyncedVideoFrame;
        let path=std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/bframes.mp4");
        unsafe {
            let mut decoder=fframes::media::FFmpegDecoder::new(&path,30,2).unwrap();
            assert!(decoder.decode_up_to(118).unwrap());
            let previous=decoder.get_raw_frame().into_image().href();
            assert!(decoder.decode_up_to(119).unwrap(),"last delayed B-frame must drain");
            let final_frame=decoder.get_raw_frame();
            assert!((final_frame.timestamp_seconds()-119.0/30.0).abs()<0.0001);
            let final_pixels=final_frame.into_image().href();
            assert_ne!(previous.data,final_pixels.data,"must decode the final sample, not freeze frame118");
            assert!(decoder.decode_up_to(119).unwrap());
            assert!(!decoder.decode_up_to(120).unwrap(),"the first frame beyond the clip must remain absent");
            assert!(decoder.decode_up_to(30).unwrap());
            assert!((decoder.get_raw_frame().timestamp_seconds()-1.0).abs()<0.0001);
            assert!(decoder.decode_up_to(119).unwrap());
            assert_eq!(final_pixels.data,decoder.get_raw_frame().into_image().href().data);
        }
    }
}
