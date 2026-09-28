//! Text measurement and layout with the same shaper (rustybuzz) and font files the SVG
//! renderer uses, so wrapped lines, centering and fitted sizes match the pixels exactly.
//! Layouts are frame-independent and cached; counters use fixed digit slots so a
//! changing value never jitters or reflows.
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
/// `Figures` is Inter Display Bold with its designed tabular digits as the default glyphs,
/// so counters keep a constant width without hand-spaced digit slots.
pub enum Font { Text, TextStrong, DisplayLight, Display, DisplayBold, Figures }

impl Font {
    const ALL: [Font; 6] = [Font::Text, Font::TextStrong, Font::DisplayLight, Font::Display, Font::DisplayBold, Font::Figures];
    pub fn family(self) -> &'static str {
        match self { Font::Text | Font::TextStrong => "Inter", Font::Figures => "Inter Display Figures", _ => "Inter Display" }
    }
    pub fn weight(self) -> u16 {
        match self { Font::Text => 400, Font::TextStrong | Font::Display => 600, Font::DisplayLight => 300, Font::DisplayBold | Font::Figures => 700 }
    }
    fn file(self) -> &'static str {
        match self {
            Font::Text => "Inter-Regular.ttf", Font::TextStrong => "Inter-SemiBold.ttf",
            Font::DisplayLight => "InterDisplay-Light.ttf", Font::Display => "InterDisplay-SemiBold.ttf",
            Font::DisplayBold => "InterDisplay-Bold.ttf", Font::Figures => "InterDisplay-Figures.ttf",
        }
    }
    fn index(self) -> usize { Font::ALL.iter().position(|f| *f == self).unwrap() }
}

static FONT_DIR: OnceLock<PathBuf> = OnceLock::new();
static FACES: OnceLock<Vec<rustybuzz::Face<'static>>> = OnceLock::new();

/// Use the prepared job's font copies. Tests and tools fall back to the bundled assets.
pub fn use_font_dir(dir: &Path) { let _ = FONT_DIR.set(dir.to_path_buf()); }

fn faces() -> &'static [rustybuzz::Face<'static>] {
    FACES.get_or_init(|| {
        let dir = FONT_DIR.get().cloned()
            .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")).join("../assets/fonts"));
        Font::ALL.iter().map(|font| {
            let path = dir.join(font.file());
            let bytes: &'static [u8] = Box::leak(std::fs::read(&path)
                .unwrap_or_else(|e| panic!("bundled font {} is unavailable: {e}", path.display())).into_boxed_slice());
            rustybuzz::Face::from_slice(bytes, 0)
                .unwrap_or_else(|| panic!("bundled font {} could not be parsed", path.display()))
        }).collect()
    })
}

/// True when the bundled font can draw every non-space character.
pub fn covers(font: Font, text: &str) -> Option<char> {
    let face = &faces()[font.index()];
    text.chars().find(|c| !c.is_whitespace() && !c.is_control() && face.glyph_index(*c).is_none())
}

/// Advance width in pixels, including letter-spacing between (not after) clusters,
/// exactly as usvgr applies it.
pub fn measure(font: Font, text: &str, size: f32, tracking: f32) -> f32 {
    if text.is_empty() { return 0.0; }
    let face = &faces()[font.index()];
    let mut buffer = rustybuzz::UnicodeBuffer::new();
    buffer.push_str(text);
    let output = rustybuzz::shape(face, &[], buffer);
    let units: i32 = output.glyph_positions().iter().map(|p| p.x_advance).sum();
    let mut clusters: Vec<u32> = output.glyph_infos().iter().map(|g| g.cluster).collect();
    clusters.dedup();
    units as f32 * size / face.units_per_em() as f32 + tracking * clusters.len().saturating_sub(1) as f32
}

