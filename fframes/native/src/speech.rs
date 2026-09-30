//! Speech-following text: kinetic phrases, words and poster stacks, burned captions and the
//! speaker lower third, all driven by measured word intervals and prepared voice levels.
use super::*;

impl<'a, 'c, 'm> Draw<'a, 'c, 'm> {
    /// A speaker's lower third: colour dot, name and role on a soft plate, and a small
    /// meter driven by the voice level. It holds across consecutive beats by the same speaker.
    pub(crate) fn speaker_tag(&self, bottom: f32) -> Svgr<'a> {
        let Some(sp) = self.b.speaker.as_ref() else { return empty() };
        let name = s(sp, "name");
        if name.is_empty() {
            return empty();
        }
        let color = match s(sp, "color") {
            "accent2" => self.p.accent2.clone(),
            "ink" => self.p.ink.clone(),
            "positive" => self.p.positive.clone(),
            "negative" => self.p.negative.clone(),
            _ => self.p.accent.clone(),
        };
        let role = s(sp, "role");
        let size = if self.tall() { 32.0 } else { 30.0 };
        let name_w = text::measure(Font::TextStrong, name, size, 0.0);
        let role_w = if role.is_empty() { 0.0 } else { text::measure(Font::Text, role, size * 0.8, 0.0) + 22.0 };
        let (h, pad) = (size * 2.3, size * 0.7);
        let meter_w = 5.0 * 6.0 + 4.0 * 5.0;
        let w = pad + 18.0 + 16.0 + name_w + role_w + 20.0 + meter_w + pad;
        let (x, y) = (self.area.x, bottom - h);
        let level = self.level(self.t);
        let dot = 9.0 * (1.0 + 0.35 * level);
        let mid = y + h / 2.0;
        let mut bars = vec![];
        for i in 0..5 {
            let lv = self.level(self.t - i as f32 * 2.0 / self.f.fps as f32);
            let bh = 6.0 + lv * (h * 0.46);
            let bx = x + w - pad - meter_w + (4 - i) as f32 * 11.0;
            bars.push(rounded(bx, mid - bh / 2.0, 6.0, bh, 3.0, &color));
        }
        let text_x = x + pad + 18.0 + 16.0;
        let base = mid + size * 0.36;
        let body = fframes::svgr!(<g>
            <g opacity="0.92">{rounded(x, y, w, h, h / 2.0, &self.p.surface)}</g>
            <circle cx={x + pad + 9.0} cy={mid} r={dot} fill={color.clone()} />
            {self.run(name.to_owned(), text_x, base, Font::TextStrong, size, 0.0, &self.p.ink)}
            {if role.is_empty() { empty() } else { self.run(role.to_owned(), text_x + name_w + 22.0, base, Font::Text, size * 0.8, 0.0, &self.p.muted) }}
            <g>{bars}</g>
        </g>);
        if sp.get("continues").and_then(Value::as_bool).unwrap_or(false) { body } else { self.rise(body, 0.05, 18.0) }
    }

    // ── Speech ──────────────────────────────────────────────────────────────────────
    pub(crate) fn word_layout(
        &self,
        words: &[Caption],
        box_: Area,
        size: f32,
        mode: &str,
        center: bool,
        max_words: usize,
        max_gap: f32,
        max_duration: f32,
        caption: bool,
    ) -> Svgr<'a> {
        if words.is_empty() {
            return empty();
        }
        let current = active_word(words, self.t);
        let font = if caption { Font::TextStrong } else { Font::Display };
        if mode == "word" {
            // Hold the last spoken word through short pauses so the screen does not blink
            // between words; longer silences still clear. Timestamps are not altered.
            let held = current.or_else(|| words.iter().rposition(|w| self.t >= w.end && self.t - w.end < max_gap));
            let Some(i) = held else { return empty() };
            let layout = self.fit(&words[i].text, Style::display(Font::DisplayBold, size * 1.35), box_.w, box_.h);
            let pop = 0.9 + 0.1 * self.m.pop(self.t - words[i].start);
            let (cx, cy) = (box_.x + box_.w / 2.0, box_.y + box_.h / 2.0);
            let y = box_.y + (box_.h - layout.height()) / 2.0;
            let node =
                self.draw(&layout, box_.x, y, box_.w, if center { Align::Center } else { Align::Left }, &self.p.accent);
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
                if word_width > box_.w {
                    too_wide = true;
                }
                if width + word_width > box_.w && !lines.last().unwrap().is_empty() {
                    lines.push(vec![]);
                    width = 0.0;
                }
                lines.last_mut().unwrap().push((i, word_width));
                width += word_width + space;
            }
            if size <= 18.0 || (!too_wide && lines.len() as f32 * size * line_gap <= box_.h) {
                break;
            }
            size -= 1.0;
        }
        let space = text::measure(font, " ", size, 0.0);
        let total_height = lines.len() as f32 * size * line_gap;
        let mut shapes = vec![];
        if caption {
            let widest = lines
                .iter()
                .map(|l| l.iter().map(|(_, w)| w).sum::<f32>() + space * l.len().saturating_sub(1) as f32)
                .fold(0.0, f32::max);
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
                    _ => (
                        if caption { self.p.muted.clone() } else { self.p.ink.clone() },
                        if caption { 1.0 } else { 0.32 },
                    ),
                };
                if opacity > 0.0 {
                    let run = self.run(word.text.clone(), x, y, font, size, 0.0, &color);
                    if mode == "reveal" && !caption {
                        // Each word rises a few pixels as it is spoken.
                        let e = self.m.enter_over(self.t - word.start, 0.22);
                        let dy = (1.0 - e.travel) * size * 0.18;
                        shapes.push(
                            fframes::svgr!(<g opacity={e.alpha} transform={format!("translate(0 {dy})")}>{run}</g>),
                        );
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
    pub(crate) fn kinetic(&self) -> Svgr<'a> {
        let p = self.props();
        if s(p, "mode") == "stack" {
            return self.stack();
        }
        self.word_layout(
            &self.b.words,
            self.area,
            if self.wide { 116.0 } else { 100.0 },
            nonempty(s(p, "mode"), "highlight"),
            s(p, "align") == "center",
            n(p, "maxWords", 7.0) as usize,
            n(p, "maxGap", 0.6) as f32,
            n(p, "maxDuration", 4.0) as f32,
            false,
        )
    }
    /// Poster typography that builds as it is spoken: each word rises through its own mask
    /// on its measured start; `emphasis` words are larger and drawn in the accent. The
    /// phrase clears at a pause, as in the other kinetic modes.
    pub(crate) fn stack(&self) -> Svgr<'a> {
        let p = self.props();
        let words = &self.b.words;
        if words.is_empty() {
            return empty();
        }
        let window = phrase_window(
            words,
            self.t,
            n(p, "maxWords", 6.0) as usize,
            n(p, "maxGap", 0.6) as f32,
            n(p, "maxDuration", 4.0) as f32,
            true,
        );
        let chunk = &words[window.clone()];
        // Hold a phrase through pauses until the next one starts; the last phrase stays up
        // until the scene leaves.
        let last_end = chunk.last().map_or(0.0, |w| w.end);
        if let Some(next) = words.get(window.end) {
            if self.t > last_end + n(p, "maxGap", 0.6) as f32 && self.t < next.start - 0.3 {
                return empty();
            }
        }
        let key = |w: &str| w.chars().filter(|c| c.is_alphanumeric()).flat_map(char::to_lowercase).collect::<String>();
        let emphasized: std::collections::HashSet<String> =
            phrases(p, "emphasis").iter().flat_map(|ph| ph.split_whitespace().map(key).collect::<Vec<_>>()).collect();
        let upper = p.get("upper").and_then(Value::as_bool).unwrap_or(false);
        let serif = s(p, "emphasisStyle") == "serif";
        let center = s(p, "align") != "left";
        let a = self.area;
        let base = if self.wide { 132.0 } else { 118.0 };
        let text_of = |w: &Caption| if upper { w.text.to_uppercase() } else { w.text.clone() };
        let big = |w: &Caption| emphasized.contains(&key(&w.text));
        // Fit: shrink until every line fits the width and the stack fits the height.
        let mut scale = 1.0f32;
        let mut lines: Vec<Vec<(usize, f32, f32)>>;
        loop {
            lines = vec![vec![]];
            let mut width = 0.0;
            for (i, w) in chunk.iter().enumerate() {
                let size = base * scale * if big(w) { if serif { 1.6 } else { 1.45 } } else { 1.0 };
                let ww = text::measure(
                    if big(w) && serif { Font::SerifItalic } else { Font::DisplayBold },
                    &text_of(w),
                    size,
                    if big(w) && serif { 0.0 } else { -0.01 * size },
                );
                // One normal word space everywhere (emphasis is bigger, the gap is not), plus a
                // little room for the italic's overhang.
                let space = base * scale * 0.24 + if big(w) && serif { size * 0.04 } else { 0.0 };
                if width + ww > a.w && !lines.last().unwrap().is_empty() {
                    lines.push(vec![]);
                    width = 0.0;
                }
                lines.last_mut().unwrap().push((i, ww, size));
                width += ww + space;
            }
            let height: f32 = lines.iter().map(|l| l.iter().map(|x| x.2).fold(0.0, f32::max) * 1.0).sum();
            let widest =
                lines.iter().map(|l| l.iter().map(|x| x.1 + base * scale * 0.24).sum::<f32>()).fold(0.0, f32::max);
            if scale <= 0.3 || (height <= a.h && widest <= a.w + base) {
                break;
            }
            scale *= 0.94;
        }
        let height: f32 = lines.iter().map(|l| l.iter().map(|x| x.2).fold(0.0, f32::max)).sum();
        let mut y = a.y + (a.h - height) / 2.0;
        let mut shapes = vec![];
        for line in &lines {
            let line_h = line.iter().map(|x| x.2).fold(0.0, f32::max);
            let gap =
                |i: usize, size: f32| base * scale * 0.24 + if big(&chunk[i]) && serif { size * 0.04 } else { 0.0 };
            let line_w =
                line.iter().map(|x| x.1).sum::<f32>() + line.iter().rev().skip(1).map(|x| gap(x.0, x.2)).sum::<f32>();
            let mut x = if center { a.x + (a.w - line_w) / 2.0 } else { a.x };
            let baseline = y + line_h * 0.8;
            for &(i, width, size) in line {
                let w = &chunk[i];
                let appear = w.start - 0.04;
                if self.t >= appear {
                    let e = self.m.enter_over(self.t - appear, 0.28);
                    let color = if big(w) { self.p.accent.clone() } else { self.p.ink.clone() };
                    let run = if big(w) && serif {
                        self.run(text_of(w), x, baseline, Font::SerifItalic, size, 0.0, &color)
                    } else {
                        self.run(text_of(w), x, baseline, Font::DisplayBold, size, -0.01 * size, &color)
                    };
                    if e.done() {
                        shapes.push(run);
                    } else {
                        let id = self.uid("word");
                        let dy = (1.0 - e.travel) * size * 0.9;
                        shapes.push(fframes::svgr!(<g>
                            <defs><clipPath id={id.clone()}><rect x={x - size * 0.2} y={baseline - size * 1.05} width={width + size * 0.4} height={size * 1.4} /></clipPath></defs>
                            <g clip-path={format!("url(#{id})")}><g opacity={e.alpha} transform={format!("translate(0 {dy})")}>{run}</g></g>
                        </g>));
                    }
                }
                x += width + gap(i, size);
            }
            y += line_h;
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    /// Social captions: a few words at a time in heavy display type with an outline so they
    /// read over anything, the spoken word lifted onto an accent pill. Phrases end at
    /// sentences and pauses and clear shortly after their last word.
    fn pop_captions(&self, tall: bool) -> Svgr<'a> {
        let env = &self.b.environment;
        let words = &self.b.words;
        let window = phrase_window(words, self.t, if tall { 3 } else { 4 }, 0.5, 1.8, true);
        let (first, last) = match (words.get(window.start), window.end.checked_sub(1).and_then(|i| words.get(i))) {
            (Some(a), Some(b)) => (a, b),
            _ => return empty(),
        };
        if self.t < first.start - 0.04 || self.t > last.end + 0.45 {
            return empty();
        }
        let chunk = &words[window.clone()];
        let font = Font::DisplayBold;
        let max_w = self.area.w * if tall { 0.92 } else { 0.72 };
        let mut size: f32 = if tall { 78.0 } else { 60.0 };
        let (mut lines, mut space);
        loop {
            // Wider than a normal space so the active word's pill never touches its neighbours.
            space = text::measure(font, " ", size, 0.0) * 1.6;
            lines = vec![vec![]];
            let mut width = 0.0;
            for (i, word) in chunk.iter().enumerate() {
                let w = text::measure(font, &word.text, size, 0.0);
                if width + w > max_w && !lines.last().unwrap().is_empty() {
                    lines.push(vec![]);
                    width = 0.0;
                }
                lines.last_mut().unwrap().push((i, w));
                width += w + space;
            }
            // Tall frames have a deep caption band for two lines; wide frames keep one.
            if lines.len() <= if tall { 2 } else { 1 } || size <= 32.0 {
                break;
            }
            size -= 2.0;
        }
        let line_h = size * 1.12;
        // Centred in the band the layout keeps free for captions, clear of the source line.
        let centre_y = env.height - if tall { 200.0 } else { 88.0 };
        let top = centre_y - lines.len() as f32 * line_h / 2.0;
        let current = active_word(words, self.t);
        let outline = (size * 0.16).round();
        let mut back = vec![];
        let mut front = vec![];
        for (li, line) in lines.iter().enumerate() {
            let width = line.iter().map(|(_, w)| w).sum::<f32>() + space * line.len().saturating_sub(1) as f32;
            let mut x = self.area.x + (self.area.w - width) / 2.0;
            let baseline = top + li as f32 * line_h + size * 0.9;
            for &(i, w) in line {
                let word = &chunk[i];
                let active = current == Some(window.start + i);
                let text = word.text.clone();
                if active {
                    let pop = 0.86 + 0.14 * self.m.pop(self.t - word.start);
                    let (pw, ph) = (w + size * 0.3, size * 1.08);
                    let (cx, cy) = (x + w / 2.0, baseline - size * 0.34);
                    let pill = rounded(cx - pw / 2.0, cy - ph / 2.0, pw, ph, size * 0.2, &self.p.accent);
                    let label = self.run(text, x, baseline, font, size, 0.0, &self.p.bg);
                    front.push(fframes::svgr!(<g transform={format!("translate({cx} {cy}) rotate(-2) scale({pop}) translate({} {})", -cx, -cy)}>{pill}{label}</g>));
                } else {
                    let spoken = self.t >= word.start;
                    let ink = if spoken { self.p.ink.as_str() } else { self.p.muted.as_str() };
                    back.push(fframes::svgr!(<g stroke={self.p.bg.clone()} stroke-width={outline} stroke-linejoin="round">{self.run(text.clone(), x, baseline, font, size, 0.0, &self.p.bg)}</g>));
                    front.push(self.run(text, x, baseline, font, size, 0.0, ink));
                }
                x += w + space;
            }
        }
        // The phrase snaps in as a unit.
        let e = self.m.enter_over(self.t - first.start + 0.04, 0.16);
        let (cx, cy) = (self.area.x + self.area.w / 2.0, centre_y);
        let scale = 0.9 + 0.1 * e.travel;
        fframes::svgr!(<g opacity={e.alpha} transform={format!("translate({cx} {cy}) scale({scale}) translate({} {})", -cx, -cy)}>{back}{front}</g>)
    }
    pub(crate) fn footer(&self) -> Svgr<'a> {
        let env = &self.b.environment;
        let tall = env.height > env.width;
        let source_y = self.floor.min(env.height)
            - if env.captions && self.floor >= env.height {
                if tall { 320.0 } else { 160.0 }
            } else if env.framed && self.floor >= env.height {
                128.0
            } else {
                92.0
            };
        let (source, _) = self.para(
            s(self.props(), "source"),
            Area { x: self.area.x, y: source_y, w: self.area.w, h: 60.0 },
            Style::text(22.0),
            &self.p.muted,
            Align::Left,
        );
        // Over a world camera: the credit waits for the camera to arrive at what it credits,
        // and sits on a soft scrim so drawings passing under it never cross the text.
        let props = self.props();
        let source = if self.b.block == "canvas"
            && arr(props, "view").len() == 4
            && !s(props, "source").trim().is_empty()
        {
            let arrive = if arr(props, "viewFrom").is_empty() {
                0.0
            } else {
                (n(props, "viewAt", 0.0) + n(props, "viewDur", 1.2)) as f32
            };
            let alpha = motion::clamp01((self.t - arrive + 0.2) / 0.35);
            let id = self.uid("scrim");
            let top = source_y - 70.0;
            fframes::svgr!(<g opacity={alpha}>
                <defs><linearGradient id={id.clone()} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color={self.p.bg.clone()} stop-opacity="0" /><stop offset="1" stop-color={self.p.bg.clone()} stop-opacity="0.9" /></linearGradient></defs>
                <rect x="0" y={top} width={env.width} height={env.height - top} fill={format!("url(#{id})")} />
                {source}
            </g>)
        } else {
            source
        };
        let mut captions = empty();
        if env.captions && self.b.block != "kinetic" && env.caption_style == "pop" && !self.b.words.is_empty() {
            captions = self.pop_captions(tall);
        } else if env.captions && self.b.block != "kinetic" {
            let box_ = Area {
                x: self.area.x,
                y: env.height - (self.bar - 20.0).max(0.0) - if tall { 242.0 } else { 104.0 },
                w: self.area.w,
                h: if tall { 112.0 } else { 78.0 },
            };
            if !self.b.words.is_empty() {
                captions = self.word_layout(
                    &self.b.words,
                    box_,
                    34.0,
                    "highlight",
                    true,
                    if self.wide { 12 } else { 7 },
                    0.6,
                    4.0,
                    true,
                );
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
        let tag = self.speaker_tag(source_y - 28.0);
        fframes::svgr!(<g>{source}{tag}{captions}</g>)
    }
}
