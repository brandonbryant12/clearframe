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

#[path = "charts.rs"]
mod charts;
#[path = "diagrams.rs"]
mod diagrams;
#[path = "media.rs"]
mod media;
pub(crate) use diagrams::validate as validate_diagram;

pub(crate) fn s<'a>(v: &'a Value, key: &str) -> &'a str { v.get(key).and_then(Value::as_str).unwrap_or("") }
pub(crate) fn n(v: &Value, key: &str, default: f64) -> f64 { v.get(key).and_then(Value::as_f64).unwrap_or(default) }
pub(crate) fn arr<'a>(v: &'a Value, key: &str) -> &'a [Value] { v.get(key).and_then(Value::as_array).map(Vec::as_slice).unwrap_or(&[]) }
pub(crate) fn nonempty<'a>(a: &'a str, b: &'a str) -> &'a str { if a.is_empty() { b } else { a } }
fn at(v: &Value, base: f32, index: usize) -> f32 { n(v, "at", base as f64 + index as f64 * 0.14) as f32 }
/// Phrases authored as strings or `{text}` objects.
fn phrases(v: &Value, key: &str) -> Vec<String> {
    arr(v, key).iter().filter_map(|p| p.as_str().or_else(|| p.get("text").and_then(Value::as_str))).map(str::to_owned).collect()
}

pub(crate) fn active_word(words: &[Caption], time: f32) -> Option<usize> {
    words.iter().position(|word| time >= word.start && time < word.end)
}
/// Phrase membership is derived from prepared timestamps, never estimated from text.
pub(crate) fn word_window(words: &[Caption], time: f32, max_words: usize, max_gap: f32, max_duration: f32) -> std::ops::Range<usize> {
    if words.is_empty() { return 0..0; }
    let latest = words.iter().rposition(|word| time >= word.start).unwrap_or(0);
    let mut start = 0;
    for index in 1..words.len() {
        let boundary = index - start >= max_words.max(1)
            || words[index].start - words[index - 1].end > max_gap
            || words[index].end - words[start].start > max_duration;
        if boundary {
            if latest < index { return start..index; }
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
        if i > 0 && (integer.len() - i) % 3 == 0 { grouped.push(','); }
        grouped.push(c);
    }
    if let Some(fraction) = parts.next() { grouped.push('.'); grouped.push_str(fraction); }
    (if value < 0.0 { "−" } else { "" }, grouped)
}
pub fn zero_scale(value: f64, max: f64) -> f64 { if max <= 0.0 { 0.0 } else { (value / max).clamp(0.0, 1.0) } }

#[derive(Clone, Copy, Debug)]
pub(crate) struct Area { pub x: f32, pub y: f32, pub w: f32, pub h: f32 }

/// (line, byte start, byte end, color) of a recolored phrase.
pub(crate) type Emphasis = (usize, usize, usize, String);

#[derive(Clone, Copy, PartialEq)]
pub(crate) enum Align { Left, Center, Right }
impl Align {
    fn x(self, x: f32, w: f32, content: f32) -> f32 {
        match self { Align::Left => x, Align::Center => x + (w - content) / 2.0, Align::Right => x + w - content }
    }
}

pub(crate) fn rect<'a>(x: f32, y: f32, w: f32, h: f32, color: &str) -> Svgr<'a> {
    if w <= 0.0 || h <= 0.0 { return fframes::svgr!(<g />); }
    fframes::svgr!(<rect x={x} y={y} width={w} height={h} fill={color.to_owned()} />)
}
pub(crate) fn rounded<'a>(x: f32, y: f32, w: f32, h: f32, r: f32, color: &str) -> Svgr<'a> {
    if w <= 0.0 || h <= 0.0 { return fframes::svgr!(<g />); }
    let r = r.min(w / 2.0).min(h / 2.0);
    fframes::svgr!(<rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill={color.to_owned()} />)
}
pub(crate) fn rule<'a>(x: f32, y: f32, w: f32, color: &str) -> Svgr<'a> { rect(x, y, w, 2.0, color) }
fn empty<'a>() -> Svgr<'a> { fframes::svgr!(<g />) }

pub(crate) struct Draw<'a, 'c, 'm> {
    pub b: &'a Beat,
    pub f: Frame,
    pub ctx: &'c FFramesContext<'a, 'm>,
    pub p: Palette,
    pub area: Area,
    /// Scene-local seconds.
    pub t: f32,
    pub wide: bool,
    pub m: MotionStyle,
    ids: Cell<usize>,
}

