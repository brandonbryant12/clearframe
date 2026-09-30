//! Scene composition: the shared layout grid, typographic helpers, entrances/exits and
//! the story blocks. Charts, diagrams and media plates live in sibling modules.
use crate::design::Palette;
use crate::motion::{self, Enter, ExitKind, MotionStyle};
use crate::text::{self, Font, Layout, Style};
use crate::{Beat, Caption};
use fframes::{FFramesContext, Frame, Svgr};
use serde_json::Value;
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
            || !["", "none", "mono", "duotone", "tint", "blur", "soft"].contains(&s(plate, "treatment"))
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
        let boundary = index - start >= max_words.max(1)
            || ends_sentence
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

/// Locale-independent grouping; the sign, prefix, digits and suffix stay one atomic string.
pub fn format_number(value: f64, decimals: usize, prefix: &str, suffix: &str) -> String {
    let (sign, digits) = number_parts(value, decimals);
    format!("{sign}{prefix}{digits}{suffix}")
}
/// ("−" or "", grouped digits with fraction), rounding negative zero away.
fn number_parts(value: f64, decimals: usize) -> (&'static str, String) {
    let decimals = decimals.min(8);
    let threshold = 0.5 * 10_f64.powi(-(decimals as i32));
    let value = if value.abs() < threshold { 0.0 } else { value };
    let raw = format!("{:.*}", decimals, value.abs());
    let mut parts = raw.split('.');
    let integer = parts.next().unwrap_or("0");
    let mut grouped = String::new();
    for (i, c) in integer.chars().enumerate() {
        if i > 0 && (integer.len() - i) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(c);
    }
    if let Some(fraction) = parts.next() {
        grouped.push('.');
        grouped.push_str(fraction);
    }
    (if value < 0.0 { "−" } else { "" }, grouped)
}
pub fn zero_scale(value: f64, max: f64) -> f64 {
    if max <= 0.0 { 0.0 } else { (value / max).clamp(0.0, 1.0) }
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

pub(crate) fn rect<'a>(x: f32, y: f32, w: f32, h: f32, color: &str) -> Svgr<'a> {
    if w <= 0.0 || h <= 0.0 {
        return fframes::svgr!(<g />);
    }
    fframes::svgr!(<rect x={x} y={y} width={w} height={h} fill={color.to_owned()} />)
}
pub(crate) fn rounded<'a>(x: f32, y: f32, w: f32, h: f32, r: f32, color: &str) -> Svgr<'a> {
    if w <= 0.0 || h <= 0.0 {
        return fframes::svgr!(<g />);
    }
    let r = r.min(w / 2.0).min(h / 2.0);
    fframes::svgr!(<rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill={color.to_owned()} />)
}
pub(crate) fn rule<'a>(x: f32, y: f32, w: f32, color: &str) -> Svgr<'a> {
    rect(x, y, w, 2.0, color)
}
fn empty<'a>() -> Svgr<'a> {
    fframes::svgr!(<g />)
}

pub(crate) struct Draw<'a, 'c, 'm> {
    pub b: &'a Beat,
    pub f: Frame,
    pub ctx: &'c FFramesContext<'a, 'm>,
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
}

