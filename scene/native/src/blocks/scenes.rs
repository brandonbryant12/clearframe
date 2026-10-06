//! Scene composition: the shared layout grid, typographic helpers, entrances/exits and
//! the story blocks. Charts, diagrams and media plates live in sibling modules.
use super::{Beat, Caption, Ctx, Frame};
use crate::design::Palette;
use crate::draw::{self, Node, empty};
use crate::motion::{self, Enter, ExitKind, MotionStyle};
use crate::numbers::{format_number, number_parts, zero_scale};
use crate::text::{self, Font, Layout, Style};
use serde_json::Value;
use skia_safe::{self as sk, Matrix, Rect, TileMode};
use std::cell::Cell;
use std::sync::Arc;

#[path = "canvas.rs"]
mod canvas;
#[path = "charts.rs"]
mod charts;
#[path = "compositor.rs"]
mod compositor;
#[path = "diagrams.rs"]
mod diagrams;
#[path = "media.rs"]
mod media;
#[path = "speech.rs"]
mod speech;
#[path = "story.rs"]
mod story;
pub use compositor::render;

/// Block-specific structural checks (diagrams, canvas).
pub(crate) fn validate_diagram(block: &str, props: &Value) -> Result<(), &'static str> {
    if block == "canvas" {
        return canvas::validate(props);
    }
    diagrams::validate(block, props)
}

/// Beat-level layers: art elements, camera move and image plate.
pub(crate) fn validate_layers(
    art: Option<&Value>,
    camera: Option<&Value>,
    plate: Option<&Value>,
) -> Result<(), &'static str> {
    if let Some(art) = art {
        if !art.is_object() {
            return Err("art must be {under, over}");
        }
        let mut count = 0;
        for layer in ["under", "over"] {
            canvas::validate_elements(arr(art, layer), 0, &mut count)?;
        }
    }
    if let Some(camera) = camera {
        if !["", "auto", "none", "in", "out", "left", "right", "up", "down"].contains(&s(camera, "move"))
            || !n(camera, "amount", 0.5).is_finite()
            || !(0.0..=1.0).contains(&n(camera, "amount", 0.5))
        {
            return Err("camera needs move in|out|left|right|up|down|none and amount 0–1");
        }
    }
    if let Some(plate) = plate {
        if s(plate, "file").is_empty()
            || !["", "full", "left", "right", "top", "bottom"].contains(&s(plate, "side"))
            || !["", "none", "mono", "duotone", "tint", "blur", "soft", "halftone", "engraving"]
                .contains(&s(plate, "treatment"))
            || !["", "none", "in", "out", "left", "right", "up", "down"].contains(&s(plate, "drift"))
            || !(0.0..=1.0).contains(&n(plate, "scrim", 0.0))
        {
            return Err(
                "plate needs a prepared file, side full|left|right|top|bottom, a known treatment/drift and scrim 0–1",
            );
        }
    }
    Ok(())
}

pub(crate) fn s<'a>(v: &'a Value, key: &str) -> &'a str {
    v.get(key).and_then(Value::as_str).unwrap_or("")
}
pub(crate) fn n(v: &Value, key: &str, default: f64) -> f64 {
    v.get(key).and_then(Value::as_f64).unwrap_or(default)
}
pub(crate) fn arr<'a>(v: &'a Value, key: &str) -> &'a [Value] {
    v.get(key).and_then(Value::as_array).map(Vec::as_slice).unwrap_or(&[])
}
pub(crate) fn nonempty<'a>(a: &'a str, b: &'a str) -> &'a str {
    if a.is_empty() { b } else { a }
}
fn at(v: &Value, base: f32, index: usize) -> f32 {
    n(v, "at", base as f64 + index as f64 * 0.14) as f32
}
/// Phrases authored as strings or `{text}` objects.
fn phrases(v: &Value, key: &str) -> Vec<String> {
    arr(v, key)
        .iter()
        .filter_map(|p| p.as_str().or_else(|| p.get("text").and_then(Value::as_str)))
        .map(str::to_owned)
        .collect()
}