impl<'a, 'c, 'm> Draw<'a, 'c, 'm> {
    fn new(b: &'a Beat, f: Frame, ctx: &'c FFramesContext<'a, 'm>, area: Area) -> Self {
        let env = &b.environment;
        Draw { b, t: f.seconds(), f, ctx, p: Palette::from_theme(&env.theme), area, wide: env.width / env.height > 1.3,
            m: MotionStyle::new(&env.motion.preset, env.motion.intensity), ids: Cell::new(0) }
    }
    fn props(&self) -> &'a Value { &self.b.props }
    fn tall(&self) -> bool { self.b.environment.height > self.b.environment.width }
    /// Scene seconds of the final frame.
    pub(crate) fn last_frame(&self) -> f32 { self.b.frames.saturating_sub(1) as f32 / self.f.fps as f32 }
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
    pub(crate) fn run(&self, value: String, x: f32, baseline: f32, font: Font, size: f32, tracking: f32, color: &str) -> Svgr<'a> {
        if value.is_empty() { return empty(); }
        let weight = font.weight().to_string();
        if tracking.abs() > 1e-3 {
            fframes::svgr!(<text x={x} y={baseline} font-family={font.family()} font-weight={weight} font-size={size} letter-spacing={tracking} fill={color.to_owned()}>{value}</text>)
        } else {
            fframes::svgr!(<text x={x} y={baseline} font-family={font.family()} font-weight={weight} font-size={size} fill={color.to_owned()}>{value}</text>)
        }
    }
    /// One layout line, optionally recoloring whole-word phrases.
    fn line_node(&self, layout: &Layout, index: usize, x: f32, baseline: f32, color: &str, emphasis: &[Emphasis]) -> Svgr<'a> {
        let line = &layout.lines[index];
        let mut pieces: Vec<_> = emphasis.iter().filter(|e| e.0 == index).collect();
        if pieces.is_empty() {
            return self.run(line.text.clone(), x, baseline, layout.font, layout.size, layout.tracking_px, color);
        }
        pieces.sort_by_key(|e| e.1);
        // Split the line at phrase boundaries; each segment starts at its shaped offset.
        let mut out = vec![];
        let mut cursor = 0usize;
        let segment = |from: usize, to: usize, color: &str| self.run(line.text[from..to].to_owned(),
            x + text::offset(layout, index, from), baseline, layout.font, layout.size, layout.tracking_px, color);
        for (_, a, b, piece_color) in pieces {
            if *a < cursor { continue; } // Overlapping phrases keep the first color.
            if *a > cursor { out.push(segment(cursor, *a, color)); }
            out.push(segment(*a, *b, piece_color));
            cursor = *b;
        }
        if cursor < line.text.len() { out.push(segment(cursor, line.text.len(), color)); }
        fframes::svgr!(<g>{out}</g>)
    }
    fn emphasis(&self, layout: &Layout, phrases: &[String], color: &str) -> Vec<Emphasis> {
        phrases.iter().flat_map(|p| text::phrase_ranges(layout, p)).map(|(i, a, b)| (i, a, b, color.to_owned())).collect()
    }
    /// Static lines.
    pub(crate) fn draw(&self, layout: &Layout, x: f32, y: f32, w: f32, align: Align, color: &str) -> Svgr<'a> {
        let lines: Vec<_> = (0..layout.lines.len()).map(|i| {
            self.line_node(layout, i, align.x(x, w, layout.lines[i].width), y + i as f32 * layout.line_height + layout.baseline, color, &[])
        }).collect();
        fframes::svgr!(<g>{lines}</g>)
    }
    /// Lines rise into view through their own masks, one after another.
    pub(crate) fn lines(&self, layout: &Layout, x: f32, y: f32, w: f32, align: Align, color: &str, start: f32, emphasis: &[Emphasis]) -> Svgr<'a> {
        let mut out = vec![];
        for (i, line) in layout.lines.iter().enumerate() {
            let top = y + i as f32 * layout.line_height;
            let body = self.line_node(layout, i, align.x(x, w, line.width), top + layout.baseline, color, emphasis);
            let enter = self.m.enter(self.t - start - i as f32 * self.m.stagger());
            if enter.done() { out.push(body); continue; }
            if enter.hidden() { continue; }
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
        if value.trim().is_empty() { return (empty(), 0.0); }
        let layout = self.fit(value, style, box_.w, box_.h);
        (self.draw(&layout, box_.x, box_.y, box_.w, align, color), layout.height())
    }
    /// Backwards-compatible single call used by diagram code.
    pub(crate) fn paragraph(&self, value: &str, box_: Area, size: f32, color: &str, weight: u16, center: bool) -> Svgr<'a> {
        let style = if weight >= 600 { Style::strong(size) } else { Style::text(size) };
        self.para(value, box_, style, color, if center { Align::Center } else { Align::Left }).0
    }

    pub(crate) fn enter(&self, time: f32) -> Enter { self.m.enter(self.t - time) }
    /// Fade in while travelling `distance` pixels upward.
    pub(crate) fn rise(&self, body: Svgr<'a>, time: f32, distance: f32) -> Svgr<'a> {
        let e = self.enter(time);
        if e.hidden() { return empty(); }
        if e.done() { return body; }
        let dy = self.m.distance(distance) * (1.0 - e.travel);
        fframes::svgr!(<g opacity={e.alpha} transform={format!("translate(0 {dy})")}>{body}</g>)
    }
    /// Scale in around a point (badges, markers, cards).
    pub(crate) fn pop(&self, body: Svgr<'a>, time: f32, cx: f32, cy: f32) -> Svgr<'a> {
        let e = self.enter(time);
        if e.hidden() { return empty(); }
        if e.done() { return body; }
        let scale = 0.6 + 0.4 * self.m.pop(self.t - time);
        fframes::svgr!(<g opacity={e.alpha} transform={format!("translate({cx} {cy}) scale({scale}) translate({} {})", -cx, -cy)}>{body}</g>)
    }
    /// Current value of a count from `from` to `to` starting at `time`.
    pub(crate) fn count(&self, from: f64, to: f64, time: f32, duration: f32) -> f64 {
        from + (to - from) * self.m.grow(self.t - time, duration) as f64
    }

    /// A large numeral in tabular figures with smaller prefix/suffix units. Width is
    /// reserved for the final value so centred counters never drift while counting.
    pub(crate) fn numeral(&self, value: f64, final_value: f64, decimals: usize, prefix: &str, suffix: &str,
        x: f32, baseline: f32, size: f32, align_w: Option<f32>, color: &str, unit_color: &str) -> (Svgr<'a>, f32) {
        let (sign, digits) = number_parts(value, decimals);
        let (final_sign, final_digits) = number_parts(final_value, decimals);
        let (pfont, psize) = unit_style(prefix, size);
        let (sfont, ssize) = unit_style(suffix, size);
        let pw = text::measure(pfont, prefix, psize, 0.0);
        let body = format!("{sign}{digits}");
        let body_w = text::measure(Font::Figures, &body, size, 0.0);
        let reserve = text::measure(Font::Figures, &format!("{final_sign}{final_digits}"), size, 0.0).max(body_w);
        let sw = text::measure(sfont, suffix, ssize, 0.0);
        let gap = if suffix.starts_with(' ') || suffix.is_empty() { 0.0 } else { size * 0.03 };
        let pgap = if prefix.is_empty() || prefix.ends_with(' ') { 0.0 } else { size * 0.02 };
        let total = pw + pgap + reserve + gap + sw;
        let x0 = match align_w { Some(w) => x + (w - total) / 2.0, None => x };
        let nodes = vec![
            self.run(prefix.to_owned(), x0, baseline, pfont, psize, 0.0, unit_color),
            self.run(body, x0 + pw + pgap, baseline, Font::Figures, size, 0.0, color),
            // The suffix trails the current digits while counting and lands at its final place.
            self.run(suffix.to_owned(), x0 + pw + pgap + body_w + gap, baseline, sfont, ssize, 0.0, unit_color),
        ];
        (fframes::svgr!(<g>{nodes}</g>), total)
    }
    /// Largest numeral size (≤ `size`) whose final text fits `max_w`.
    pub(crate) fn numeral_size(&self, final_value: f64, decimals: usize, prefix: &str, suffix: &str, size: f32, max_w: f32) -> f32 {
        let (sign, digits) = number_parts(final_value, decimals);
        let width = |size: f32| {
            let (pfont, psize) = unit_style(prefix, size);
            let (sfont, ssize) = unit_style(suffix, size);
            text::measure(pfont, prefix, psize, 0.0) + text::measure(Font::Figures, &format!("{sign}{digits}"), size, 0.0)
                + text::measure(sfont, suffix, ssize, 0.0) + size * 0.05
        };
        let full = width(size);
        if full <= max_w { size } else { (size * max_w / full).floor().max(text::MIN_SIZE) }
    }

    /// Uppercase eyebrow with a short accent dash.
    fn kicker(&self, value: &str, x: f32, y: f32, w: f32, time: f32) -> (Svgr<'a>, f32) {
        if value.trim().is_empty() { return (empty(), 0.0); }
        let layout = self.fit(value, Style::kicker(22.0), w - 40.0, 60.0);
        let dash = rounded(x, y + layout.baseline - layout.size * 0.36, 26.0, 4.0, 2.0, &self.p.accent);
        let label = self.draw(&layout, x + 40.0, y, w - 40.0, Align::Left, &self.p.accent);
        (self.rise(fframes::svgr!(<g>{dash}{label}</g>), time, 10.0), layout.height())
    }
    fn shift(&self) -> f32 { if self.tall() { self.b.environment.height * 0.11 - 108.0 } else { 0.0 } }
    fn header(&self) -> Svgr<'a> {
        let (x, w) = (self.area.x, self.area.w);
        let shift = self.shift();
        let (kicker, _) = self.kicker(s(self.props(), "kicker"), x, 100.0 + shift, w, 0.0);
        let title = s(self.props(), "title");
        if title.trim().is_empty() { return kicker; }
        let style = Style::display(Font::Display, if self.wide { 62.0 } else { 56.0 }).leading(1.06);
        let layout = self.fit(title, style, if self.wide { w * 0.86 } else { w }, 150.0);
        let title = self.lines(&layout, x, 146.0 + shift, w, Align::Left, &self.p.ink, 0.06, &[]);
        fframes::svgr!(<g>{kicker}{title}</g>)
    }

    // ── Story blocks ────────────────────────────────────────────────────────────────
    /// Title, statement and endcard share an optically centred hero stack.
    fn hero(&self) -> Svgr<'a> {
        let a = self.area;
        let props = self.props();
        let block = self.b.block.as_str();
        let headline = nonempty(s(props, "text"), s(props, "title"));
        let support = nonempty(s(props, "support"), s(props, "context"));
        let start = self.b.cue_seconds;
        let (font, size, width) = match block {
            "title" => (Font::DisplayBold, if self.wide { 124.0 } else { 98.0 }, if self.wide { 0.9 } else { 1.0 }),
            "endcard" => (Font::DisplayBold, if self.wide { 108.0 } else { 88.0 }, if self.wide { 0.86 } else { 1.0 }),
            _ => (Font::Display, if self.wide { 96.0 } else { 80.0 }, if self.wide { 0.88 } else { 1.0 }),
        };
        let head = self.fit(headline, Style::display(font, size).leading(1.04), a.w * width, a.h * 0.62);
        let sup = (!support.trim().is_empty())
            .then(|| self.fit(support, Style::text(if self.wide { 36.0 } else { 34.0 }).leading(1.34), a.w * if self.wide { 0.66 } else { 1.0 }, a.h * 0.2));
        let action = s(props, "action");
        let pill = (block == "endcard" && !action.trim().is_empty())
            .then(|| self.fit(action, Style::strong(30.0), a.w - 64.0, 80.0));
        let bar_h = if block == "title" { 52.0 } else { 0.0 };
        let sup_h = sup.as_ref().map_or(0.0, |l| 40.0 + l.height());
        let pill_h = pill.as_ref().map_or(0.0, |l| 56.0 + l.height() + 36.0);
        let group = bar_h + head.height() + sup_h + pill_h;
        let top = a.y + ((a.h - group) * 0.42).max(0.0);
        let mut nodes = vec![];
        let emphasis = self.emphasis(&head, &phrases(props, "emphasis"), &self.p.accent);
        if block == "title" {
            let grow = self.m.grow(self.t - start + 0.1, 0.7);
            nodes.push(rounded(a.x, top, 96.0 * grow, 8.0, 4.0, &self.p.accent));
        }
        let head_y = top + bar_h;
        nodes.push(self.lines(&head, a.x, head_y, a.w, Align::Left, &self.p.ink, start, &emphasis));
        let after = start + head.lines.len() as f32 * self.m.stagger() + 0.18;
        if let Some(sup) = &sup {
            nodes.push(self.rise(self.draw(sup, a.x, head_y + head.height() + 40.0, a.w, Align::Left, &self.p.muted), after, 16.0));
        }
        if let Some(pill) = &pill {
            let y = head_y + head.height() + sup_h + 56.0;
            let (w, h) = (pill.width() + 64.0, pill.height() + 36.0);
            let body = fframes::svgr!(<g>{rounded(a.x, y, w, h, h / 2.0, &self.p.accent)}{self.draw(pill, a.x + 32.0, y + 18.0, pill.width(), Align::Left, &self.p.bg)}</g>);
            nodes.push(self.pop(body, after + 0.2, a.x + w / 2.0, y + h / 2.0));
        }
        let kicker_y = if self.tall() { self.b.environment.height * 0.11 } else { 108.0 };
        let (kicker, _) = self.kicker(s(props, "kicker"), a.x, kicker_y, a.w, 0.0);
        // A slow push-in keeps a held headline alive without moving the reading line much.
        let seconds = self.b.frames as f32 / self.f.fps as f32;
        let drift = 1.0 + 0.016 * self.m.intensity * motion::in_out_cubic(self.t / seconds.max(0.1));
        let (cx, cy) = (a.x, top + group / 2.0);
        fframes::svgr!(<g>{kicker}<g transform={format!("translate({cx} {cy}) scale({drift}) translate({} {})", -cx, -cy)}>{nodes}</g></g>)
    }
    fn chapter(&self) -> Svgr<'a> {
        let a = self.area;
        let props = self.props();
        let number = s(props, "number");
        let start = self.b.cue_seconds;
        let numeral_size = if self.wide { 300.0 } else { 240.0 };
        let num = self.fit(number, Style::display(Font::DisplayBold, numeral_size).leading(0.9), a.w, a.h * 0.5);
        let title = self.fit(s(props, "title"), Style::display(Font::Display, if self.wide { 92.0 } else { 76.0 }).leading(1.04), a.w * if self.wide { 0.8 } else { 1.0 }, a.h * 0.4);
        let sup = s(props, "support");
        let sup = (!sup.trim().is_empty()).then(|| self.fit(sup, Style::text(34.0), a.w * 0.8, a.h * 0.16));
        let group = num.height() + 36.0 + title.height() + sup.as_ref().map_or(0.0, |l| 32.0 + l.height());
        let top = a.y + ((a.h - group) * 0.45).max(0.0);
        let grow = self.m.grow(self.t - start - 0.25, 0.9);
        let line_y = top + num.height() + 12.0;
        let numeral = self.lines(&num, a.x, top, a.w, Align::Left, &self.p.accent, start, &[]);
        let line = rect(a.x, line_y, a.w * grow, 3.0, &self.p.line());
        let title_node = self.lines(&title, a.x, line_y + 24.0, a.w, Align::Left, &self.p.ink, start + 0.3, &self.emphasis(&title, &phrases(props, "emphasis"), &self.p.accent));
        let support = sup.map(|l| self.rise(self.draw(&l, a.x, line_y + 24.0 + title.height() + 32.0, a.w, Align::Left, &self.p.muted), start + 0.6, 14.0)).unwrap_or_else(empty);
        let (kicker, _) = self.kicker(s(props, "kicker"), a.x, if self.tall() { self.b.environment.height * 0.11 } else { 108.0 }, a.w, 0.0);
        fframes::svgr!(<g>{kicker}{numeral}{line}{title_node}{support}</g>)
    }
    /// A sentence with marker sweeps behind whole-word phrases, each on its own cue.
    fn highlight(&self) -> Svgr<'a> {
        let a = self.area;
        let props = self.props();
        let layout = self.fit(s(props, "text"), Style::display(Font::Display, if self.wide { 92.0 } else { 76.0 }).leading(1.14), a.w * if self.wide { 0.9 } else { 1.0 }, a.h * 0.72);
        let sup = s(props, "support");
        let sup = (!sup.trim().is_empty()).then(|| self.fit(sup, Style::text(34.0), a.w * 0.8, a.h * 0.18));
        let group = layout.height() + sup.as_ref().map_or(0.0, |l| 44.0 + l.height());
        let top = a.y + ((a.h - group) * 0.42).max(0.0);
        let start = self.b.cue_seconds;
        let mut markers = vec![];
        for (index, phrase) in arr(props, "phrases").iter().enumerate() {
            let value = phrase.as_str().or_else(|| phrase.get("text").and_then(Value::as_str)).unwrap_or("");
            let time = n(phrase, "at", (start + 0.7 + index as f32 * 0.6) as f64) as f32;
            let pieces = text::phrase_pieces(&layout, value);
            let total: f32 = pieces.iter().map(|(_, x0, x1)| x1 - x0).sum::<f32>().max(1.0);
            let sweep = self.m.grow(self.t - time, 0.35 + total / 2400.0);
            let mut covered = sweep * total;
            for (line, x0, x1) in pieces {
                let piece = (x1 - x0).min(covered.max(0.0));
                covered -= x1 - x0;
                let lx = a.x + x0 - layout.size * 0.08;
                let y = top + line as f32 * layout.line_height + layout.baseline - layout.size * 0.68;
                markers.push(rounded(lx, y, piece + layout.size * 0.16 * (piece / (x1 - x0)).min(1.0), layout.size * 0.84, 6.0, &self.p.wash(&self.p.accent)));
            }
        }
        let body = self.lines(&layout, a.x, top, a.w, Align::Left, &self.p.ink, start, &[]);
        let support = sup.map(|l| self.rise(self.draw(&l, a.x, top + layout.height() + 44.0, a.w, Align::Left, &self.p.muted), start + 0.5, 14.0)).unwrap_or_else(empty);
        let (kicker, _) = self.kicker(s(props, "kicker"), a.x, if self.tall() { self.b.environment.height * 0.11 } else { 108.0 }, a.w, 0.0);
        fframes::svgr!(<g>{kicker}<g>{markers}</g>{body}{support}</g>)
    }
    fn stat(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let (value, from, decimals) = (n(p, "value", 0.0), n(p, "from", 0.0), n(p, "decimals", 0.0) as usize);
        let (prefix, suffix) = (s(p, "prefix"), s(p, "suffix"));
        let size = self.numeral_size(value, decimals, prefix, suffix, if self.wide { 250.0 } else { 196.0 }, a.w);
        let label = self.fit(s(p, "label"), Style::display(Font::Display, if self.wide { 50.0 } else { 44.0 }), a.w * 0.9, a.h * 0.22);
        let context = nonempty(s(p, "context"), s(p, "support"));
        let context = (!context.trim().is_empty()).then(|| self.fit(context, Style::text(32.0), a.w * if self.wide { 0.7 } else { 1.0 }, a.h * 0.2));
        let number_h = size * 0.95;
        let group = number_h + 40.0 + 8.0 + 36.0 + label.height() + context.as_ref().map_or(0.0, |l| 18.0 + l.height());
        let top = a.y + ((a.h - group) * 0.45).max(0.0);
        let cue = self.b.cue_seconds;
        let current = self.count(from, value, cue, 1.4);
        let e = self.enter(cue - 0.1);
        let (number, width) = self.numeral(current, value, decimals, prefix, suffix, a.x, top + size * 0.78, size, None, &self.p.accent, &self.p.ink);
        let number = if e.hidden() { empty() } else { fframes::svgr!(<g opacity={e.alpha}>{number}</g>) };
        let bar_y = top + number_h + 40.0;
        let bar = rounded(a.x, bar_y, width.min(a.w) * self.m.grow(self.t - cue, 1.4) as f32 * 0.32 + 0.0, 8.0, 4.0, &self.p.accent);
        let label_y = bar_y + 8.0 + 36.0;
        let label_node = self.lines(&label, a.x, label_y, a.w, Align::Left, &self.p.ink, cue + 0.35, &[]);
        let context_node = context.map(|l| self.rise(self.draw(&l, a.x, label_y + label.height() + 18.0, a.w, Align::Left, &self.p.muted), cue + 0.6, 14.0)).unwrap_or_else(empty);
        fframes::svgr!(<g>{number}{bar}{label_node}{context_node}</g>)
    }
    fn kpis(&self) -> Svgr<'a> {
        let a = self.area;
        let items = arr(self.props(), "items");
        let count = items.len().max(1);
        let columns = if self.wide { count.min(4) } else if count > 3 { 2 } else { 1 };
        let rows = count.div_ceil(columns);
        let gap = 28.0;
        let cell_w = (a.w - gap * (columns as f32 - 1.0)) / columns as f32;
        let max_card_h = (a.h - gap * (rows as f32 - 1.0)) / rows as f32;
        let pad = if cell_w < 320.0 { 28.0 } else { 40.0 };
        let target = if self.wide { 112.0 } else if columns == 1 { 120.0 } else { 88.0 };
        let sizes: Vec<f32> = items.iter().map(|it| self.numeral_size(n(it, "value", 0.0), n(it, "decimals", 0.0) as usize, s(it, "prefix"), s(it, "suffix"), target, cell_w - 2.0 * pad)).collect();
        let size = sizes.iter().copied().fold(target, f32::min);
        let labels: Vec<_> = items.iter().map(|it| self.fit(s(it, "label"), Style::text(if self.wide { 30.0 } else { 32.0 }), cell_w - 2.0 * pad, (max_card_h - size - 2.0 * pad - 24.0).max(30.0))).collect();
        let label_h = labels.iter().map(|l| l.height()).fold(0.0, f32::max);
        let card_h = (pad * 2.0 + size * 0.95 + 20.0 + label_h + 10.0).min(max_card_h);
        let block_h = rows as f32 * card_h + gap * (rows as f32 - 1.0);
        let top = a.y + ((a.h - block_h) * 0.4).max(0.0);
        let mut shapes = vec![];
        for (i, item) in items.iter().enumerate() {
            let x = a.x + (i % columns) as f32 * (cell_w + gap);
            let y = top + (i / columns) as f32 * (card_h + gap);
            let time = at(item, self.b.cue_seconds, i);
            let current = self.count(n(item, "from", 0.0), n(item, "value", 0.0), time, 1.3);
            let (number, _) = self.numeral(current, n(item, "value", 0.0), n(item, "decimals", 0.0) as usize, s(item, "prefix"), s(item, "suffix"),
                x + pad, y + pad + size * 0.78, size, None, &self.p.accent, &self.p.ink);
            let card = rounded(x, y, cell_w, card_h, 26.0, &self.p.surface);
            let label = self.draw(&labels[i], x + pad, y + pad + size * 0.95 + 20.0, cell_w - 2.0 * pad, Align::Left, &self.p.ink);
            shapes.push(self.rise(fframes::svgr!(<g>{card}{number}{label}</g>), time, 30.0));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    fn delta(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let (from, to) = (&p["from"], &p["to"]);
        let (v0, v1) = (n(from, "value", 0.0), n(to, "value", 0.0));
        let decimals = n(p, "decimals", 0.0) as usize;
        let (prefix, suffix) = (s(p, "prefix"), s(p, "suffix"));
        let cue = self.b.cue_seconds;
        let column_w = if self.wide { a.w * 0.4 } else { a.w };
        let size = [v0, v1].iter().map(|v| self.numeral_size(*v, decimals, prefix, suffix, if self.wide { 150.0 } else { 140.0 }, column_w)).fold(f32::MAX, f32::min);
        let change = s(p, "change");
        let better = s(p, "better");
        let tone = match (better, v1.partial_cmp(&v0)) {
            ("up", Some(std::cmp::Ordering::Greater)) | ("down", Some(std::cmp::Ordering::Less)) => self.p.positive.clone(),
            ("up", Some(std::cmp::Ordering::Less)) | ("down", Some(std::cmp::Ordering::Greater)) => self.p.negative.clone(),
            _ => self.p.accent.clone(),
        };
        let mut shapes = vec![];
        let label_style = Style::kicker(22.0);
        let block_h = if self.wide { 44.0 + size } else { 2.0 * (44.0 + size) + 90.0 };
        let top = a.y + ((a.h - block_h - 120.0) * 0.4).max(0.0);
        let positions = if self.wide { [(a.x, top), (a.x + a.w * 0.56, top)] } else { [(a.x, top), (a.x, top + 44.0 + size + 90.0)] };
        for (i, (item, (x, y))) in [from, to].iter().zip(positions).enumerate() {
            let time = cue + i as f32 * 0.45;
            let label = self.fit(s(item, "label"), label_style, column_w, 40.0);
            let label = self.draw(&label, x, y, column_w, Align::Left, &self.p.muted);
            let current = if i == 0 { v0 } else { self.count(v0, v1, time, 1.3) };
            let (number, _) = self.numeral(current, if i == 0 { v0 } else { v1 }, decimals, prefix, suffix, x, y + 44.0 + size * 0.8, size, None,
                if i == 0 { &self.p.muted } else { &tone }, if i == 0 { &self.p.muted } else { &self.p.ink });
            shapes.push(self.rise(fframes::svgr!(<g>{label}{number}</g>), time, 24.0));
        }
        // The connecting arrow draws on between the two values.
        let draw = self.m.grow(self.t - cue - 0.25, 0.5);
        let (x1, y1, x2, y2) = if self.wide {
            (a.x + a.w * 0.43, top + 44.0 + size * 0.45, a.x + a.w * 0.52, top + 44.0 + size * 0.45)
        } else {
            (a.x + a.w - 60.0, top + 44.0 + size + 12.0, a.x + a.w - 60.0, top + 44.0 + size + 78.0)
        };
        shapes.push(diagrams::connector(x1, y1, x2, y2, draw, &self.p.muted));
        if !change.trim().is_empty() {
            let layout = self.fit(change, Style::strong(32.0), a.w - 60.0, 60.0);
            let y = top + block_h + 56.0;
            let (w, h) = (layout.width() + 48.0, layout.height() + 24.0);
            let chip = fframes::svgr!(<g>{rounded(a.x, y, w, h, h / 2.0, &self.p.wash(&tone))}{self.draw(&layout, a.x + 24.0, y + 12.0, layout.width(), Align::Left, &tone)}</g>);
            shapes.push(self.pop(chip, cue + 1.0, a.x + w / 2.0, y + h / 2.0));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    fn compare(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let verdict = s(p, "verdict");
        let reserved = if verdict.is_empty() { 0.0 } else { 104.0 };
        // Cards grow with their items but never stretch to fill a tall canvas.
        let most = arr(&p["left"], "items").len().max(arr(&p["right"], "items").len()) as f32;
        let card_h = 44.0 * 2.0 + 120.0 + most * if self.wide { 96.0 } else { 84.0 };
        let usable = (a.h - reserved).min(if self.wide { card_h } else { 2.0 * card_h + 32.0 });
        let a = Area { y: a.y + ((a.h - reserved - usable) * 0.35).max(0.0), h: usable + reserved, ..a };
        let gap = 32.0;
        let mut shapes = vec![];
        for (i, side) in [&p["left"], &p["right"]].iter().enumerate() {
            let (x, y, w, h) = if self.wide { (a.x + i as f32 * (a.w + gap) / 2.0, a.y, (a.w - gap) / 2.0, usable) }
                else { (a.x, a.y + i as f32 * (usable + gap) / 2.0, a.w, (usable - gap) / 2.0) };
            let accent = if i == 0 { self.p.muted.clone() } else { self.p.accent.clone() };
            let pad = if self.wide { 44.0 } else { 36.0 };
            let title = self.fit(s(side, "title"), Style::display(Font::Display, if self.wide { 44.0 } else { 40.0 }), w - 2.0 * pad, 110.0);
            let items = arr(side, "items");
            let body_top = y + pad + title.height() + 26.0;
            let row_h = (((y + h - pad) - body_top) / items.len().max(1) as f32).min(if self.wide { 96.0 } else { 84.0 });
            let time = self.b.cue_seconds + i as f32 * 0.35;
            let mut contents = vec![rounded(x, y, w, h, 28.0, &self.p.surface)];
            contents.push(self.draw(&title, x + pad, y + pad, w - 2.0 * pad, Align::Left, if i == 0 { &self.p.ink } else { &self.p.accent }));
            for (j, item) in items.iter().enumerate() {
                let item_y = body_top + j as f32 * row_h;
                let layout = self.fit(item.as_str().unwrap_or(""), Style::text(if self.wide { 32.0 } else { 30.0 }), w - 2.0 * pad - 34.0, (row_h - 8.0).max(20.0));
                let dot = fframes::svgr!(<circle cx={x + pad + 7.0} cy={item_y + layout.baseline - layout.size * 0.34} r="6" fill={accent.clone()} />);
                let line = self.draw(&layout, x + pad + 34.0, item_y, w - 2.0 * pad - 34.0, Align::Left, &self.p.ink);
                contents.push(self.rise(fframes::svgr!(<g>{dot}{line}</g>), time + 0.25 + j as f32 * 0.12, 12.0));
            }
            shapes.push(self.rise(fframes::svgr!(<g>{contents}</g>), time, 26.0));
        }
        if !verdict.is_empty() {
            let layout = self.fit(verdict, Style::strong(32.0), a.w - 40.0, 76.0);
            let y = a.y + a.h - reserved + 32.0;
            let body = fframes::svgr!(<g>{rounded(a.x, y, 6.0, layout.height(), 3.0, &self.p.accent)}{self.draw(&layout, a.x + 26.0, y, a.w - 26.0, Align::Left, &self.p.accent)}</g>);
            shapes.push(self.rise(body, self.b.cue_seconds + 0.9, 14.0));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    fn quote(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let indent = if self.wide { 150.0 } else { 0.0 };
        let mark_size = if self.wide { 300.0 } else { 220.0 };
        let top_pad = if self.wide { 0.0 } else { mark_size * 0.42 };
        let quote = self.fit(s(p, "text"), Style::display(Font::DisplayLight, if self.wide { 70.0 } else { 58.0 }).leading(1.16), a.w - indent, a.h * 0.64 - top_pad);
        let author = self.fit(s(p, "author"), Style::strong(30.0), a.w - indent - 60.0, 44.0);
        let role = s(p, "role");
        let role = (!role.trim().is_empty()).then(|| self.fit(role, Style::text(26.0), a.w - indent - 60.0, 70.0));
        let group = top_pad + quote.height() + 48.0 + author.height() + role.as_ref().map_or(0.0, |l| 6.0 + l.height());
        let top = a.y + ((a.h - group) * 0.42).max(0.0);
        let cue = self.b.cue_seconds;
        let mark = self.rise(self.run("“".into(), a.x - mark_size * 0.06, top + mark_size * 0.62, Font::DisplayBold, mark_size, 0.0, &self.p.accent), cue - 0.1, 20.0);
        let x = a.x + indent;
        let text_top = top + top_pad;
        let body = self.lines(&quote, x, text_top, a.w - indent, Align::Left, &self.p.ink, cue, &self.emphasis(&quote, &phrases(p, "emphasis"), &self.p.accent));
        let after = cue + quote.lines.len() as f32 * self.m.stagger() + 0.25;
        let by = text_top + quote.height() + 48.0;
        let byline = fframes::svgr!(<g>
            {rect(x, by + author.baseline - author.size * 0.36, 40.0, 3.0, &self.p.accent)}
            {self.draw(&author, x + 60.0, by, a.w - indent - 60.0, Align::Left, &self.p.accent)}
            {role.as_ref().map(|l| self.draw(l, x + 60.0, by + author.height() + 6.0, a.w - indent - 60.0, Align::Left, &self.p.muted)).unwrap_or_else(empty)}
        </g>);
        fframes::svgr!(<g>{mark}{body}{self.rise(byline, after, 12.0)}</g>)
    }
    fn list(&self) -> Svgr<'a> {
        let a = self.area;
        let items = arr(self.props(), "items");
        let row_h = (a.h / items.len().max(1) as f32).min(170.0);
        let top = a.y + ((a.h - row_h * items.len() as f32) * 0.35).max(0.0);
        let mut shapes = vec![];
        for (i, item) in items.iter().enumerate() {
            let y = top + i as f32 * row_h;
            let time = at(item, self.b.cue_seconds, i);
            let grow = self.m.grow(self.t - time, 0.6);
            let index_w = if self.wide { 110.0 } else { 92.0 };
            let value = nonempty(s(item, "text"), item.as_str().unwrap_or(""));
            let layout = self.fit(value, Style::display(Font::Display, if self.wide { 46.0 } else { 42.0 }).leading(1.12), a.w - index_w, row_h - 36.0);
            let number = self.run(format!("{:02}", i + 1), a.x, y + 20.0 + layout.baseline, Font::DisplayBold, layout.size.min(46.0), 0.0, &self.p.accent);
            let line = rect(a.x, y, a.w * grow, 2.0, &self.p.line());
            let text = self.draw(&layout, a.x + index_w, y + 20.0, a.w - index_w, Align::Left, &self.p.ink);
            shapes.push(fframes::svgr!(<g>{line}{self.rise(fframes::svgr!(<g>{number}{text}</g>), time, 20.0)}</g>));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    fn matrix(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let columns = arr(p, "columns");
        let rows = arr(p, "rows");
        let highlight = p.get("highlight").and_then(Value::as_u64).map(|v| v as usize);
        let first = a.w * if self.wide { 0.28 } else { 0.32 };
        let col_w = (a.w - first) / columns.len().max(1) as f32;
        let row_h = (a.h / (rows.len() + 1) as f32).min(150.0);
        let top = a.y + ((a.h - row_h * (rows.len() + 1) as f32) * 0.3).max(0.0);
        let mut shapes = vec![];
        if let Some(column) = highlight.filter(|c| *c < columns.len()) {
            let e = self.enter(self.b.cue_seconds + 0.6);
            shapes.push(fframes::svgr!(<g opacity={e.alpha}>{rounded(a.x + first + column as f32 * col_w, top, col_w, row_h * (rows.len() + 1) as f32, 22.0, &self.p.wash(&self.p.accent))}</g>));
        }
        for (i, col) in columns.iter().enumerate() {
            let x = a.x + first + i as f32 * col_w + 20.0;
            let (node, _) = self.para(col.as_str().unwrap_or(""), Area { x, y: top + 24.0, w: col_w - 40.0, h: row_h - 40.0 }, Style::strong(30.0),
                if highlight == Some(i) { &self.p.accent } else { &self.p.ink }, Align::Left);
            shapes.push(self.rise(node, self.b.cue_seconds, 10.0));
        }
        shapes.push(rect(a.x, top + row_h - 2.0, a.w * self.m.grow(self.t - self.b.cue_seconds, 0.7), 3.0, &self.p.ink));
        for (i, row) in rows.iter().enumerate() {
            let y = top + (i + 1) as f32 * row_h;
            let mut cells = vec![rule(a.x, y + row_h - 1.0, a.w, &self.p.line())];
            cells.push(self.para(s(row, "label"), Area { x: a.x + 4.0, y: y + 22.0, w: first - 28.0, h: row_h - 36.0 }, Style::strong(30.0), &self.p.ink, Align::Left).0);
            for (j, value) in arr(row, "values").iter().enumerate() {
                let color = if highlight == Some(j) { &self.p.ink } else { &self.p.muted };
                cells.push(self.para(value.as_str().unwrap_or(""), Area { x: a.x + first + j as f32 * col_w + 20.0, y: y + 22.0, w: col_w - 40.0, h: row_h - 36.0 }, Style::text(30.0), color, Align::Left).0);
            }
            shapes.push(self.rise(fframes::svgr!(<g>{cells}</g>), self.b.cue_seconds + 0.15 + i as f32 * 0.14, 14.0));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    fn equation(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let cue = self.b.cue_seconds;
        let expression = self.fit(s(p, "expression"), Style::display(Font::DisplayLight, if self.wide { 88.0 } else { 72.0 }), a.w, a.h * 0.3);
        let result = self.fit(s(p, "result"), Style::display(Font::DisplayBold, if self.wide { 116.0 } else { 92.0 }), a.w, a.h * 0.3);
        let why = s(p, "explanation");
        let why = (!why.trim().is_empty()).then(|| self.fit(why, Style::text(32.0), a.w * if self.wide { 0.7 } else { 1.0 }, a.h * 0.2));
        let group = expression.height() + 36.0 + 3.0 + 32.0 + result.height() + why.as_ref().map_or(0.0, |l| 36.0 + l.height());
        let top = a.y + ((a.h - group) * 0.42).max(0.0);
        let rule_y = top + expression.height() + 36.0;
        let mut nodes = vec![self.lines(&expression, a.x, top, a.w, Align::Left, &self.p.muted, cue, &[])];
        nodes.push(rect(a.x, rule_y, a.w * self.m.grow(self.t - cue - 0.3, 0.6), 3.0, &self.p.line()));
        nodes.push(self.lines(&result, a.x, rule_y + 35.0, a.w, Align::Left, &self.p.accent, cue + 0.6, &[]));
        if let Some(why) = why {
            nodes.push(self.rise(self.draw(&why, a.x, rule_y + 35.0 + result.height() + 36.0, a.w, Align::Left, &self.p.ink), cue + 1.0, 14.0));
        }
        fframes::svgr!(<g>{nodes}</g>)
    }
    fn callout(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let icon = s(p, "icon");
        let pad = if self.wide { 64.0 } else { 48.0 };
        let icon_w = if icon.is_empty() { 0.0 } else { 104.0 };
        let inner = a.w - 2.0 * pad - icon_w - 12.0;
        let label = s(p, "label");
        let label = (!label.trim().is_empty()).then(|| self.fit(label, Style::kicker(22.0), inner, 60.0));
        let body = self.fit(s(p, "text"), Style::display(Font::Display, if self.wide { 76.0 } else { 62.0 }).leading(1.08), inner, a.h * 0.5);
        let sup = s(p, "support");
        let sup = (!sup.trim().is_empty()).then(|| self.fit(sup, Style::text(32.0), inner, a.h * 0.24));
        let content = label.as_ref().map_or(0.0, |l| l.height() + 22.0) + body.height() + sup.as_ref().map_or(0.0, |l| 26.0 + l.height());
        let card_h = (content + 2.0 * pad).min(a.h);
        let top = a.y + ((a.h - card_h) * 0.42).max(0.0);
        let cue = self.b.cue_seconds;
        let x = a.x + pad + 12.0 + icon_w;
        let mut nodes = vec![rounded(a.x, top, a.w, card_h, 30.0, &self.p.surface), rounded(a.x, top, 12.0, card_h, 6.0, &self.p.accent)];
        if !icon.is_empty() {
            let (cx, cy) = (a.x + pad + 12.0 + 38.0, top + pad + 38.0);
            let badge = fframes::svgr!(<g>
                <circle cx={cx} cy={cy} r="38" fill={self.p.wash(&self.p.accent)} />
                {crate::icons::render(icon, cx - 22.0, cy - 22.0, 44.0, &self.p.accent)}
            </g>);
            nodes.push(self.pop(badge, cue + 0.1, cx, cy));
        }
        let mut y = top + pad;
        if let Some(label) = &label {
            nodes.push(self.draw(label, x, y, inner, Align::Left, &self.p.accent));
            y += label.height() + 22.0;
        }
        nodes.push(self.lines(&body, x, y, inner, Align::Left, &self.p.ink, cue + 0.1, &self.emphasis(&body, &phrases(p, "emphasis"), &self.p.accent)));
        y += body.height() + 26.0;
        if let Some(sup) = &sup {
            nodes.push(self.rise(self.draw(sup, x, y, inner, Align::Left, &self.p.muted), cue + 0.5, 12.0));
        }
        self.rise(fframes::svgr!(<g>{nodes}</g>), cue - 0.15, 24.0)
    }

    // ── Speech ──────────────────────────────────────────────────────────────────────
    fn word_layout(&self, words: &[Caption], box_: Area, size: f32, mode: &str, center: bool, max_words: usize, max_gap: f32, max_duration: f32, caption: bool) -> Svgr<'a> {
        if words.is_empty() { return empty(); }
        let current = active_word(words, self.t);
        let font = if caption { Font::TextStrong } else { Font::Display };
        if mode == "word" {
            let Some(i) = current else { return empty() };
            let layout = self.fit(&words[i].text, Style::display(Font::DisplayBold, size * 1.35), box_.w, box_.h);
            let pop = 0.9 + 0.1 * self.m.pop(self.t - words[i].start);
            let (cx, cy) = (box_.x + box_.w / 2.0, box_.y + box_.h / 2.0);
            let y = box_.y + (box_.h - layout.height()) / 2.0;
            let node = self.draw(&layout, box_.x, y, box_.w, if center { Align::Center } else { Align::Left }, &self.p.accent);
            return fframes::svgr!(<g transform={format!("translate({cx} {cy}) scale({pop}) translate({} {})", -cx, -cy)}>{node}</g>);
        }
        let window = word_window(words, self.t, max_words, max_gap, max_duration);
        let start = window.start;
        let chunk = &words[window];
        let line_gap = if caption { 1.28 } else { 1.14 };
        let mut size = size;
        let mut lines: Vec<Vec<(usize, f32)>>;
        loop {
            lines = vec![vec![]];
            let mut width = 0.0;
            let space = text::measure(font, " ", size, 0.0);
            let mut too_wide = false;
            for (i, word) in chunk.iter().enumerate() {
                let word_width = text::measure(font, &word.text, size, 0.0);
                if word_width > box_.w { too_wide = true; }
                if width + word_width > box_.w && !lines.last().unwrap().is_empty() { lines.push(vec![]); width = 0.0; }
                lines.last_mut().unwrap().push((i, word_width));
                width += word_width + space;
            }
            if size <= 18.0 || (!too_wide && lines.len() as f32 * size * line_gap <= box_.h) { break; }
            size -= 1.0;
        }
        let space = text::measure(font, " ", size, 0.0);
        let total_height = lines.len() as f32 * size * line_gap;
        let mut shapes = vec![];
        if caption {
            let widest = lines.iter().map(|l| l.iter().map(|(_, w)| w).sum::<f32>() + space * l.len().saturating_sub(1) as f32).fold(0.0, f32::max);
            let plate_w = widest + 44.0;
            let plate_x = box_.x + if center { (box_.w - plate_w) / 2.0 } else { -22.0 };
            let plate_y = box_.y + (box_.h - total_height) / 2.0 - 12.0;
            shapes.push(fframes::svgr!(<g opacity="0.88">{rounded(plate_x, plate_y, plate_w, total_height + 24.0, 18.0, &self.p.bg)}</g>));
        }
        for (line_index, line) in lines.iter().enumerate() {
            let line_width = line.iter().map(|(_, w)| w).sum::<f32>() + space * line.len().saturating_sub(1) as f32;
            let mut x = box_.x + if center { (box_.w - line_width) / 2.0 } else { 0.0 };
            let y = box_.y + (box_.h - total_height) / 2.0 + size * 0.92 + line_index as f32 * size * line_gap;
            for &(i, width) in line {
                let word = &chunk[i];
                let active = current == Some(start + i);
                let spoken = self.t >= word.start;
                let (color, opacity) = match mode {
                    _ if active => (self.p.accent.clone(), 1.0),
                    "reveal" => (self.p.ink.clone(), if spoken { 1.0 } else { 0.0 }),
                    _ if spoken => (self.p.ink.clone(), 1.0),
                    _ => (if caption { self.p.muted.clone() } else { self.p.ink.clone() }, if caption { 1.0 } else { 0.32 }),
                };
                if opacity > 0.0 {
                    let run = self.run(word.text.clone(), x, y, font, size, 0.0, &color);
                    if mode == "reveal" && !caption {
                        // Each word rises a few pixels as it is spoken.
                        let e = self.m.enter_over(self.t - word.start, 0.22);
                        let dy = (1.0 - e.travel) * size * 0.18;
                        shapes.push(fframes::svgr!(<g opacity={e.alpha} transform={format!("translate(0 {dy})")}>{run}</g>));
                    } else if opacity < 1.0 {
                        shapes.push(fframes::svgr!(<g opacity={opacity}>{run}</g>));
                    } else {
                        shapes.push(run);
                    }
                }
                x += width + space;
            }
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    fn kinetic(&self) -> Svgr<'a> {
        let p = self.props();
        self.word_layout(&self.b.words, self.area, if self.wide { 104.0 } else { 86.0 }, nonempty(s(p, "mode"), "highlight"),
            s(p, "align") == "center", n(p, "maxWords", 7.0) as usize, n(p, "maxGap", 0.6) as f32, n(p, "maxDuration", 4.0) as f32, false)
    }
    fn footer(&self) -> Svgr<'a> {
        let env = &self.b.environment;
        let tall = env.height > env.width;
        let source_y = env.height - if env.captions { if tall { 320.0 } else { 160.0 } } else { 92.0 };
        let (source, _) = self.para(s(self.props(), "source"), Area { x: self.area.x, y: source_y, w: self.area.w, h: 60.0 }, Style::text(22.0), &self.p.muted, Align::Left);
        let mut captions = empty();
        if env.captions && self.b.block != "kinetic" {
            let box_ = Area { x: self.area.x, y: env.height - if tall { 242.0 } else { 104.0 }, w: self.area.w, h: if tall { 112.0 } else { 78.0 } };
            if !self.b.words.is_empty() {
                captions = self.word_layout(&self.b.words, box_, 34.0, "highlight", true, if self.wide { 12 } else { 7 }, 0.6, 4.0, true);
            } else if let Some(cue) = self.b.captions.iter().find(|c| self.t >= c.start && self.t < c.end) {
                let layout = self.fit(&cue.text, Style::strong(32.0), box_.w - 44.0, box_.h);
                let (w, h) = (layout.width() + 44.0, layout.height() + 24.0);
                let x = box_.x + (box_.w - w) / 2.0;
                let y = box_.y + (box_.h - h) / 2.0;
                captions = fframes::svgr!(<g>
                    <g opacity="0.88">{rounded(x, y, w, h, 18.0, &self.p.bg)}</g>
                    {self.draw(&layout, x + 22.0, y + 12.0, layout.width(), Align::Left, &self.p.ink)}
                </g>);
            }
        }
        fframes::svgr!(<g>{source}{captions}</g>)
    }
}

/// Word units ("days", "people") sit small beside a numeral; symbols ("%", "k", "$") larger.
fn unit_style(part: &str, size: f32) -> (Font, f32) {
    let word = part.trim().chars().count() > 2 && part.trim().chars().any(char::is_alphabetic);
    if word { (Font::Display, size * 0.34) } else { (Font::DisplayBold, size * 0.56) }
}

const HERO: [&str; 3] = ["title", "statement", "endcard"];

pub fn render<'a>(b: &'a Beat, frame: Frame, ctx: &FFramesContext<'a, '_>) -> Svgr<'a> {
    let env = &b.environment;
    let wide = env.width / env.height > 1.3;
    let x = if wide { 120.0 } else { 86.0 };
    let bottom = if env.captions { if env.height > env.width { 365.0 } else { 215.0 } } else { 145.0 };
    let hero = HERO.contains(&b.block.as_str()) || matches!(b.block.as_str(), "chapter" | "highlight");
    let portrait_shift = if env.height > env.width { env.height * 0.11 - 108.0 } else { 0.0 };
    let headless = s(&b.props, "title").trim().is_empty() && s(&b.props, "kicker").trim().is_empty();
    let top = if hero { 235.0 + portrait_shift }
        else if headless && matches!(b.block.as_str(), "image" | "video" | "annotate" | "kinetic") { 200.0 + portrait_shift }
        else { 335.0 + portrait_shift };
    let d = Draw::new(b, frame, ctx, Area { x, y: top, w: env.width - x * 2.0, h: env.height - top - bottom });
    let header = if hero { empty() } else { d.header() };
    let body = match b.block.as_str() {
        "title" | "statement" | "endcard" => d.hero(),
        "chapter" => d.chapter(), "highlight" => d.highlight(),
        "stat" => d.stat(), "kpis" => d.kpis(), "delta" => d.delta(),
        "bars" => d.bars(), "line" => d.line(), "waffle" => d.waffle(), "ring" => d.ring(),
        "donut" => d.donut(), "funnel" => d.funnel(), "magnitude" => d.magnitude(),
        "compare" => d.compare(), "matrix" => d.matrix(), "quote" => d.quote(), "list" => d.list(),
        "equation" => d.equation(), "callout" => d.callout(),
        "steps" => d.steps(), "timeline" => d.timeline(), "checklist" => d.checklist(),
        "icon-grid" => d.icon_grid(), "flow" => d.flow(), "cycle" => d.cycle(), "breathing" => d.breathing(),
        "image" => d.media(false), "video" => d.media(true), "annotate" => d.annotate(),
        "kinetic" => d.kinetic(),
        _ => panic!("unsupported block {}", b.block),
    };
    let footer = d.footer();
    scene_motion(&d, header, body, footer)
}

/// The scene-level entrance over the persistent backdrop, then the exit that mirrors the
/// next scene's entrance. Neither cross-dissolves two scenes.
fn scene_motion<'a>(d: &Draw<'a, '_, '_>, header: Svgr<'a>, body: Svgr<'a>, footer: Svgr<'a>) -> Svgr<'a> {
    let b = d.b;
    let env = &b.environment;
    let (w, h) = (env.width, env.height);
    let enter = d.m.enter(d.t);
    let distance = d.m.distance(36.0);
    let (opacity, transform, clip) = match b.transition.as_str() {
        "fade" => (enter.alpha, String::new(), w),
        "rise" => (enter.alpha, format!("translate(0 {})", distance * (1.0 - enter.travel)), w),
        "push" => (1.0, format!("translate({} 0)", w * (1.0 - motion::out_expo(d.t / (d.m.duration() + 0.15)))), w),
        "zoom" => {
            let scale = 1.0 - 0.05 * d.m.intensity * (1.0 - enter.travel);
            (enter.alpha, format!("translate({} {}) scale({scale})", w * (1.0 - scale) / 2.0, h * (1.0 - scale) / 2.0), w)
        }
        "wipe" => (1.0, String::new(), w * motion::in_out_cubic(d.t / (d.m.duration() + 0.25))),
        _ => (1.0, String::new(), w),
    };
    let seconds = b.frames as f32 / d.f.fps as f32;
    let final_scene = env.index + 1 == env.total;
    let exit_kind = ExitKind::parse(&b.exit).unwrap_or(ExitKind::None);
    let exit_seconds = if final_scene { 0.8 } else { match d.m.preset { motion::Preset::Snappy => 0.22, motion::Preset::Spring => 0.36, motion::Preset::Gentle => 0.32 } };
    let last_word = b.words.last().map_or(0.0, |w| w.end);
    // Never leave while the entrance is still running.
    let earliest = last_word.max(d.m.duration() + 0.25);
    let x = if exit_kind == ExitKind::None { 0.0 } else { motion::exit_progress(d.t, seconds, exit_seconds, earliest) };
    let mut exit_opacity = 1.0;
    let mut exit_transform = String::new();
    let mut exit_clip = (0.0, w);
    if x > 0.0 {
        match exit_kind {
            ExitKind::Fade => { exit_opacity = 1.0 - x; if !final_scene { exit_transform = format!("translate(0 {})", -d.m.distance(22.0) * x); } }
            ExitKind::Push => { exit_opacity = 1.0 - x * 0.6; exit_transform = format!("translate({} 0)", -w * 0.35 * x); }
            ExitKind::Zoom => {
                let scale = 1.0 + 0.04 * d.m.intensity.max(0.3) * x;
                exit_opacity = 1.0 - x;
                exit_transform = format!("translate({} {}) scale({scale})", w * (1.0 - scale) / 2.0, h * (1.0 - scale) / 2.0);
            }
            ExitKind::Wipe => { exit_clip = (w * x, w - w * x); }
            ExitKind::None => {}
        }
    }
    if clip <= 0.0 { return layer(d, footer, exit_opacity, &exit_transform, None, h); }
    let content = layer(d, fframes::svgr!(<g>{header}{body}</g>), opacity, &transform, (clip < w - 0.5).then_some((0.0, clip)), h);
    let exit_clip = (exit_clip.0 > 0.5).then_some(exit_clip);
    layer(d, fframes::svgr!(<g>{content}{footer}</g>), exit_opacity, &exit_transform, exit_clip, h)
}

/// Wrap a layer in opacity/transform/clip groups only when they change anything.
fn layer<'a>(d: &Draw<'a, '_, '_>, body: Svgr<'a>, opacity: f32, transform: &str, clip: Option<(f32, f32)>, h: f32) -> Svgr<'a> {
    let body = if opacity < 0.999 || !transform.is_empty() {
        let transform = if transform.is_empty() { "translate(0 0)".to_owned() } else { transform.to_owned() };
        fframes::svgr!(<g opacity={opacity.clamp(0.0, 1.0)} transform={transform}>{body}</g>)
    } else { body };
    match clip {
        Some((x, width)) => {
            let id = d.uid("clip");
            fframes::svgr!(<g>
                <defs><clipPath id={id.clone()}><rect x={x} y="0" width={width.max(0.0)} height={h} /></clipPath></defs>
                <g clip-path={format!("url(#{id})")}>{body}</g>
            </g>)
        }
        None => body,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn context<'a>() -> FFramesContext<'a, 'a> {
        FFramesContext { time_base: fframes::TimeBase { fps: 30, sample_rate: 48000 },
            current_video_size: fframes::VideoSize { width: 1920, height: 1080 }, duration_in_frames: 60,
            mode: fframes::FFramesMode::Renderer, scenes: None, media_source: None, font_source: None, abort_signal: None }
    }
    #[test]
    fn empty_paragraphs_emit_no_text_even_without_layout_space() {
        let beat: Beat = serde_json::from_value(serde_json::json!({"id":"empty","block":"statement","frames":60,
            "start_frame":0,"cue_seconds":0,"props":{"text":"Test"}})).unwrap();
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
        let image = std::sync::Arc::new(fframes::usvgr::PreloadedImageData::new("test.mp4___frame___0.png".into(), 1, 1, &[40, 80, 160, 255]));
        let plate = fframes::svgr!(<image x="10" y="10" width="80" height="80" href={image} />);
        let wrapped = fframes::svgr!(<g>{plate}</g>);
        let svg = fframes::svgr!(<svg width="100" height="100" viewBox="0 0 100 100">{wrapped}</svg>);
        let tree = svg.into_svg_tree(&Default::default(), &mut fframes::usvgr::Cache::new_with_text_cache(1), &Default::default()).unwrap();
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
        let words = vec![Caption { text: "one".into(), start: 0.1, end: 0.5 }, Caption { text: "two".into(), start: 0.6, end: 1.0 }];
        assert_eq!(active_word(&words, 0.0), None); assert_eq!(active_word(&words, 0.1), Some(0));
        assert_eq!(active_word(&words, 0.5), None); assert_eq!(active_word(&words, 0.6), Some(1));
        assert_eq!(active_word(&words, 1.0), None); assert_eq!(active_word(&words, 0.2), Some(0));
    }
    #[test]
    fn phrases_split_on_word_limit_silence_and_duration_without_changing_timestamps() {
        let words = vec![
            Caption { text: "Observe".into(), start: 0.0, end: 0.4 }, Caption { text: "closely".into(), start: 0.5, end: 0.9 },
            Caption { text: "Then".into(), start: 2.0, end: 2.3 }, Caption { text: "begin".into(), start: 2.4, end: 2.8 },
            Caption { text: "again".into(), start: 2.9, end: 3.4 }];
        assert_eq!(word_window(&words, 0.2, 7, 0.6, 4.0), 0..2);
        assert_eq!(word_window(&words, 1.8, 7, 0.6, 4.0), 0..2);
        assert_eq!(active_word(&words, 1.8), None);
        assert_eq!(word_window(&words, 2.0, 7, 0.6, 4.0), 2..5);
        assert_eq!(word_window(&words, 3.1, 7, 0.6, 1.0), 4..5);
        assert_eq!(word_window(&words, 2.5, 1, 0.6, 4.0), 3..4);
        assert_eq!(words[2].start, 2.0); assert_eq!(words[4].end, 3.4);
    }
    #[test]
    fn emphasis_segments_cover_the_line_without_losing_characters() {
        let beat: Beat = serde_json::from_value(serde_json::json!({"id":"e","block":"statement","frames":60,
            "start_frame":0,"cue_seconds":0,"props":{"text":"x"}})).unwrap();
        let ctx = context();
        let draw = Draw::new(&beat, Frame::new(59, 59, 30), &ctx, Area { x: 0.0, y: 0.0, w: 1600.0, h: 600.0 });
        let layout = draw.fit("An average can hide a long tail.", Style::display(Font::Display, 80.0), 1600.0, 600.0);
        let emphasis = draw.emphasis(&layout, &["long tail".to_owned()], "#ff0000");
        let tree = format!("{:?}", draw.draw_emphasized(&layout, &emphasis));
        for piece in ["An average can hide a ", "long tail", "."] { assert!(tree.contains(piece), "missing {piece}: {tree}"); }
        assert!(tree.contains("#ff0000"));
    }
}

#[cfg(test)]
impl<'a> Draw<'a, '_, '_> {
    fn draw_emphasized(&self, layout: &Layout, emphasis: &[Emphasis]) -> Svgr<'a> {
        let lines: Vec<_> = (0..layout.lines.len()).map(|i| self.line_node(layout, i, 0.0, layout.baseline, "#000000", emphasis)).collect();
        fframes::svgr!(<g>{lines}</g>)
    }
}
