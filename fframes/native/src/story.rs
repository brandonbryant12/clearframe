//! Story blocks: hero headlines (including mixed serif/sans), chapters, highlights, numbers,
//! comparisons, quotes, lists, matrices, equations and callouts.
use super::*;
use crate::text::EmphasisKind;

impl<'a, 'c, 'm> Draw<'a, 'c, 'm> {
    /// Mixed-face headline: whole-word `phrases` are set in the `mark` face (scaled, so an
    /// italic serif matches the sans capitals) and drawn in the accent; everything else in
    /// `font`. Wraps greedily, avoids a one-word last line when it can, and shrinks until it
    /// fits the box.
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn rich(
        &self,
        value: &str,
        phrases: &[String],
        font: Font,
        mark: (Font, f32),
        size: f32,
        leading: f32,
        max_w: f32,
        max_h: f32,
    ) -> Rich {
        let words: Vec<&str> = value.split_whitespace().collect();
        let joined = words.join(" ");
        let mut marked = vec![false; words.len()];
        let mut offsets = vec![];
        let mut at = 0;
        for w in &words {
            offsets.push(at);
            at += w.len() + 1;
        }
        for phrase in phrases {
            let phrase = phrase.split_whitespace().collect::<Vec<_>>().join(" ");
            if let Some(start) = text::find_words(&joined, &phrase) {
                let end = start + phrase.len();
                for (i, &o) in offsets.iter().enumerate() {
                    if o < end && o + words[i].len() > start {
                        marked[i] = true;
                    }
                }
            }
        }
        let mut size = size;
        loop {
            let marked_size = size * mark.1;
            let space = text::measure(font, " ", size, 0.0) * 1.05;
            let measured: Vec<(String, bool, f32)> = words
                .iter()
                .zip(&marked)
                .map(|(w, &m)| {
                    (
                        (*w).to_owned(),
                        m,
                        text::measure(if m { mark.0 } else { font }, w, if m { marked_size } else { size }, 0.0),
                    )
                })
                .collect();
            let wrap = |limit: f32| {
                let mut lines: Vec<Vec<(String, bool, f32)>> = vec![vec![]];
                let mut width = 0.0;
                for word in &measured {
                    let add = if lines.last().unwrap().is_empty() { word.2 } else { space + word.2 };
                    if width + add > limit && !lines.last().unwrap().is_empty() {
                        lines.push(vec![]);
                        width = 0.0;
                    }
                    width += if lines.last().unwrap().is_empty() { word.2 } else { space + word.2 };
                    lines.last_mut().unwrap().push(word.clone());
                }
                lines
            };
            let mut lines = wrap(max_w);
            // Balance: pull a word down rather than strand one alone on the last line.
            if lines.len() > 1 && lines.last().unwrap().len() == 1 {
                let mut limit = max_w;
                for _ in 0..12 {
                    limit *= 0.94;
                    let trial = wrap(limit);
                    if trial.len() > lines.len() {
                        break;
                    }
                    if trial.last().unwrap().len() > 1 {
                        lines = trial;
                        break;
                    }
                }
            }
            let line_h = size * leading;
            let widest = lines
                .iter()
                .map(|l| l.iter().map(|w| w.2).sum::<f32>() + space * l.len().saturating_sub(1) as f32)
                .fold(0.0, f32::max);
            if (lines.len() as f32 * line_h <= max_h && widest <= max_w + 1.0) || size <= text::MIN_SIZE {
                if size <= text::MIN_SIZE && (widest > max_w + 1.0 || lines.len() as f32 * line_h > max_h) {
                    panic!(
                        "Text overflow in scene '{}' ({}): headline does not fit {:.0}×{:.0}px at the 14px minimum. Shorten or reflow the text.",
                        self.b.id, self.b.block, max_w, max_h
                    );
                }
                return Rich { lines, size, space, line_h, font, mark: mark.0, mark_scale: mark.1 };
            }
            size = (size * 0.95).max(text::MIN_SIZE);
        }
    }
    pub(crate) fn rich_height(r: &Rich) -> f32 {
        r.lines.len() as f32 * r.line_h
    }
    /// Draw a mixed-face headline line by line through rising masks.
    pub(crate) fn draw_rich(
        &self,
        r: &Rich,
        x: f32,
        y: f32,
        w: f32,
        align: Align,
        color: &str,
        start: f32,
    ) -> Svgr<'a> {
        let baseline = text::baseline_in(r.font, r.size, r.line_h);
        let mut out = vec![];
        let mode = self.text_motion();
        if mode != "lines" {
            // Word by word (letters and cascade split each word too), in reading order.
            let letters = mode != "words";
            let count: usize = r.lines.iter().flatten().map(|w| if letters { w.0.chars().count() } else { 1 }).sum();
            let step = (if letters { 0.028_f32 } else { 0.075 }).min(0.9 / count.max(1) as f32);
            let mut k = 0;
            for (i, line) in r.lines.iter().enumerate() {
                let width = line.iter().map(|w| w.2).sum::<f32>() + r.space * line.len().saturating_sub(1) as f32;
                let mut cx = align.x(x, w, width);
                let top = y + i as f32 * r.line_h;
                for (word, marked, ww) in line {
                    let (font, size, fill) = if *marked {
                        (r.mark, r.size * r.mark_scale, self.p.accent.as_str())
                    } else {
                        (r.font, r.size, color)
                    };
                    let parts: Vec<(usize, usize)> = if letters {
                        word.char_indices().map(|(b, ch)| (b, b + ch.len_utf8())).collect()
                    } else {
                        vec![(0, word.len())]
                    };
                    for (a, b) in parts {
                        let px = cx + if a == 0 { 0.0 } else { text::measure(font, &word[..a], size, 0.0) };
                        let pw = text::measure(font, &word[a..b], size, 0.0);
                        let body = self.run(word[a..b].to_owned(), px, top + baseline, font, size, 0.0, fill);
                        if let Some(node) =
                            self.reveal_piece(body, start + k as f32 * step, k, mode, px, top, pw, r.size, r.line_h)
                        {
                            out.push(node);
                        }
                        k += 1;
                    }
                    cx += ww + r.space;
                }
            }
            return fframes::svgr!(<g>{out}</g>);
        }
        for (i, line) in r.lines.iter().enumerate() {
            let width = line.iter().map(|w| w.2).sum::<f32>() + r.space * line.len().saturating_sub(1) as f32;
            let mut cx = align.x(x, w, width);
            let top = y + i as f32 * r.line_h;
            let mut runs = vec![];
            for (word, marked, ww) in line {
                let (font, size, fill) = if *marked {
                    (r.mark, r.size * r.mark_scale, self.p.accent.as_str())
                } else {
                    (r.font, r.size, color)
                };
                runs.push(self.run(word.clone(), cx, top + baseline, font, size, 0.0, fill));
                cx += ww + r.space;
            }
            let body = fframes::svgr!(<g>{runs}</g>);
            let enter = self.m.enter(self.t - start - i as f32 * self.m.stagger());
            if enter.done() {
                out.push(body);
                continue;
            }
            if enter.hidden() {
                continue;
            }
            let dy = (1.0 - enter.travel) * r.line_h * (0.3 + 0.7 * self.m.intensity);
            let id = self.uid("rich");
            out.push(fframes::svgr!(<g>
                <defs><clipPath id={id.clone()}><rect x={x - 80.0} y={top - r.size * 0.35} width={w + 160.0} height={r.line_h + r.size * 0.55} /></clipPath></defs>
                <g clip-path={format!("url(#{id})")}><g opacity={enter.alpha} transform={format!("translate(0 {dy})")}>{body}</g></g>
            </g>));
        }
        fframes::svgr!(<g>{out}</g>)
    }

    /// Emphasis drawn around phrases instead of in them: an accent marker block behind the
    /// words (`marker`) or an accent rule under them (`underline`), growing with each line's
    /// entrance. Pieces come from the shaped layout, so they sit exactly under the glyphs.
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn decorate(
        &self,
        layout: &Layout,
        phrases: &[String],
        x: f32,
        y: f32,
        w: f32,
        align: Align,
        start: f32,
        kind: EmphasisKind,
    ) -> Svgr<'a> {
        let mut out = vec![];
        for phrase in phrases {
            for (i, a, b) in text::phrase_ranges(layout, phrase) {
                // Arrive with the phrase's last piece, so a word never shows as a bare block
                // (its ink is the background colour over a marker) or an underline alone.
                let enter = self.m.enter(self.t - start - self.piece_delay(layout, i, b));
                if enter.hidden() {
                    continue;
                }
                let (from, to) = (text::offset(layout, i, a), text::offset(layout, i, b) - layout.tracking_px);
                let line = &layout.lines[i];
                let lx = align.x(x, w, line.width) + from;
                let baseline = y + i as f32 * layout.line_height + layout.baseline;
                let size = layout.size;
                let node = if kind == EmphasisKind::Marker {
                    let pad = size * 0.09;
                    rounded(lx - pad, baseline - size * 0.78, (to - from + 2.0 * pad) * enter.travel, size * 1.0, size * 0.05, &self.p.accent)
                } else {
                    rect(lx, baseline + size * 0.09, (to - from) * enter.travel, (size * 0.065).max(3.0), &self.p.accent)
                };
                out.push(if enter.done() { node } else { fframes::svgr!(<g opacity={enter.alpha}>{node}</g>) });
            }
        }
        fframes::svgr!(<g>{out}</g>)
    }

    // ── Story blocks ────────────────────────────────────────────────────────────────
    /// Title, statement and endcard share an optically centred hero stack.
    pub(crate) fn hero(&self) -> Svgr<'a> {
        let a = self.area;
        let props = self.props();
        let block = self.b.block.as_str();
        let support = nonempty(s(props, "support"), s(props, "context"));
        let start = self.b.cue_seconds;
        // The film's type voice sets the face, case and tracking; the beat's `emphasisStyle`
        // (serif, accent) still wins over the voice's emphasis.
        let v = self.voice();
        let (font, size, width) = match block {
            "title" => (v.bold(), if self.wide { 124.0 } else { 98.0 }, if self.wide { 0.9 } else { 1.0 }),
            "endcard" => (v.bold(), if self.wide { 108.0 } else { 88.0 }, if self.wide { 0.86 } else { 1.0 }),
            _ => (v.regular(), if self.wide { 96.0 } else { 80.0 }, if self.wide { 0.88 } else { 1.0 }),
        };
        let cased = |t: &str| if v.upper { t.to_uppercase() } else { t.to_owned() };
        let headline = cased(nonempty(s(props, "text"), s(props, "title")));
        let headline = headline.as_str();
        let marks: Vec<String> = phrases(props, "emphasis").iter().map(|p| cased(p)).collect();
        let kind = if marks.is_empty() { EmphasisKind::Accent } else { v.emphasis_kind(s(props, "emphasisStyle")) };
        // Mixed-face emphasis changes the measure; colour and decoration emphasis do not.
        let (font, mark) = match kind {
            EmphasisKind::Serif => (font, Some((Font::SerifItalic, 1.18))),
            EmphasisKind::Italic => (font, Some((v.italic().unwrap_or(font), 1.0))),
            EmphasisKind::Weight => (v.light().unwrap_or(font), Some((v.bold(), 1.0))),
            _ => (font, None),
        };
        let rich = mark.map(|m| self.rich(headline, &marks, font, m, size, 1.06 * v.leading, a.w * width, a.h * 0.62));
        let head = self.fit(headline, v.style(font, size, 1.04, false), a.w * width, a.h * 0.62);
        let emphasis_color = match kind {
            EmphasisKind::Marker => self.p.bg.clone(),
            EmphasisKind::Underline => self.p.ink.clone(),
            _ => self.p.accent.clone(),
        };
        // The rich layout replaces the plain one for measurement below.
        let head_h = rich.as_ref().map_or(head.height(), Self::rich_height);
        let sup = (!support.trim().is_empty()).then(|| {
            self.fit(
                support,
                Style::text(if self.wide { 36.0 } else { 34.0 }).leading(1.34),
                a.w * if self.wide { 0.66 } else { 1.0 },
                a.h * 0.2,
            )
        });
        let action = s(props, "action");
        // The call to action is a film's last line, not a web button or link: tracked small
        // capitals in the accent.
        let pill = (block == "endcard" && !action.trim().is_empty())
            .then(|| self.fit(action, Style::kicker(if self.wide { 32.0 } else { 30.0 }), a.w, 90.0));
        let bar_h = if block == "title" { 52.0 } else { 0.0 };
        let sup_h = sup.as_ref().map_or(0.0, |l| 40.0 + l.height());
        let pill_h = pill.as_ref().map_or(0.0, |l| 64.0 + l.height() + 18.0);
        let group = bar_h + head_h + sup_h + pill_h;
        let top = a.y + ((a.h - group) * 0.42).max(0.0);
        let mut nodes = vec![];
        let emphasis = self.emphasis(&head, &marks, &emphasis_color);
        let align = self.align();
        let centre = |w: f32| if align == Align::Center { a.x + (a.w - w) / 2.0 } else { a.x };
        if block == "title" {
            let grow = self.m.grow(self.t - start + 0.1, 0.7);
            nodes.push(rounded(
                centre(96.0) + if align == Align::Center { 48.0 * (1.0 - grow) } else { 0.0 },
                top,
                96.0 * grow,
                8.0,
                4.0,
                &self.p.accent,
            ));
        }
        let head_y = top + bar_h;
        if matches!(kind, EmphasisKind::Marker | EmphasisKind::Underline) {
            nodes.push(self.decorate(&head, &marks, a.x, head_y, a.w, align, start, kind));
        }
        match &rich {
            Some(r) => nodes.push(self.draw_rich(r, a.x, head_y, a.w, align, &self.p.ink, start)),
            None => nodes.push(self.lines(&head, a.x, head_y, a.w, align, &self.p.ink, start, &emphasis)),
        }
        let head_lines = rich.as_ref().map_or(head.lines.len(), |r| r.lines.len());
        let after = start + head_lines as f32 * self.m.stagger() + 0.18;
        if let Some(sup) = &sup {
            nodes.push(self.rise(self.draw(sup, a.x, head_y + head_h + 40.0, a.w, align, &self.p.muted), after, 16.0));
        }
        if let Some(pill) = &pill {
            let y = head_y + head_h + sup_h + 64.0;
            let w = pill.width();
            let px = centre(w);
            let words = self.draw(pill, px, y, w, Align::Left, &self.p.accent);
            nodes.push(self.rise(words, after + 0.2, 14.0));
        }
        let kicker_y =
            self.head_y.map_or(if self.tall() { self.b.environment.height * 0.11 } else { 108.0 }, |y| y + 8.0);
        let (kicker, _) = self.kicker(s(props, "kicker"), a.x, kicker_y, a.w, 0.0);
        fframes::svgr!(<g>{kicker}<g>{nodes}</g></g>)
    }
    pub(crate) fn chapter(&self) -> Svgr<'a> {
        let a = self.area;
        let props = self.props();
        let number = s(props, "number");
        let start = self.b.cue_seconds;
        let numeral_size = if self.wide { 300.0 } else { 240.0 };
        let v = self.voice();
        let num = self.fit(number, v.style(v.bold(), numeral_size, 0.9, false), a.w, a.h * 0.5);
        let title = self.fit(
            s(props, "title"),
            v.style(v.regular(), if self.wide { 92.0 } else { 76.0 }, 1.04, true),
            a.w * if self.wide { 0.8 } else { 1.0 },
            a.h * 0.4,
        );
        let marks: Vec<String> =
            phrases(props, "emphasis").iter().map(|p| if v.upper { p.to_uppercase() } else { p.clone() }).collect();
        let sup = s(props, "support");
        let sup = (!sup.trim().is_empty()).then(|| self.fit(sup, Style::text(34.0), a.w * 0.8, a.h * 0.16));
        let group = num.height() + 36.0 + title.height() + sup.as_ref().map_or(0.0, |l| 32.0 + l.height());
        let top = a.y + ((a.h - group) * 0.45).max(0.0);
        let grow = self.m.grow(self.t - start - 0.25, 0.9);
        let line_y = top + num.height() + 12.0;
        let align = self.align();
        let numeral = self.lines(&num, a.x, top, a.w, align, &self.p.accent, start, &[]);
        let line = if align == Align::Center {
            rect(a.x + a.w * (1.0 - grow) / 2.0, line_y, a.w * grow, 3.0, &self.p.line())
        } else {
            rect(a.x, line_y, a.w * grow, 3.0, &self.p.line())
        };
        let title_node = self.lines(
            &title,
            a.x,
            line_y + 24.0,
            a.w,
            align,
            &self.p.ink,
            start + 0.3,
            &self.emphasis(&title, &marks, &self.p.accent),
        );
        let support = sup
            .map(|l| {
                self.rise(
                    self.draw(&l, a.x, line_y + 24.0 + title.height() + 32.0, a.w, align, &self.p.muted),
                    start + 0.6,
                    14.0,
                )
            })
            .unwrap_or_else(empty);
        let (kicker, _) = self.kicker(
            s(props, "kicker"),
            a.x,
            self.head_y.map_or(if self.tall() { self.b.environment.height * 0.11 } else { 108.0 }, |y| y + 8.0),
            a.w,
            0.0,
        );
        fframes::svgr!(<g>{kicker}{numeral}{line}{title_node}{support}</g>)
    }
    /// A sentence with marker sweeps behind whole-word phrases, each on its own cue.
    pub(crate) fn highlight(&self) -> Svgr<'a> {
        let a = self.area;
        let props = self.props();
        let v = self.voice();
        let layout = self.fit(
            s(props, "text"),
            v.style(v.regular(), if self.wide { 92.0 } else { 76.0 }, 1.14, false),
            a.w * if self.wide { 0.9 } else { 1.0 },
            a.h * 0.72,
        );
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
            // Bounded so production.mjs can schedule the sweep to finish inside the beat.
            let sweep = self.m.grow(self.t - time, (0.35 + total / 2400.0).min(0.8));
            let mut covered = sweep * total;
            for (line, x0, x1) in pieces {
                let piece = (x1 - x0).min(covered.max(0.0));
                covered -= x1 - x0;
                let indent = if self.centered() { (a.w - layout.lines[line].width) / 2.0 } else { 0.0 };
                let lx = a.x + indent + x0 - layout.size * 0.08;
                let y = top + line as f32 * layout.line_height + layout.baseline - layout.size * 0.68;
                // Translucent accent, not a pre-mixed wash: it must tint whatever lies below,
                // including the glow backdrop, which can match a flat wash color exactly.
                let marker = rounded(
                    lx,
                    y,
                    piece + layout.size * 0.16 * (piece / (x1 - x0)).min(1.0),
                    layout.size * 0.84,
                    6.0,
                    &self.p.accent,
                );
                markers.push(fframes::svgr!(<g opacity={if self.p.dark { 0.34 } else { 0.22 }}>{marker}</g>));
            }
        }
        let body = self.lines(&layout, a.x, top, a.w, self.align(), &self.p.ink, start, &[]);
        let support = sup
            .map(|l| {
                self.rise(
                    self.draw(&l, a.x, top + layout.height() + 44.0, a.w, self.align(), &self.p.muted),
                    start + 0.5,
                    14.0,
                )
            })
            .unwrap_or_else(empty);
        let (kicker, _) = self.kicker(
            s(props, "kicker"),
            a.x,
            self.head_y.map_or(if self.tall() { self.b.environment.height * 0.11 } else { 108.0 }, |y| y + 8.0),
            a.w,
            0.0,
        );
        fframes::svgr!(<g>{kicker}<g>{markers}</g>{body}{support}</g>)
    }
    pub(crate) fn stat(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let (value, from, decimals) = (n(p, "value", 0.0), n(p, "from", 0.0), n(p, "decimals", 0.0) as usize);
        let (prefix, suffix) = (s(p, "prefix"), s(p, "suffix"));
        let size = self.numeral_size(value, decimals, prefix, suffix, if self.wide { 250.0 } else { 196.0 }, a.w);
        let label = self.fit(
            s(p, "label"),
            Style::display(Font::Display, if self.wide { 50.0 } else { 44.0 }),
            a.w * 0.9,
            a.h * 0.22,
        );
        let context = nonempty(s(p, "context"), s(p, "support"));
        let context = (!context.trim().is_empty())
            .then(|| self.fit(context, Style::text(32.0), a.w * if self.wide { 0.7 } else { 1.0 }, a.h * 0.2));
        let number_h = size * 0.95;
        let group = number_h + 40.0 + 8.0 + 36.0 + label.height() + context.as_ref().map_or(0.0, |l| 18.0 + l.height());
        let top = a.y + ((a.h - group) * 0.45).max(0.0);
        let cue = self.b.cue_seconds;
        let current = self.count(from, value, self.count_at(), 1.4);
        let e = self.enter(cue - 0.1);
        let centered = self.centered();
        let (number, width) = self.numeral(
            current,
            value,
            decimals,
            prefix,
            suffix,
            a.x,
            top + size * 0.78,
            size,
            centered.then_some(a.w),
            &self.p.accent,
            &self.p.ink,
        );
        let number = if e.hidden() { empty() } else { fframes::svgr!(<g opacity={e.alpha}>{number}</g>) };
        let bar_y = top + number_h + 40.0;
        let bar_w = width.min(a.w) * self.m.grow(self.t - self.count_at(), 1.4) * 0.32;
        let bar =
            rounded(if centered { a.x + (a.w - bar_w) / 2.0 } else { a.x }, bar_y, bar_w, 8.0, 4.0, &self.p.accent);
        let label_y = bar_y + 8.0 + 36.0;
        let label_node = self.lines(&label, a.x, label_y, a.w, self.align(), &self.p.ink, cue + 0.35, &[]);
        let context_node = context
            .map(|l| {
                self.rise(
                    self.draw(&l, a.x, label_y + label.height() + 18.0, a.w, self.align(), &self.p.muted),
                    cue + 0.6,
                    14.0,
                )
            })
            .unwrap_or_else(empty);
        fframes::svgr!(<g>{number}{bar}{label_node}{context_node}</g>)
    }
    pub(crate) fn kpis(&self) -> Svgr<'a> {
        let a = self.area;
        let items = arr(self.props(), "items");
        let count = items.len().max(1);
        let columns = if self.wide {
            count.min(4)
        } else if count > 3 {
            2
        } else {
            1
        };
        let rows = count.div_ceil(columns);
        let gap = 28.0;
        let cell_w = (a.w - gap * (columns as f32 - 1.0)) / columns as f32;
        let max_card_h = (a.h - gap * (rows as f32 - 1.0)) / rows as f32;
        let pad = if cell_w < 320.0 { 28.0 } else { 40.0 };
        // A single column reads as wide cards: numeral on the left, its label beside it.
        let side = columns == 1;
        let target = if self.wide {
            112.0
        } else if side {
            104.0
        } else {
            88.0
        };
        let number_w = if side { cell_w * 0.55 - pad } else { cell_w - 2.0 * pad };
        fn parts(it: &Value) -> (f64, usize, &str, &str) {
            (n(it, "value", 0.0), n(it, "decimals", 0.0) as usize, s(it, "prefix"), s(it, "suffix"))
        }
        let mut size = items
            .iter()
            .map(|it| {
                let (v, d, p, x) = parts(it);
                self.numeral_size(v, d, p, x, target, number_w)
            })
            .fold(target, f32::min);
        // Stacked cards keep room for a label line; the numeral shrinks to the card height.
        size = size.min(((max_card_h - 2.0 * pad - if side { 0.0 } else { 58.0 }) / 0.95).max(text::MIN_SIZE));
        let reserve = if side {
            items
                .iter()
                .map(|it| {
                    let (v, d, p, x) = parts(it);
                    self.numeral_width(v, d, p, x, size)
                })
                .fold(0.0, f32::max)
        } else {
            0.0
        };
        let label_w = if side { cell_w - 2.0 * pad - reserve - 44.0 } else { cell_w - 2.0 * pad };
        let label_room =
            if side { max_card_h - 2.0 * pad } else { (max_card_h - 2.0 * pad - size * 0.95 - 20.0).max(20.0) };
        let labels: Vec<_> = items
            .iter()
            .map(|it| self.fit(s(it, "label"), Style::text(if self.wide { 30.0 } else { 32.0 }), label_w, label_room))
            .collect();
        let label_h = labels.iter().map(|l| l.height()).fold(0.0, f32::max);
        let card_h =
            if side { 2.0 * pad + (size * 0.95).max(label_h) } else { 2.0 * pad + size * 0.95 + 20.0 + label_h }
                .min(max_card_h);
        let block_h = rows as f32 * card_h + gap * (rows as f32 - 1.0);
        let top = a.y + ((a.h - block_h) * 0.4).max(0.0);
        let mut shapes = vec![];
        for (i, item) in items.iter().enumerate() {
            let x = a.x + (i % columns) as f32 * (cell_w + gap);
            let y = top + (i / columns) as f32 * (card_h + gap);
            let time = at(item, self.b.cue_seconds, i);
            let (value, decimals, prefix, suffix) = parts(item);
            let current = self.count(n(item, "from", 0.0), value, time, 1.3);
            let baseline = if side { y + card_h / 2.0 + size * 0.36 } else { y + pad + size * 0.78 };
            let (number, _) = self.numeral(
                current,
                value,
                decimals,
                prefix,
                suffix,
                x + pad,
                baseline,
                size,
                None,
                &self.p.accent,
                &self.p.ink,
            );
            let card = rounded(x, y, cell_w, card_h, 26.0, &self.p.surface);
            let label = if side {
                self.draw(
                    &labels[i],
                    x + pad + reserve + 44.0,
                    y + (card_h - labels[i].height()) / 2.0,
                    label_w,
                    Align::Left,
                    &self.p.ink,
                )
            } else {
                self.draw(&labels[i], x + pad, y + pad + size * 0.95 + 20.0, label_w, Align::Left, &self.p.ink)
            };
            shapes.push(self.rise(fframes::svgr!(<g>{card}{number}{label}</g>), time, 30.0));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    pub(crate) fn delta(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let (from, to) = (&p["from"], &p["to"]);
        let (v0, v1) = (n(from, "value", 0.0), n(to, "value", 0.0));
        let decimals = n(p, "decimals", 0.0) as usize;
        let (prefix, suffix) = (s(p, "prefix"), s(p, "suffix"));
        let cue = self.b.cue_seconds;
        let column_w = if self.wide { a.w * 0.4 } else { a.w };
        let size = [v0, v1]
            .iter()
            .map(|v| self.numeral_size(*v, decimals, prefix, suffix, if self.wide { 150.0 } else { 140.0 }, column_w))
            .fold(f32::MAX, f32::min);
        let change = s(p, "change");
        let better = s(p, "better");
        let tone = match (better, v1.partial_cmp(&v0)) {
            ("up", Some(std::cmp::Ordering::Greater)) | ("down", Some(std::cmp::Ordering::Less)) => {
                self.p.positive.clone()
            }
            ("up", Some(std::cmp::Ordering::Less)) | ("down", Some(std::cmp::Ordering::Greater)) => {
                self.p.negative.clone()
            }
            _ => self.p.accent.clone(),
        };
        let mut shapes = vec![];
        let label_style = Style::kicker(22.0);
        let block_h = if self.wide { 44.0 + size } else { 2.0 * (44.0 + size) + 90.0 };
        let top = a.y + ((a.h - block_h - 120.0) * 0.4).max(0.0);
        let positions = if self.wide {
            [(a.x, top), (a.x + a.w * 0.56, top)]
        } else {
            [(a.x, top), (a.x, top + 44.0 + size + 90.0)]
        };
        for (i, (item, (x, y))) in [from, to].iter().zip(positions).enumerate() {
            let time = cue + i as f32 * 0.45;
            let label = self.fit(s(item, "label"), label_style, column_w, 40.0);
            let label = self.draw(&label, x, y, column_w, Align::Left, &self.p.muted);
            let current = if i == 0 { v0 } else { self.count(v0, v1, self.count_at() + 0.45, 1.3) };
            let (number, _) = self.numeral(
                current,
                if i == 0 { v0 } else { v1 },
                decimals,
                prefix,
                suffix,
                x,
                y + 44.0 + size * 0.8,
                size,
                None,
                if i == 0 { &self.p.muted } else { &tone },
                if i == 0 { &self.p.muted } else { &self.p.ink },
            );
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
    pub(crate) fn compare(&self) -> Svgr<'a> {
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
            let (x, y, w, h) = if self.wide {
                (a.x + i as f32 * (a.w + gap) / 2.0, a.y, (a.w - gap) / 2.0, usable)
            } else {
                (a.x, a.y + i as f32 * (usable + gap) / 2.0, a.w, (usable - gap) / 2.0)
            };
            let accent = if i == 0 { self.p.muted.clone() } else { self.p.accent.clone() };
            let pad = if self.wide { 44.0 } else { 36.0 };
            let title = self.fit(
                s(side, "title"),
                Style::display(Font::Display, if self.wide { 44.0 } else { 40.0 }),
                w - 2.0 * pad,
                110.0,
            );
            let items = arr(side, "items");
            let body_top = y + pad + title.height() + 26.0;
            let row_h =
                (((y + h - pad) - body_top) / items.len().max(1) as f32).min(if self.wide { 96.0 } else { 84.0 });
            let time = self.b.cue_seconds + i as f32 * 0.35;
            let mut contents = vec![rounded(x, y, w, h, 28.0, &self.p.surface)];
            contents.push(self.draw(
                &title,
                x + pad,
                y + pad,
                w - 2.0 * pad,
                Align::Left,
                if i == 0 { &self.p.ink } else { &self.p.accent },
            ));
            for (j, item) in items.iter().enumerate() {
                let item_y = body_top + j as f32 * row_h;
                let layout = self.fit(
                    item.as_str().unwrap_or(""),
                    Style::text(if self.wide { 32.0 } else { 30.0 }),
                    w - 2.0 * pad - 34.0,
                    (row_h - 8.0).max(20.0),
                );
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
    pub(crate) fn quote(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let indent = if self.wide { 150.0 } else { 0.0 };
        let mark_size = if self.wide { 300.0 } else { 220.0 };
        let top_pad = if self.wide { 0.0 } else { mark_size * 0.42 };
        let quote = self.fit(
            s(p, "text"),
            Style::display(Font::DisplayLight, if self.wide { 70.0 } else { 58.0 }).leading(1.16),
            a.w - indent,
            a.h * 0.64 - top_pad,
        );
        let author = self.fit(s(p, "author"), Style::strong(30.0), a.w - indent - 60.0, 44.0);
        let role = s(p, "role");
        let role = (!role.trim().is_empty()).then(|| self.fit(role, Style::text(26.0), a.w - indent - 60.0, 70.0));
        let group = top_pad + quote.height() + 48.0 + author.height() + role.as_ref().map_or(0.0, |l| 6.0 + l.height());
        let top = a.y + ((a.h - group) * 0.42).max(0.0);
        let cue = self.b.cue_seconds;
        let mark = self.rise(
            self.run(
                "“".into(),
                a.x - mark_size * 0.06,
                top + mark_size * 0.62,
                Font::DisplayBold,
                mark_size,
                0.0,
                &self.p.accent,
            ),
            cue - 0.1,
            20.0,
        );
        let x = a.x + indent;
        let text_top = top + top_pad;
        let body = self.lines(
            &quote,
            x,
            text_top,
            a.w - indent,
            Align::Left,
            &self.p.ink,
            cue,
            &self.emphasis(&quote, &phrases(p, "emphasis"), &self.p.accent),
        );
        let after = cue + quote.lines.len() as f32 * self.m.stagger() + 0.25;
        let by = text_top + quote.height() + 48.0;
        let byline = fframes::svgr!(<g>
            {rect(x, by + author.baseline - author.size * 0.36, 40.0, 3.0, &self.p.accent)}
            {self.draw(&author, x + 60.0, by, a.w - indent - 60.0, Align::Left, &self.p.accent)}
            {role.as_ref().map(|l| self.draw(l, x + 60.0, by + author.height() + 6.0, a.w - indent - 60.0, Align::Left, &self.p.muted)).unwrap_or_else(empty)}
        </g>);
        fframes::svgr!(<g>{mark}{body}{self.rise(byline, after, 12.0)}</g>)
    }
    pub(crate) fn list(&self) -> Svgr<'a> {
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
            let layout = self.fit(
                value,
                Style::display(Font::Display, if self.wide { 46.0 } else { 42.0 }).leading(1.12),
                a.w - index_w,
                row_h - 36.0,
            );
            let number = self.run(
                format!("{:02}", i + 1),
                a.x,
                y + 20.0 + layout.baseline,
                Font::DisplayBold,
                layout.size.min(46.0),
                0.0,
                &self.p.accent,
            );
            let line = rect(a.x, y, a.w * grow, 2.0, &self.p.line());
            let text = self.draw(&layout, a.x + index_w, y + 20.0, a.w - index_w, Align::Left, &self.p.ink);
            shapes.push(fframes::svgr!(<g>{line}{self.rise(fframes::svgr!(<g>{number}{text}</g>), time, 20.0)}</g>));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    pub(crate) fn matrix(&self) -> Svgr<'a> {
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
            let (node, _) = self.para(
                col.as_str().unwrap_or(""),
                Area { x, y: top + 24.0, w: col_w - 40.0, h: row_h - 40.0 },
                Style::strong(30.0),
                if highlight == Some(i) { &self.p.accent } else { &self.p.ink },
                Align::Left,
            );
            shapes.push(self.rise(node, self.b.cue_seconds, 10.0));
        }
        shapes.push(rect(
            a.x,
            top + row_h - 2.0,
            a.w * self.m.grow(self.t - self.b.cue_seconds, 0.7),
            3.0,
            &self.p.ink,
        ));
        for (i, row) in rows.iter().enumerate() {
            let y = top + (i + 1) as f32 * row_h;
            let mut cells = vec![rule(a.x, y + row_h - 1.0, a.w, &self.p.line())];
            cells.push(
                self.para(
                    s(row, "label"),
                    Area { x: a.x + 4.0, y: y + 22.0, w: first - 28.0, h: row_h - 36.0 },
                    Style::strong(30.0),
                    &self.p.ink,
                    Align::Left,
                )
                .0,
            );
            for (j, value) in arr(row, "values").iter().enumerate() {
                let color = if highlight == Some(j) { &self.p.ink } else { &self.p.muted };
                cells.push(
                    self.para(
                        value.as_str().unwrap_or(""),
                        Area {
                            x: a.x + first + j as f32 * col_w + 20.0,
                            y: y + 22.0,
                            w: col_w - 40.0,
                            h: row_h - 36.0,
                        },
                        Style::text(30.0),
                        color,
                        Align::Left,
                    )
                    .0,
                );
            }
            shapes.push(self.rise(fframes::svgr!(<g>{cells}</g>), self.b.cue_seconds + 0.15 + i as f32 * 0.14, 14.0));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    pub(crate) fn equation(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let cue = self.b.cue_seconds;
        let expression = self.fit(
            s(p, "expression"),
            Style::display(Font::DisplayLight, if self.wide { 88.0 } else { 72.0 }),
            a.w,
            a.h * 0.3,
        );
        let result = self.fit(
            s(p, "result"),
            Style::display(Font::DisplayBold, if self.wide { 116.0 } else { 92.0 }),
            a.w,
            a.h * 0.3,
        );
        let why = s(p, "explanation");
        let why = (!why.trim().is_empty())
            .then(|| self.fit(why, Style::text(32.0), a.w * if self.wide { 0.7 } else { 1.0 }, a.h * 0.2));
        let group =
            expression.height() + 36.0 + 3.0 + 32.0 + result.height() + why.as_ref().map_or(0.0, |l| 36.0 + l.height());
        let top = a.y + ((a.h - group) * 0.42).max(0.0);
        let rule_y = top + expression.height() + 36.0;
        let mut nodes = vec![self.lines(&expression, a.x, top, a.w, Align::Left, &self.p.muted, cue, &[])];
        nodes.push(rect(a.x, rule_y, a.w * self.m.grow(self.t - cue - 0.3, 0.6), 3.0, &self.p.line()));
        nodes.push(self.lines(&result, a.x, rule_y + 35.0, a.w, Align::Left, &self.p.accent, cue + 0.6, &[]));
        if let Some(why) = why {
            nodes.push(self.rise(
                self.draw(&why, a.x, rule_y + 35.0 + result.height() + 36.0, a.w, Align::Left, &self.p.ink),
                cue + 1.0,
                14.0,
            ));
        }
        fframes::svgr!(<g>{nodes}</g>)
    }
    pub(crate) fn callout(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let icon = s(p, "icon");
        let pad = if self.wide { 64.0 } else { 48.0 };
        let icon_w = if icon.is_empty() { 0.0 } else { 104.0 };
        let inner = a.w - 2.0 * pad - icon_w - 12.0;
        let label = s(p, "label");
        let label = (!label.trim().is_empty()).then(|| self.fit(label, Style::kicker(22.0), inner, 60.0));
        let body = self.fit(
            s(p, "text"),
            Style::display(Font::Display, if self.wide { 76.0 } else { 62.0 }).leading(1.08),
            inner,
            a.h * 0.5,
        );
        let sup = s(p, "support");
        let sup = (!sup.trim().is_empty()).then(|| self.fit(sup, Style::text(32.0), inner, a.h * 0.24));
        let content = label.as_ref().map_or(0.0, |l| l.height() + 22.0)
            + body.height()
            + sup.as_ref().map_or(0.0, |l| 26.0 + l.height());
        let card_h = (content + 2.0 * pad).min(a.h);
        let top = a.y + ((a.h - card_h) * 0.42).max(0.0);
        let cue = self.b.cue_seconds;
        let x = a.x + pad + 12.0 + icon_w;
        let mut nodes = vec![
            rounded(a.x, top, a.w, card_h, 30.0, &self.p.surface),
            rounded(a.x, top, 12.0, card_h, 6.0, &self.p.accent),
        ];
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
        nodes.push(self.lines(
            &body,
            x,
            y,
            inner,
            Align::Left,
            &self.p.ink,
            cue + 0.1,
            &self.emphasis(&body, &phrases(p, "emphasis"), &self.p.accent),
        ));
        y += body.height() + 26.0;
        if let Some(sup) = &sup {
            nodes.push(self.rise(self.draw(sup, x, y, inner, Align::Left, &self.p.muted), cue + 0.5, 12.0));
        }
        self.rise(fframes::svgr!(<g>{nodes}</g>), cue - 0.15, 24.0)
    }
}

/// A mixed-face headline laid out by `Draw::rich`.
pub(crate) struct Rich {
    pub(crate) lines: Vec<Vec<(String, bool, f32)>>,
    size: f32,
    space: f32,
    line_h: f32,
    font: Font,
    /// The emphasis face and its size relative to `font`.
    mark: Font,
    mark_scale: f32,
}