/// Ascender and descender as fractions of the em (descender is positive).
fn vertical_metrics(font: Font) -> (f32, f32) {
    let face = &faces()[font.index()];
    let em = face.units_per_em() as f32;
    (face.ascender() as f32 / em, -(face.descender() as f32) / em)
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Style {
    pub font: Font,
    pub size: f32,
    /// Line box height as a multiple of the font size.
    pub leading: f32,
    /// Letter-spacing in em.
    pub tracking: f32,
    pub upper: bool,
    /// Even out line lengths (no orphaned last word) without adding lines.
    pub balance: bool,
}

impl Style {
    pub const fn text(size: f32) -> Self { Self { font: Font::Text, size, leading: 1.3, tracking: 0.0, upper: false, balance: false } }
    pub const fn strong(size: f32) -> Self { Self { font: Font::TextStrong, size, leading: 1.25, tracking: 0.0, upper: false, balance: false } }
    pub const fn display(font: Font, size: f32) -> Self { Self { font, size, leading: 1.08, tracking: 0.0, upper: false, balance: true } }
    /// Small uppercase eyebrow with open tracking.
    pub const fn kicker(size: f32) -> Self { Self { font: Font::TextStrong, size, leading: 1.2, tracking: 0.12, upper: true, balance: false } }
    pub const fn leading(mut self, leading: f32) -> Self { self.leading = leading; self }
    pub const fn size(mut self, size: f32) -> Self { self.size = size; self }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Line { pub text: String, pub width: f32 }

#[derive(Clone, Debug)]
pub struct Layout {
    pub lines: Vec<Line>,
    pub size: f32,
    pub font: Font,
    pub tracking_px: f32,
    pub line_height: f32,
    /// Baseline offset from the top of each line box (CSS half-leading model).
    pub baseline: f32,
}

impl Layout {
    pub fn height(&self) -> f32 { self.lines.len() as f32 * self.line_height }
    pub fn width(&self) -> f32 { self.lines.iter().map(|l| l.width).fold(0.0, f32::max) }
    pub fn is_empty(&self) -> bool { self.lines.iter().all(|l| l.text.is_empty()) }
    /// Visual top of the first line's capitals relative to the layout top; lets a block
    /// align type optically with shapes beside it.
    pub fn cap_top(&self) -> f32 { self.baseline - self.size * 0.73 }
}

#[derive(Clone, Copy, Debug)]
pub struct Overflow { pub width: f32, pub height: f32, pub size: f32 }

pub const MIN_SIZE: f32 = 14.0;

fn wrap(text: &str, style: Style, size: f32, max_w: f32) -> Vec<Line> {
    let tracking = style.tracking * size;
    let mut lines = vec![];
    for paragraph in text.split('\n') {
        let mut current = String::new();
        for word in paragraph.split_whitespace() {
            let candidate = if current.is_empty() { word.to_owned() } else { format!("{current} {word}") };
            if !current.is_empty() && measure(style.font, &candidate, size, tracking) > max_w {
                let width = measure(style.font, &current, size, tracking);
                lines.push(Line { text: std::mem::replace(&mut current, word.to_owned()), width });
            } else {
                current = candidate;
            }
        }
        let width = measure(style.font, &current, size, tracking);
        lines.push(Line { text: current, width });
    }
    lines
}

fn build(text: &str, style: Style, size: f32, max_w: f32) -> Layout {
    let (ascent, descent) = vertical_metrics(style.font);
    let line_height = size * style.leading;
    Layout {
        lines: wrap(text, style, size, max_w), size, font: style.font, tracking_px: style.tracking * size,
        line_height, baseline: (line_height - (ascent + descent) * size) / 2.0 + ascent * size,
    }
}

type Key = (String, Font, [u32; 6], (bool, bool));
static CACHE: OnceLock<Mutex<HashMap<Key, Arc<Layout>>>> = OnceLock::new();

/// The largest size (in whole pixels below `style.size`, never below 14px) at which the
/// text wraps into `max_w` × `max_h`. Line count only grows with size, so the search
/// is a bisection instead of a pixel-by-pixel walk.
pub fn fit(text: &str, style: Style, max_w: f32, max_h: f32) -> Result<Arc<Layout>, Overflow> {
    let text = if style.upper { text.to_uppercase() } else { text.to_owned() };
    let key: Key = (text.clone(), style.font,
        [style.size, style.leading, style.tracking, max_w, max_h, 0.0].map(f32::to_bits), (style.upper, style.balance));
    let cache = CACHE.get_or_init(Default::default);
    if let Some(hit) = cache.lock().unwrap().get(&key) { return Ok(hit.clone()); }
    let fits = |layout: &Layout| layout.height() <= max_h + 0.01 && layout.width() <= max_w + 0.01;
    let top = style.size.max(1.0);
    let floor = MIN_SIZE.min(top);
    let steps = (top - floor).floor() as usize;
    let at = |step: usize| build(&text, style, if step == steps { floor } else { top - step as f32 }, max_w);
    let smallest = at(steps);
    if !fits(&smallest) {
        return Err(Overflow { width: smallest.width(), height: smallest.height(), size: smallest.size });
    }
    let (mut low, mut high) = (0usize, steps); // `high` always fits.
    let mut best = smallest;
    while low < high {
        let mid = (low + high) / 2;
        let layout = at(mid);
        if fits(&layout) { high = mid; best = layout; } else { low = mid + 1; }
    }
    if style.balance && best.lines.len() > 1 && !text.contains('\n') {
        best = balanced(&text, style, best, max_w);
    }
    let layout = Arc::new(best);
    let mut guard = cache.lock().unwrap();
    if guard.len() > 50_000 { guard.clear(); }
    guard.insert(key, layout.clone());
    Ok(layout)
}

/// The narrowest wrap width that keeps the same number of lines, so a headline breaks into
/// even lines instead of leaving one word alone at the end. Size and line count are kept.
fn balanced(text: &str, style: Style, layout: Layout, max_w: f32) -> Layout {
    let lines = layout.lines.len();
    let (mut low, mut high) = (max_w * 0.4, max_w);
    let mut best = layout;
    for _ in 0..14 {
        let mid = (low + high) / 2.0;
        let candidate = build(text, style, best.size, mid);
        if candidate.lines.len() == lines && candidate.width() <= mid + 0.01 { high = mid; best = candidate; } else { low = mid; }
    }
    best
}

/// Byte ranges of each layout line inside the whitespace-normalised text, used to place
/// markers and emphasis on phrases that may wrap across lines.
pub fn line_spans(layout: &Layout) -> Vec<(usize, usize)> {
    let mut spans = vec![];
    let mut offset = 0;
    for line in &layout.lines {
        spans.push((offset, offset + line.text.len()));
        offset += line.text.len() + 1;
    }
    spans
}

/// Whitespace-normalised text as the layout joins it.
pub fn joined(layout: &Layout) -> String {
    layout.lines.iter().map(|l| l.text.as_str()).collect::<Vec<_>>().join(" ")
}

/// For a phrase, the (line, byte-start, byte-end) ranges it covers in the layout's lines.
pub fn phrase_ranges(layout: &Layout, phrase: &str) -> Vec<(usize, usize, usize)> {
    let phrase = phrase.split_whitespace().collect::<Vec<_>>().join(" ");
    if phrase.is_empty() { return vec![]; }
    let text = joined(layout);
    let Some(start) = find_words(&text, &phrase) else { return vec![] };
    let end = start + phrase.len();
    line_spans(layout).into_iter().enumerate().filter_map(|(index, (from, to))| {
        let (a, b) = (start.max(from), end.min(to));
        (a < b).then(|| (index, a - from, b - from))
    }).collect()
}

/// Pixel offset of a byte position within a layout line (letter-spacing included).
pub fn offset(layout: &Layout, line: usize, byte: usize) -> f32 {
    if byte == 0 { return 0.0; }
    measure(layout.font, &layout.lines[line].text[..byte], layout.size, layout.tracking_px) + layout.tracking_px
}

/// For a phrase, the (line, x-start, x-end) pieces it covers in the layout.
pub fn phrase_pieces(layout: &Layout, phrase: &str) -> Vec<(usize, f32, f32)> {
    phrase_ranges(layout, phrase).into_iter()
        .map(|(line, a, b)| (line, offset(layout, line, a), offset(layout, line, b) - layout.tracking_px))
        .collect()
}

/// Whole-word match: the phrase must start and end on word boundaries.
pub fn find_words(text: &str, phrase: &str) -> Option<usize> {
    if phrase.trim().is_empty() { return None; }
    let boundary = |c: Option<char>| c.is_none_or(|c| !c.is_alphanumeric());
    let mut from = 0;
    while let Some(found) = text[from..].find(phrase) {
        let start = from + found;
        let end = start + phrase.len();
        if boundary(text[..start].chars().next_back()) && boundary(text[end..].chars().next()) { return Some(start); }
        from = start + text[start..].chars().next().map_or(1, char::len_utf8);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn shaped_widths_are_fractional_and_include_kerning() {
        let size = 37.0;
        let pair = measure(Font::Text, "AV", size, 0.0);
        let apart = measure(Font::Text, "A", size, 0.0) + measure(Font::Text, "V", size, 0.0);
        assert!(pair < apart, "kerning must tighten AV: {pair} vs {apart}");
        assert!(pair.fract() != 0.0);
        let tracked = measure(Font::Text, "ABC", size, 5.0);
        assert!((tracked - measure(Font::Text, "ABC", size, 0.0) - 10.0).abs() < 0.001, "no tracking after the last glyph");
    }
    #[test]
    fn fitting_bisects_to_the_largest_size_that_fits() {
        let style = Style::display(Font::DisplayBold, 120.0);
        let layout = fit("Make the next step clear", style, 700.0, 300.0).unwrap();
        assert!(layout.width() <= 700.0 && layout.height() <= 300.0);
        let larger = build("Make the next step clear", style, layout.size + 1.0, 700.0);
        assert!(layout.size == 120.0 || larger.height() > 300.0 || larger.width() > 700.0);
        assert!(fit("Supercalifragilisticexpialidocious", Style::text(40.0), 60.0, 400.0).is_err());
        assert!(Arc::ptr_eq(&layout, &fit("Make the next step clear", style, 700.0, 300.0).unwrap()), "cached");
    }
    #[test]
    fn display_headlines_balance_their_lines_without_adding_one() {
        let style = Style::display(Font::Display, 60.0);
        let plain = build("How much time a request really takes", style, 60.0, 900.0);
        let even = fit("How much time a request really takes", style, 900.0, 400.0).unwrap();
        assert_eq!(plain.lines.len(), even.lines.len());
        let spread = |l: &Layout| l.lines.iter().map(|x| x.width).fold(0.0, f32::max) - l.lines.iter().map(|x| x.width).fold(f32::MAX, f32::min);
        assert!(spread(&even) < spread(&plain), "balanced lines are more even");
        assert!(even.lines.last().unwrap().text.contains(' '), "no orphaned final word");
    }
    #[test]
    fn kickers_are_uppercase_and_tracked() {
        let layout = fit("Field notes", Style::kicker(22.0), 800.0, 40.0).unwrap();
        assert_eq!(layout.lines[0].text, "FIELD NOTES");
        assert!((layout.tracking_px - 22.0 * 0.12).abs() < 1e-4);
    }
    #[test]
    fn figures_are_tabular_so_counters_never_change_width() {
        let a = measure(Font::Figures, "1,111.1", 100.0, 0.0);
        let b = measure(Font::Figures, "8,888.8", 100.0, 0.0);
        assert!((a - b).abs() < 0.01, "{a} vs {b}");
        assert!(measure(Font::DisplayBold, "1", 100.0, 0.0) < measure(Font::DisplayBold, "8", 100.0, 0.0), "headline digits stay proportional");
    }
    #[test]
    fn phrases_map_to_line_pieces_even_across_a_wrap() {
        let layout = fit("An average can hide a long tail", Style::display(Font::Display, 60.0), 520.0, 400.0).unwrap();
        assert!(layout.lines.len() >= 2);
        let pieces = phrase_pieces(&layout, "hide a long tail");
        assert!(!pieces.is_empty());
        assert!(pieces.iter().all(|(_, a, b)| b > a));
        assert!(phrase_pieces(&layout, "missing words").is_empty());
        assert_eq!(find_words("a cat scattered", "cat"), Some(2));
        assert_eq!(find_words("scattered", "cat"), None);
        assert_eq!(find_words("A long tail", ""), None);
        assert_eq!(find_words("A long tail", "  "), None);
    }
    #[test]
    fn coverage_reports_the_first_missing_glyph() {
        assert_eq!(covers(Font::Text, "Café — 42%"), None);
        assert_eq!(covers(Font::Text, "東京"), Some('東'));
    }
}