impl<'a, 'c, 'm> Draw<'a, 'c, 'm> {
    fn new(b: &'a Beat, f: Frame, ctx: &'c FFramesContext<'a, 'm>, area: Area) -> Self {
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
        }
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
    ) -> Svgr<'a> {
        if value.is_empty() {
            return empty();
        }
        let weight = font.weight().to_string();
        if font.italic() {
            return fframes::svgr!(<text x={x} y={baseline} font-family={font.family()} font-weight={weight} font-style="italic" font-size={size} letter-spacing={tracking} fill={color.to_owned()}>{value}</text>);
        }
        if tracking.abs() > 1e-3 {
            fframes::svgr!(<text x={x} y={baseline} font-family={font.family()} font-weight={weight} font-size={size} letter-spacing={tracking} fill={color.to_owned()}>{value}</text>)
        } else {
            fframes::svgr!(<text x={x} y={baseline} font-family={font.family()} font-weight={weight} font-size={size} fill={color.to_owned()}>{value}</text>)
        }
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
    ) -> Svgr<'a> {
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
        fframes::svgr!(<g>{out}</g>)
    }
    fn emphasis(&self, layout: &Layout, phrases: &[String], color: &str) -> Vec<Emphasis> {
        phrases
            .iter()
            .flat_map(|p| text::phrase_ranges(layout, p))
            .map(|(i, a, b)| (i, a, b, color.to_owned()))
            .collect()
    }
    /// Static lines.
    pub(crate) fn draw(&self, layout: &Layout, x: f32, y: f32, w: f32, align: Align, color: &str) -> Svgr<'a> {
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
        fframes::svgr!(<g>{lines}</g>)
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
    ) -> Svgr<'a> {
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
            let id = self.uid("line");
            let (clip_y, clip_h) = (top - layout.size * 0.3, layout.line_height + layout.size * 0.42);
            out.push(fframes::svgr!(<g>
                <defs><clipPath id={id.clone()}><rect x={x - 80.0} y={clip_y} width={w + 160.0} height={clip_h} /></clipPath></defs>
                <g clip-path={format!("url(#{id})")}><g opacity={enter.alpha} transform={format!("translate(0 {dy})")}>{body}</g></g>
            </g>));
        }
        fframes::svgr!(<g>{out}</g>)
    }
    /// Fit then draw statically; returns the node and the height it used.
    pub(crate) fn para(&self, value: &str, box_: Area, style: Style, color: &str, align: Align) -> (Svgr<'a>, f32) {
        if value.trim().is_empty() {
            return (empty(), 0.0);
        }
        let layout = self.fit(value, style, box_.w, box_.h);
        (self.draw(&layout, box_.x, box_.y, box_.w, align, color), layout.height())
    }
    /// Backwards-compatible single call used by diagram code.
    pub(crate) fn paragraph(
        &self,
        value: &str,
        box_: Area,
        size: f32,
        color: &str,
        weight: u16,
        center: bool,
    ) -> Svgr<'a> {
        let style = if weight >= 600 { Style::strong(size) } else { Style::text(size) };
        self.para(value, box_, style, color, if center { Align::Center } else { Align::Left }).0
    }

    pub(crate) fn enter(&self, time: f32) -> Enter {
        self.m.enter(self.t - time)
    }
    /// Fade in while travelling `distance` pixels upward.
    pub(crate) fn rise(&self, body: Svgr<'a>, time: f32, distance: f32) -> Svgr<'a> {
        let e = self.enter(time);
        if e.hidden() {
            return empty();
        }
        if e.done() {
            return body;
        }
        let dy = self.m.distance(distance) * (1.0 - e.travel);
        fframes::svgr!(<g opacity={e.alpha} transform={format!("translate(0 {dy})")}>{body}</g>)
    }
    /// Scale in around a point (badges, markers, cards).
    pub(crate) fn pop(&self, body: Svgr<'a>, time: f32, cx: f32, cy: f32) -> Svgr<'a> {
        let e = self.enter(time);
        if e.hidden() {
            return empty();
        }
        if e.done() {
            return body;
        }
        let scale = 0.6 + 0.4 * self.m.pop(self.t - time);
        fframes::svgr!(<g opacity={e.alpha} transform={format!("translate({cx} {cy}) scale({scale}) translate({} {})", -cx, -cy)}>{body}</g>)
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
    ) -> (Svgr<'a>, f32) {
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
        (fframes::svgr!(<g>{nodes}</g>), total)
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
    fn kicker(&self, value: &str, x: f32, y: f32, w: f32, time: f32) -> (Svgr<'a>, f32) {
        if value.trim().is_empty() {
            return (empty(), 0.0);
        }
        let layout = self.fit(value, Style::kicker(22.0), w - 40.0, 60.0);
        // Centred scenes centre the dash and label together.
        let x = if self.centered() { x + (w - 40.0 - layout.width()) / 2.0 } else { x };
        let dash = rounded(x, y + layout.baseline - layout.size * 0.36, 26.0, 4.0, 2.0, &self.p.accent);
        let label = self.draw(&layout, x + 40.0, y, w - 40.0, Align::Left, &self.p.accent);
        (self.rise(fframes::svgr!(<g>{dash}{label}</g>), time, 10.0), layout.height())
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
        if self.tall() { self.b.environment.height * 0.11 - 108.0 } else { 0.0 }
    }
    fn header(&self) -> Svgr<'a> {
        let (x, w) = (self.area.x, self.area.w);
        let shift = self.shift();
        let (kicker, _) = self.kicker(s(self.props(), "kicker"), x, 100.0 + shift, w, 0.0);
        let title = s(self.props(), "title");
        if title.trim().is_empty() {
            return kicker;
        }
        let style = Style::display(Font::Display, if self.wide { 62.0 } else { 56.0 }).leading(1.06);
        let layout = self.fit(title, style, if self.wide { w * 0.86 } else { w }, 150.0);
        let title = self.lines(&layout, x, 146.0 + shift, w, Align::Left, &self.p.ink, 0.06, &[]);
        fframes::svgr!(<g>{kicker}{title}</g>)
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
    fn context<'a>() -> FFramesContext<'a, 'a> {
        FFramesContext {
            time_base: fframes::TimeBase { fps: 30, sample_rate: 48000 },
            current_video_size: fframes::VideoSize { width: 1920, height: 1080 },
            duration_in_frames: 60,
            mode: fframes::FFramesMode::Renderer,
            scenes: None,
            media_source: None,
            font_source: None,
            abort_signal: None,
        }
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
    fn dynamic_media_survives_nested_scene_svg() {
        let image = std::sync::Arc::new(fframes::usvgr::PreloadedImageData::new(
            "test.mp4___frame___0.png".into(),
            1,
            1,
            &[40, 80, 160, 255],
        ));
        let plate = fframes::svgr!(<image x="10" y="10" width="80" height="80" href={image} />);
        let wrapped = fframes::svgr!(<g>{plate}</g>);
        let svg = fframes::svgr!(<svg width="100" height="100" viewBox="0 0 100 100">{wrapped}</svg>);
        let tree = svg
            .into_svg_tree(&Default::default(), &mut fframes::usvgr::Cache::new_with_text_cache(1), &Default::default())
            .unwrap();
        let serialized = tree.to_string(&Default::default());
        assert!(serialized.contains("<image"), "{serialized}");
    }
    #[test]
    fn signed_suffixes_are_atomic() {
        assert_eq!(format_number(-1234.5, 1, "$", " million"), "−$1,234.5 million");
        assert_eq!(format_number(-0.0001, 2, "", "%"), "0.00%");
        assert_eq!(format_number(1e7, 0, "", ""), "10,000,000");
    }
    #[test]
    fn bars_have_truthful_zero_baselines() {
        assert_eq!(zero_scale(0.0, 50.0), 0.0);
        assert_eq!(zero_scale(25.0, 50.0), 0.5);
        assert_eq!(zero_scale(0.0, 0.0), 0.0);
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
impl<'a> Draw<'a, '_, '_> {
    fn draw_emphasized(&self, layout: &Layout, emphasis: &[Emphasis]) -> Svgr<'a> {
        let lines: Vec<_> = (0..layout.lines.len())
            .map(|i| self.line_node(layout, i, 0.0, layout.baseline, "#000000", emphasis))
            .collect();
        fframes::svgr!(<g>{lines}</g>)
    }
}