pub(crate) fn active_word(words: &[Caption], time: f32) -> Option<usize> {
    words.iter().position(|word| time >= word.start && time < word.end)
}
/// Phrase membership is derived from prepared timestamps, never estimated from text.
pub(crate) fn word_window(
    words: &[Caption],
    time: f32,
    max_words: usize,
    max_gap: f32,
    max_duration: f32,
) -> std::ops::Range<usize> {
    phrase_window(words, time, max_words, max_gap, max_duration, false)
}
/// As `word_window`; with `sentences`, a phrase also ends after . ! or ? so poster type
/// never strands the start of the next sentence.
pub(crate) fn phrase_window(
    words: &[Caption],
    time: f32,
    max_words: usize,
    max_gap: f32,
    max_duration: f32,
    sentences: bool,
) -> std::ops::Range<usize> {
    if words.is_empty() {
        return 0..0;
    }
    let latest = words.iter().rposition(|word| time >= word.start).unwrap_or(0);
    let mut start = 0;
    for index in 1..words.len() {
        let ends_sentence =
            sentences && words[index - 1].text.trim_end_matches(['"', '\'', ')', '”', '’']).ends_with(['.', '!', '?']);
        // A full phrase breaks at the word limit, but never right after a word that leans on
        // the next one ("the", "of", "too"): break one word early so the leaning word starts
        // the next phrase, or, failing that, one word late.
        let (count, limit) = (index - start, max_words.max(1));
        let full = count > limit
            || (count == limit && !leans(&words[index - 1].text))
            || (limit >= 3 && count + 1 == limit && leans(&words[index].text) && !leans(&words[index - 1].text));
        // Poster type pages on whole phrases: a long sentence breaks at a clause mark.
        let ends_clause = sentences
            && count >= 6
            && words[index - 1].text.trim_end_matches(['"', '\'', ')', '”', '’']).ends_with([',', ';', ':', '—', '–']);
        let boundary = full
            || ends_sentence
            || ends_clause
            || words[index].start - words[index - 1].end > max_gap
            || words[index].end - words[start].start > max_duration;
        if boundary {
            if latest < index {
                return start..index;
            }
            start = index;
        }
    }
    start..words.len()
}

thread_local! {
    /// The opacity of scene type: below 1 only while a scene runs on under a dissolve.
    pub(crate) static TEXT_ALPHA: std::cell::Cell<f32> = const { std::cell::Cell::new(1.0) };
    /// Which part of a beat to draw: 0 everything, 1 only its ground (tone and plate), 2 all
    /// but its ground. The scene engine draws native layers between the two.
    pub(crate) static PART: std::cell::Cell<u8> = const { std::cell::Cell::new(0) };
}

/// Words that lean on the next one: a phrase should not end on them.
pub(crate) fn leans(word: &str) -> bool {
    const LEANING: &[&str] = &[
        "a", "an", "the", "of", "to", "in", "on", "at", "by", "for", "from", "with", "and", "or", "but", "nor", "so",
        "as", "than", "that", "this", "these", "those", "its", "their", "our", "your", "my", "his", "her", "is", "was",
        "are", "were", "be", "been", "does", "do", "did", "not", "no", "too", "very", "more", "most", "every", "each",
        "into", "onto", "over", "under", "about", "if", "when", "while", "will", "would", "can", "could", "should",
        "has", "have", "had", "it's", "what", "how", "why", "who",
    ];
    let w = word.trim_matches(|c: char| !c.is_alphanumeric() && c != '\'').to_lowercase();
    !word.ends_with([',', '.', ';', ':', '!', '?']) && LEANING.contains(&w.as_str())
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct Area {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

/// (line, byte start, byte end, color) of a recolored phrase.
pub(crate) type Emphasis = (usize, usize, usize, String);

#[derive(Clone, Copy, PartialEq)]
pub(crate) enum Align {
    Left,
    Center,
    Right,
}
impl Align {
    fn x(self, x: f32, w: f32, content: f32) -> f32 {
        match self {
            Align::Left => x,
            Align::Center => x + (w - content) / 2.0,
            Align::Right => x + w - content,
        }
    }
}

pub(crate) fn rect(x: f32, y: f32, w: f32, h: f32, color: &str) -> Node {
    if w <= 0.0 || h <= 0.0 {
        return draw::empty();
    }
    draw::rect(x, y, w, h).fill(&color).node()
}
pub(crate) fn rounded(x: f32, y: f32, w: f32, h: f32, r: f32, color: &str) -> Node {
    if w <= 0.0 || h <= 0.0 {
        return draw::empty();
    }
    let r = r.min(w / 2.0).min(h / 2.0);
    draw::rounded_rect(x, y, w, h, r, r).fill(&color).node()
}
pub(crate) fn rule(x: f32, y: f32, w: f32, color: &str) -> Node {
    rect(x, y, w, 2.0, color)
}

pub(crate) struct Draw<'a, 'c> {
    pub b: &'a Beat,
    pub f: Frame,
    pub ctx: &'c Ctx,
    pub p: Palette,
    /// The film palette before any scene tone: graphic transitions use it on both sides of
    /// a cut so the covering panel keeps one colour.
    pub base: Palette,
    pub area: Area,
    /// Scene-local seconds.
    pub t: f32,
    pub wide: bool,
    pub m: MotionStyle,
    ids: Cell<usize>,
    /// Header top when a plate occupies the top of a tall frame.
    pub head_y: Option<f32>,
    /// Lowest y the footer may use (a bottom plate raises it).
    pub floor: f32,
    /// Letterbox bar height on this beat (captions sit above it).
    pub bar: f32,
    /// How far the heading moves down to clear a letterbox bar.
    pub lift: f32,
    /// Centre of a world camera at this frame, for elements drawn with parallax (`depth`).
    pub camera: Cell<Option<(f32, f32)>>,
    /// Canvas depth at this frame: the camera's z (`dolly`) and the focus plane (z, aperture).
    pub depth: Cell<(f32, Option<(f32, f32)>)>,
    /// Offset of the group being drawn, so perspective works in world coordinates.
    pub offset: Cell<(f32, f32)>,
    /// Mosaic knockout: for each mosaic element (by address), the outlines of the filled
    /// mosaic shapes drawn after it, which remove its tiles and bend its rows around them.
    pub occluders: std::cell::RefCell<std::collections::HashMap<usize, Vec<Vec<(f32, f32)>>>>,
}

impl<'a, 'c> Draw<'a, 'c> {
    fn new(b: &'a Beat, f: Frame, ctx: &'c Ctx, area: Area) -> Self {
        let env = &b.environment;
        let base = Palette::from_theme(&env.theme);
        Draw {
            b,
            t: f.seconds(),
            f,
            ctx,
            p: base.clone().toned(b.tone.as_deref().unwrap_or("")),
            base,
            area,
            wide: env.width / env.height > 1.3,
            m: MotionStyle::new(&env.motion.preset, env.motion.intensity),
            ids: Cell::new(0),
            head_y: None,
            floor: env.height,
            bar: 0.0,
            lift: 0.0,
            camera: Cell::new(None),
            depth: Cell::new((0.0, None)),
            offset: Cell::new((0.0, 0.0)),
            occluders: Default::default(),
        }
    }
    /// When counts and fills start: `count_seconds` if the job separated it from the entrance.
    pub(crate) fn count_at(&self) -> f32 {
        self.b.count_seconds.unwrap_or(self.b.cue_seconds)
    }
    fn props(&self) -> &'a Value {
        &self.b.props
    }
    fn tall(&self) -> bool {
        self.b.environment.height > self.b.environment.width
    }
    /// Voice level 0–1 at scene seconds `t` (0 without prepared levels).
    pub(crate) fn level(&self, t: f32) -> f32 {
        if t < 0.0 {
            return 0.0;
        }
        self.b.levels.get((t * self.f.fps as f32).floor() as usize).map_or(0.0, |v| *v as f32 / 100.0)
    }
    /// Scene seconds of the final frame.
    pub(crate) fn last_frame(&self) -> f32 {
        self.b.frames.saturating_sub(1) as f32 / self.f.fps as f32
    }
    /// Document-unique ids for clip paths and gradients, stable for a given frame.
    pub(crate) fn uid(&self, kind: &str) -> String {
        let n = self.ids.get();
        self.ids.set(n + 1);
        format!("cf{}-{kind}-{n}", self.b.environment.index)
    }

    /// Wrap and fit, failing with the scene's context instead of spilling or dropping words.
    pub(crate) fn fit(&self, value: &str, style: Style, w: f32, h: f32) -> Arc<Layout> {
        text::fit(value, style, w.max(1.0), h.max(1.0)).unwrap_or_else(|o| panic!(
            "Text overflow in scene '{}' ({}): text needs {:.1}×{:.1}px at {:.1}px, but its box is {:.1}×{:.1}px. Shorten or reflow the text, or use a less dense layout; the minimum font size is 14px.",
            self.b.id, self.b.block, o.width, o.height, o.size, w, h))
    }
    pub(crate) fn run(
        &self,
        value: String,
        x: f32,
        baseline: f32,
        font: Font,
        size: f32,
        tracking: f32,
        color: &str,
    ) -> Node {
        if value.is_empty() {
            return empty();
        }
        // Under a dissolve the outgoing scene's words leave first, so two scenes' type is
        // never read on top of each other.
        let alpha = TEXT_ALPHA.with(|a| a.get());
        if alpha < 0.999 {
            if alpha <= 0.001 {
                return empty();
            }
            TEXT_ALPHA.with(|a| a.set(1.0));
            let node = self.run(value, x, baseline, font, size, tracking, color);
            TEXT_ALPHA.with(|a| a.set(alpha));
            return node.opacity(alpha);
        }
        draw::text(value, x, baseline, font, size, tracking, color)
    }
    /// One layout line, optionally recoloring whole-word phrases.
    fn line_node(
        &self,
        layout: &Layout,
        index: usize,
        x: f32,
        baseline: f32,
        color: &str,
        emphasis: &[Emphasis],
    ) -> Node {
        let line = &layout.lines[index];
        let mut pieces: Vec<_> = emphasis.iter().filter(|e| e.0 == index).collect();
        if pieces.is_empty() {
            return self.run(line.text.clone(), x, baseline, layout.font, layout.size, layout.tracking_px, color);
        }
        pieces.sort_by_key(|e| e.1);
        // Split the line at phrase boundaries; each segment starts at its shaped offset.
        let mut out = vec![];
        let mut cursor = 0usize;
        let segment = |from: usize, to: usize, color: &str| {
            self.run(
                line.text[from..to].to_owned(),
                x + text::offset(layout, index, from),
                baseline,
                layout.font,
                layout.size,
                layout.tracking_px,
                color,
            )
        };
        for (_, a, b, piece_color) in pieces {
            if *a < cursor {
                continue;
            } // Overlapping phrases keep the first color.
            if *a > cursor {
                out.push(segment(cursor, *a, color));
            }
            out.push(segment(*a, *b, piece_color));
            cursor = *b;
        }
        if cursor < line.text.len() {
            out.push(segment(cursor, line.text.len(), color));
        }
        Node::from(out)
    }
    fn emphasis(&self, layout: &Layout, phrases: &[String], color: &str) -> Vec<Emphasis> {
        phrases
            .iter()
            .flat_map(|p| text::phrase_ranges(layout, p))
            .map(|(i, a, b)| (i, a, b, color.to_owned()))
            .collect()
    }
    /// Static lines.
    pub(crate) fn draw(&self, layout: &Layout, x: f32, y: f32, w: f32, align: Align, color: &str) -> Node {
        let lines: Vec<_> = (0..layout.lines.len())
            .map(|i| {
                self.line_node(
                    layout,
                    i,
                    align.x(x, w, layout.lines[i].width),
                    y + i as f32 * layout.line_height + layout.baseline,
                    color,
                    &[],
                )
            })
            .collect();
        Node::from(lines)
    }
    /// Lines rise into view through their own masks, one after another.
    pub(crate) fn lines(
        &self,
        layout: &Layout,
        x: f32,
        y: f32,
        w: f32,
        align: Align,
        color: &str,
        start: f32,
        emphasis: &[Emphasis],
    ) -> Node {
        // Display type only: body copy, labels and list items keep the calmer line rise.
        let mode = self.text_motion();
        if mode != "lines" && layout.size >= 40.0 {
            return self.pieces(layout, x, y, w, align, color, start, emphasis, mode);
        }
        self.line_rise(layout, x, y, w, align, color, start, emphasis)
    }
    /// Each line rises through its own mask, staggered.
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn line_rise(
        &self,
        layout: &Layout,
        x: f32,
        y: f32,
        w: f32,
        align: Align,
        color: &str,
        start: f32,
        emphasis: &[Emphasis],
    ) -> Node {
        let mut out = vec![];
        for (i, line) in layout.lines.iter().enumerate() {
            let top = y + i as f32 * layout.line_height;
            let body = self.line_node(layout, i, align.x(x, w, line.width), top + layout.baseline, color, emphasis);
            let enter = self.m.enter(self.t - start - i as f32 * self.m.stagger());
            if enter.done() {
                out.push(body);
                continue;
            }
            if enter.hidden() {
                continue;
            }
            let dy = (1.0 - enter.travel) * layout.line_height * (0.3 + 0.7 * self.m.intensity);
            let (clip_y, clip_h) = (top - layout.size * 0.3, layout.line_height + layout.size * 0.42);
            out.push(body.opacity(enter.alpha).translate(0.0, dy).clip_rect(x - 80.0, clip_y, w + 160.0, clip_h));
        }
        Node::from(out)
    }
    /// This scene's type voice: the beat's own, else the film's.
    pub(crate) fn voice(&self) -> &text::Voice {
        self.b.type_voice.as_ref().unwrap_or(&self.b.environment.voice)
    }
    /// Seconds after a layout's start at which the piece ending at byte `end` of `line`
    /// arrives under this scene's text motion (mirrors `pieces`); under `lines` the whole line
    /// arrives on the line stagger. Decorations drawn around phrases follow this.
    pub(crate) fn piece_delay(&self, layout: &Layout, line: usize, end: usize) -> f32 {
        let mode = self.text_motion();
        if mode == "lines" || layout.size < 40.0 {
            return line as f32 * self.m.stagger();
        }
        let letters = mode != "words";
        let (mut total, mut index) = (0usize, 0usize);
        for (i, l) in layout.lines.iter().enumerate() {
            let text = l.text.as_str();
            let mut from = None;
            for (b, ch) in text.char_indices().chain(std::iter::once((text.len(), ' '))) {
                let piece_start = if letters {
                    (!ch.is_whitespace() && b < text.len()).then_some(b)
                } else {
                    match (ch.is_whitespace(), from) {
                        (false, None) => {
                            from = Some(b);
                            None
                        }
                        (true, Some(a)) => {
                            from = None;
                            Some(a)
                        }
                        _ => None,
                    }
                };
                if let Some(a) = piece_start {
                    if i == line && a < end {
                        index = total;
                    }
                    total += 1;
                }
            }
        }
        let step = (if letters { 0.028_f32 } else { 0.075 }).min(0.9 / total.max(1) as f32);
        index as f32 * step
    }
    /// How this scene's type arrives: `lines` (default), `words`, `letters` or `cascade`.
    pub(crate) fn text_motion(&self) -> &str {
        self.b.text_motion.as_deref().filter(|m| !m.is_empty()).unwrap_or(self.b.environment.text_motion.as_str())
    }
    /// Words or letters arriving one after another, each rising through its own mask (or, for
    /// `cascade`, dropping in with a small spring and tilt). Pieces sit at their shaped offsets,
    /// so kerning and emphasis colours match the static line exactly. The whole reveal is capped
    /// near 0.9 s so long headlines stay brisk.
    #[allow(clippy::too_many_arguments)]
    fn pieces(
        &self,
        layout: &Layout,
        x: f32,
        y: f32,
        w: f32,
        align: Align,
        color: &str,
        start: f32,
        emphasis: &[Emphasis],
        mode: &str,
    ) -> Node {
        let letters = mode == "letters" || mode == "cascade";
        // (line, byte start, byte end) of each piece, in reading order.
        let mut spans = vec![];
        for (i, line) in layout.lines.iter().enumerate() {
            let text = line.text.as_str();
            if letters {
                for (b, ch) in text.char_indices() {
                    if !ch.is_whitespace() {
                        spans.push((i, b, b + ch.len_utf8()));
                    }
                }
            } else {
                let mut from = None;
                for (b, ch) in text.char_indices().chain(std::iter::once((text.len(), ' '))) {
                    match (ch.is_whitespace(), from) {
                        (false, None) => from = Some(b),
                        (true, Some(a)) => {
                            spans.push((i, a, b));
                            from = None;
                        }
                        _ => {}
                    }
                }
            }
        }
        let step = (if letters { 0.028_f32 } else { 0.075 }).min(0.9 / spans.len().max(1) as f32);
        let mut out = vec![];
        for (k, &(i, a, b)) in spans.iter().enumerate() {
            let line = &layout.lines[i];
            let top = y + i as f32 * layout.line_height;
            let piece_color =
                emphasis.iter().find(|e| e.0 == i && e.1 <= a && b <= e.2).map_or(color, |e| e.3.as_str());
            let px = align.x(x, w, line.width) + text::offset(layout, i, a);
            let body = self.run(
                line.text[a..b].to_owned(),
                px,
                top + layout.baseline,
                layout.font,
                layout.size,
                layout.tracking_px,
                piece_color,
            );
            let width = text::measure(layout.font, &line.text[a..b], layout.size, layout.tracking_px);
            if let Some(node) = self.reveal_piece(
                body,
                start + k as f32 * step,
                k,
                mode,
                px,
                top,
                width,
                layout.size,
                layout.line_height,
            ) {
                out.push(node);
            }
        }
        Node::from(out)
    }
    /// One word or letter of a `pieces` reveal: a masked rise, or for `cascade` a drop-in with
    /// an alternating tilt. `None` while the piece is still waiting.
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn reveal_piece(
        &self,
        body: Node,
        time: f32,
        k: usize,
        mode: &str,
        px: f32,
        top: f32,
        width: f32,
        size: f32,
        line_h: f32,
    ) -> Option<Node> {
        let enter = self.m.enter(self.t - time);
        if enter.done() {
            return Some(body);
        }
        if enter.hidden() {
            return None;
        }
        if mode == "cascade" {
            let lift = (1.0 - enter.travel) * size * 0.6;
            let tilt = (1.0 - enter.travel) * if k % 2 == 0 { -8.0 } else { 8.0 };
            let (cx, cy) = (px + width / 2.0, top + line_h * 0.5);
            return Some(
                draw::group(vec![body.into()]).opacity(enter.alpha).rotate_about(tilt, cx, cy).translate(0.0, -lift),
            );
        }
        let dy = (1.0 - enter.travel) * line_h * 0.55;
        Some(body.opacity(enter.alpha).translate(0.0, dy).clip_rect(
            px - size * 0.2,
            top - size * 0.3,
            width + size * 0.4,
            line_h + size * 0.42,
        ))
    }
    /// Fit then draw statically; returns the node and the height it used.
    pub(crate) fn para(&self, value: &str, box_: Area, style: Style, color: &str, align: Align) -> (Node, f32) {
        if value.trim().is_empty() {
            return (empty(), 0.0);
        }
        let layout = self.fit(value, style, box_.w, box_.h);
        (self.draw(&layout, box_.x, box_.y, box_.w, align, color), layout.height())
    }
    /// Backwards-compatible single call used by diagram code.
    pub(crate) fn paragraph(&self, value: &str, box_: Area, size: f32, color: &str, weight: u16, center: bool) -> Node {
        let style = if weight >= 600 { Style::strong(size) } else { Style::text(size) };
        self.para(value, box_, style, color, if center { Align::Center } else { Align::Left }).0
    }

    pub(crate) fn enter(&self, time: f32) -> Enter {
        self.m.enter(self.t - time)
    }
    /// Fade in while travelling `distance` pixels upward.
    pub(crate) fn rise(&self, body: Node, time: f32, distance: f32) -> Node {
        let e = self.enter(time);
        if e.hidden() {
            return empty();
        }
        if e.done() {
            return body;
        }
        let dy = self.m.distance(distance) * (1.0 - e.travel);
        draw::group(vec![body.into()]).opacity(e.alpha).translate(0.0, dy)
    }
    /// Scale in around a point (badges, markers, cards).
    pub(crate) fn pop(&self, body: Node, time: f32, cx: f32, cy: f32) -> Node {
        let e = self.enter(time);
        if e.hidden() {
            return empty();
        }
        if e.done() {
            return body;
        }
        let scale = 0.6 + 0.4 * self.m.pop(self.t - time);
        draw::group(vec![body.into()]).opacity(e.alpha).scale_about(scale, cx, cy)
    }
    /// Current value of a count from `from` to `to` starting at `time`.
    pub(crate) fn count(&self, from: f64, to: f64, time: f32, duration: f32) -> f64 {
        from + (to - from) * self.m.grow(self.t - time, duration) as f64
    }

    /// A large numeral in tabular figures with smaller prefix/suffix units. Width is
    /// reserved for the final value so centred counters never drift while counting.
    pub(crate) fn numeral(
        &self,
        value: f64,
        final_value: f64,
        decimals: usize,
        prefix: &str,
        suffix: &str,
        x: f32,
        baseline: f32,
        size: f32,
        align_w: Option<f32>,
        color: &str,
        unit_color: &str,
    ) -> (Node, f32) {
        let (sign, digits) = number_parts(value, decimals);
        let (final_sign, final_digits) = number_parts(final_value, decimals);
        let (pfont, psize) = unit_style(prefix, size);
        let (sfont, ssize) = unit_style(suffix, size);
        // The sign leads the prefix ("−$3"), matching format_number in charts and legends.
        let sign_w = text::measure(Font::Figures, sign, size, 0.0);
        let final_sign_w = text::measure(Font::Figures, final_sign, size, 0.0).max(sign_w);
        let pw = text::measure(pfont, prefix, psize, 0.0);
        let body_w = text::measure(Font::Figures, &digits, size, 0.0);
        let reserve = text::measure(Font::Figures, &final_digits, size, 0.0).max(body_w);
        let sw = text::measure(sfont, suffix, ssize, 0.0);
        let gap = if suffix.starts_with(' ') || suffix.is_empty() { 0.0 } else { size * 0.03 };
        let pgap = if prefix.is_empty() || prefix.ends_with(' ') { 0.0 } else { size * 0.02 };
        let total = final_sign_w + pw + pgap + reserve + gap + sw;
        let x0 = match align_w {
            Some(w) => x + (w - total) / 2.0,
            None => x,
        };
        let px = x0 + sign_w;
        let nodes = vec![
            self.run(sign.to_owned(), x0, baseline, Font::Figures, size, 0.0, color),
            self.run(prefix.to_owned(), px, baseline, pfont, psize, 0.0, unit_color),
            self.run(digits, px + pw + pgap, baseline, Font::Figures, size, 0.0, color),
            // The suffix trails the current digits while counting and lands at its final place.
            self.run(suffix.to_owned(), px + pw + pgap + body_w + gap, baseline, sfont, ssize, 0.0, unit_color),
        ];
        (Node::from(nodes), total)
    }
    /// Width `numeral` gives a final value at `size`.
    pub(crate) fn numeral_width(
        &self,
        final_value: f64,
        decimals: usize,
        prefix: &str,
        suffix: &str,
        size: f32,
    ) -> f32 {
        let (sign, digits) = number_parts(final_value, decimals);
        let (pfont, psize) = unit_style(prefix, size);
        let (sfont, ssize) = unit_style(suffix, size);
        let gap = if suffix.starts_with(' ') || suffix.is_empty() { 0.0 } else { size * 0.03 };
        let pgap = if prefix.is_empty() || prefix.ends_with(' ') { 0.0 } else { size * 0.02 };
        text::measure(Font::Figures, sign, size, 0.0)
            + text::measure(pfont, prefix, psize, 0.0)
            + pgap
            + text::measure(Font::Figures, &digits, size, 0.0)
            + gap
            + text::measure(sfont, suffix, ssize, 0.0)
    }
    /// Largest numeral size (≤ `size`) whose final text fits `max_w`.
    pub(crate) fn numeral_size(
        &self,
        final_value: f64,
        decimals: usize,
        prefix: &str,
        suffix: &str,
        size: f32,
        max_w: f32,
    ) -> f32 {
        let full = self.numeral_width(final_value, decimals, prefix, suffix, size);
        if full <= max_w { size } else { (size * max_w / full).floor().max(text::MIN_SIZE) }
    }

    /// Uppercase eyebrow with a short accent dash.
    fn kicker(&self, value: &str, x: f32, y: f32, w: f32, time: f32) -> (Node, f32) {
        if value.trim().is_empty() {
            return (empty(), 0.0);
        }
        let layout = self.fit(value, Style::kicker(22.0), w - 40.0, 60.0);
        // Centred scenes centre the dash and label together.
        let x = if self.centered() { x + (w - 40.0 - layout.width()) / 2.0 } else { x };
        let dash = rounded(x, y + layout.baseline - layout.size * 0.36, 26.0, 4.0, 2.0, &self.p.accent);
        let label = self.draw(&layout, x + 40.0, y, w - 40.0, Align::Left, &self.p.accent);
        (self.rise(draw::group(vec![dash.into(), label.into()]), time, 10.0), layout.height())
    }
    /// Hero, number and chapter blocks can centre their stack with `align: "center"`.
    pub(crate) fn centered(&self) -> bool {
        s(self.props(), "align") == "center"
            && matches!(self.b.block.as_str(), "title" | "statement" | "endcard" | "chapter" | "stat" | "highlight")
    }
    fn align(&self) -> Align {
        if self.centered() { Align::Center } else { Align::Left }
    }
    fn shift(&self) -> f32 {
        if let Some(y) = self.head_y {
            return y - 100.0;
        }
        self.lift + if self.tall() { self.b.environment.height * 0.11 - 108.0 } else { 0.0 }
    }
    /// When the heading enters: already in place on a hard cut (a cut lands on a composed
    /// frame), rising just after the scene starts otherwise.
    fn heading_at(&self) -> f32 {
        if self.b.transition == "cut" && self.b.environment.index > 0 { -10.0 } else { 0.06 }
    }
    fn header(&self) -> Node {
        // A lower third needs a title; without one there is no rule or kicker to set.
        if self.b.heading == "bottom" && self.head_y.is_none() && !s(self.props(), "title").trim().is_empty() {
            return self.lower_third();
        }
        let (x, w) = (self.area.x, self.area.w);
        let shift = self.shift();
        let (kicker, _) = self.kicker(s(self.props(), "kicker"), x, 100.0 + shift, w, self.heading_at().min(0.0));
        let title = s(self.props(), "title");
        if title.trim().is_empty() {
            return kicker;
        }
        let v = self.voice();
        let style = v.style(v.regular(), if self.wide { 62.0 } else { 56.0 }, 1.06, false);
        let layout = self.fit(title, style, if self.wide { w * 0.86 } else { w }, 150.0);
        // Headings label the scene; they are not spoken, so they never build word by word.
        let title = self.line_rise(&layout, x, 146.0 + shift, w, Align::Left, &self.p.ink, self.heading_at(), &[]);
        draw::group(vec![kicker.into(), title.into()])
    }
}

impl<'a, 'c> Draw<'a, 'c> {
    /// The title as a lower third: an accent rule, the kicker and the title set under the
    /// picture, where documentary captions sit. The compositor reserves the space.
    fn lower_third(&self) -> Node {
        let (x, w) = (self.area.x, self.area.w);
        let mut y = self.area.y + self.area.h + 34.0;
        let (kicker, kh) = self.kicker(s(self.props(), "kicker"), x, y, w, self.heading_at().min(0.0));
        if kh > 0.0 {
            y += 40.0;
        }
        let v = self.voice();
        let style = v.style(v.regular(), if self.wide { 58.0 } else { 52.0 }, 1.06, false);
        let layout = self.fit(s(self.props(), "title"), style, if self.wide { w * 0.8 } else { w }, 132.0);
        let at = self.heading_at();
        let grow = self.m.grow(self.t - at, 0.6);
        let rule = rect(x, y - 14.0, 120.0 * grow, 4.0, &self.p.accent);
        let title = self.line_rise(&layout, x, y, w, Align::Left, &self.p.ink, at + 0.05, &[]);
        draw::group(vec![rule.into(), kicker.into(), title.into()])
    }
}

/// Word units ("days", "people") sit small beside a numeral; symbols ("%", "k", "$") larger.
fn unit_style(part: &str, size: f32) -> (Font, f32) {
    let word = part.trim().chars().count() > 2 && part.trim().chars().any(char::is_alphabetic);
    if word { (Font::Display, size * 0.34) } else { (Font::DisplayBold, size * 0.56) }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn context() -> Ctx {
        Ctx { media: std::cell::RefCell::new(crate::media::Media::new(std::path::Path::new("."), 30)), scale: 1.0 }
    }
    #[test]
    fn empty_paragraphs_emit_no_text_even_without_layout_space() {
        let beat: Beat = serde_json::from_value(serde_json::json!({"id":"empty","block":"statement","frames":60,
            "start_frame":0,"cue_seconds":0,"props":{"text":"Test"}}))
        .unwrap();
        let ctx = context();
        let area = Area { x: 0.0, y: 0.0, w: 0.0, h: 0.0 };
        let draw = Draw::new(&beat, Frame::new(0, 0, 30), &ctx, area);
        for value in ["", " \n\t "] {
            let tree = format!("{:?}", draw.paragraph(value, area, 32.0, "#000000", 400, false));
            assert!(!tree.contains("text"), "empty input must not create a text element");
        }
    }
    #[test]
    fn pictures_keep_their_place_inside_nested_groups() {
        let info =
            skia_safe::ImageInfo::new((1, 1), skia_safe::ColorType::RGBA8888, skia_safe::AlphaType::Unpremul, None);
        let image =
            skia_safe::images::raster_from_data(&info, skia_safe::Data::new_copy(&[40, 80, 160, 255]), 4).unwrap();
        let plate = draw::picture(image, 10.0, 10.0, 80.0, 80.0, draw::Fit::Fill);
        let wrapped = draw::group(vec![draw::group(vec![plate]).translate(5.0, 0.0)]);
        assert_eq!(wrapped.bounds().unwrap(), skia_safe::Rect::from_xywh(15.0, 10.0, 80.0, 80.0));
        assert!(format!("{wrapped:?}").contains("image(1x1"));
    }
    #[test]
    fn words_follow_half_open_timestamps_and_seek_backwards() {
        let words = vec![
            Caption { text: "one".into(), start: 0.1, end: 0.5 },
            Caption { text: "two".into(), start: 0.6, end: 1.0 },
        ];
        assert_eq!(active_word(&words, 0.0), None);
        assert_eq!(active_word(&words, 0.1), Some(0));
        assert_eq!(active_word(&words, 0.5), None);
        assert_eq!(active_word(&words, 0.6), Some(1));
        assert_eq!(active_word(&words, 1.0), None);
        assert_eq!(active_word(&words, 0.2), Some(0));
    }
    #[test]
    fn phrases_split_on_word_limit_silence_and_duration_without_changing_timestamps() {
        let words = vec![
            Caption { text: "Observe".into(), start: 0.0, end: 0.4 },
            Caption { text: "closely".into(), start: 0.5, end: 0.9 },
            Caption { text: "Then".into(), start: 2.0, end: 2.3 },
            Caption { text: "begin".into(), start: 2.4, end: 2.8 },
            Caption { text: "again".into(), start: 2.9, end: 3.4 },
        ];
        assert_eq!(word_window(&words, 0.2, 7, 0.6, 4.0), 0..2);
        assert_eq!(word_window(&words, 1.8, 7, 0.6, 4.0), 0..2);
        assert_eq!(active_word(&words, 1.8), None);
        assert_eq!(word_window(&words, 2.0, 7, 0.6, 4.0), 2..5);
        assert_eq!(word_window(&words, 3.1, 7, 0.6, 1.0), 4..5);
        assert_eq!(word_window(&words, 2.5, 1, 0.6, 4.0), 3..4);
        assert_eq!(words[2].start, 2.0);
        assert_eq!(words[4].end, 3.4);
    }
    #[test]
    fn phrases_never_end_on_a_word_that_leans_on_the_next() {
        let words: Vec<Caption> = "The problem was never too few buses."
            .split(' ')
            .enumerate()
            .map(|(i, w)| Caption { text: w.into(), start: i as f32 * 0.3, end: i as f32 * 0.3 + 0.25 })
            .collect();
        // "The problem was never too" would strand "too": it starts the next phrase instead.
        assert_eq!(phrase_window(&words, 0.1, 5, 0.6, 9.0, true), 0..4);
        assert_eq!(phrase_window(&words, 1.3, 5, 0.6, 9.0, true), 4..7);
    }
    #[test]
    fn emphasis_segments_cover_the_line_without_losing_characters() {
        let beat: Beat = serde_json::from_value(serde_json::json!({"id":"e","block":"statement","frames":60,
            "start_frame":0,"cue_seconds":0,"props":{"text":"x"}}))
        .unwrap();
        let ctx = context();
        let draw = Draw::new(&beat, Frame::new(59, 59, 30), &ctx, Area { x: 0.0, y: 0.0, w: 1600.0, h: 600.0 });
        let layout = draw.fit("An average can hide a long tail.", Style::display(Font::Display, 80.0), 1600.0, 600.0);
        let emphasis = draw.emphasis(&layout, &["long tail".to_owned()], "#ff0000");
        let tree = format!("{:?}", draw.draw_emphasized(&layout, &emphasis));
        for piece in ["An average can hide a ", "long tail", "."] {
            assert!(tree.contains(piece), "missing {piece}: {tree}");
        }
        assert!(tree.contains("#ff0000"));
    }
}

#[cfg(test)]
impl<'a> Draw<'a, '_> {
    fn draw_emphasized(&self, layout: &Layout, emphasis: &[Emphasis]) -> Node {
        let lines: Vec<_> = (0..layout.lines.len())
            .map(|i| self.line_node(layout, i, 0.0, layout.baseline, "#000000", emphasis))
            .collect();
        Node::from(lines)
    }
}
