//! Frame-pure charts. Geometry always starts from a shared zero baseline or an explicit
//! domain, value labels count in step with the marks they describe, and every animation
//! finishes on the exact authored value.
use super::*;
use std::f32::consts::TAU;

/// (decimals, prefix, suffix) of a chart format object or unit string.
fn format_parts(format: &Value) -> (usize, String, String) {
    match format.as_str() {
        Some(suffix) => (0, String::new(), suffix.to_owned()),
        None => (n(format, "decimals", 0.0) as usize, s(format, "prefix").to_owned(), s(format, "suffix").to_owned()),
    }
}

/// Human tick steps (1, 2, 2.5, 5 × 10ⁿ) inside `[low, high]`; labels never round a
/// tick into a value it does not represent.
pub(crate) fn nice_ticks(low: f64, high: f64, target: usize) -> (Vec<f64>, usize) {
    let span = (high - low).abs().max(1e-12);
    let raw = span / target.max(1) as f64;
    let magnitude = 10f64.powf(raw.log10().floor());
    let step = [1.0, 2.0, 2.5, 5.0, 10.0]
        .iter()
        .map(|m| m * magnitude)
        .find(|s| *s >= raw * 0.999)
        .unwrap_or(10.0 * magnitude);
    let first = (low / step - 1e-9).ceil() * step;
    let mut ticks = vec![];
    let mut value = first;
    while value <= high + step * 1e-9 && ticks.len() < 20 {
        ticks.push(if value.abs() < step * 1e-9 { 0.0 } else { value });
        value += step;
    }
    let decimals = (0..=8)
        .find(|d| {
            let scaled = step * 10f64.powi(*d as i32);
            (scaled - scaled.round()).abs() < 1e-6
        })
        .unwrap_or(8);
    (ticks, decimals)
}

/// A bar that is square at its baseline and softly rounded at its value end.
fn bar_path(x: f32, y: f32, w: f32, h: f32, horizontal: bool) -> String {
    let r = (if horizontal { h } else { w } / 2.0).min(10.0).min(if horizontal { w } else { h });
    if r <= 0.5 {
        return format!("M {x} {y} h {w} v {h} h {} Z", -w);
    }
    if horizontal {
        format!(
            "M {x} {y} H {} Q {} {y} {} {} V {} Q {} {} {} {} H {x} Z",
            x + w - r,
            x + w,
            x + w,
            y + r,
            y + h - r,
            x + w,
            y + h,
            x + w - r,
            y + h
        )
    } else {
        format!(
            "M {x} {} V {} Q {x} {y} {} {y} H {} Q {} {y} {} {} V {} Z",
            y + h,
            y + r,
            x + r,
            x + w - r,
            x + w,
            x + w,
            y + r,
            y + h
        )
    }
}

impl<'a, 'c, 'm> Draw<'a, 'c, 'm> {
    fn focus(&self) -> (Option<usize>, f32, f32) {
        let focus = &self.props()["focus"];
        if !focus.is_object() {
            return (None, 0.0, 1.0);
        }
        let index = focus.get("index").and_then(Value::as_u64).map(|v| v as usize);
        let at = n(focus, "at", self.b.cue_seconds as f64 + 1.4) as f32;
        let duration = n(focus, "dur", 0.5) as f32;
        let progress = if duration <= 0.0 {
            if self.t >= at { 1.0 } else { 0.0 }
        } else {
            motion::in_out_cubic((self.t - at) / duration)
        };
        (index, progress, n(focus, "dim", 0.28).clamp(0.0, 1.0) as f32)
    }

    pub(super) fn bars(&self) -> Svgr<'a> {
        let a = self.area;
        let props = self.props();
        let rows = arr(props, "data");
        let count = rows.len().max(1);
        let max = n(props, "max", rows.iter().map(|r| n(r, "value", 0.0)).fold(0.0, f64::max)).max(1e-9);
        let (decimals, prefix, suffix) = format_parts(&props["format"]);
        let (focus_index, focus_p, dim) = self.focus();
        let note = s(&props["focus"], "note");
        let chart_h = a.h - if note.is_empty() { 0.0 } else { 86.0 };
        let cue = self.b.cue_seconds;
        let value_size = if self.wide { 32.0 } else { 30.0 };
        let value_w = rows
            .iter()
            .map(|r| {
                text::measure(
                    Font::TextStrong,
                    &format_number(n(r, "value", 0.0), decimals, &prefix, &suffix),
                    value_size,
                    0.0,
                )
            })
            .fold(0.0, f32::max);
        let mut shapes = vec![];
        let row_opacity =
            |i: usize| if focus_index.is_some_and(|f| f != i) { 1.0 - focus_p * (1.0 - dim) } else { 1.0 };
        if s(props, "orientation") != "vertical" {
            let stacked = !self.wide;
            let label_style = Style::text(if self.wide { 32.0 } else { 30.0 });
            let label_w = if stacked {
                a.w
            } else {
                rows.iter()
                    .map(|r| text::measure(Font::Text, s(r, "label"), label_style.size, 0.0))
                    .fold(0.0, f32::max)
                    .clamp(a.w * 0.14, a.w * 0.3)
                    + 32.0
            };
            let plot_x = if stacked { a.x } else { a.x + label_w };
            let plot_w = a.x + a.w - plot_x - value_w - 24.0;
            let row_h = chart_h / count as f32;
            let thickness = if stacked { (row_h * 0.36).min(44.0) } else { (row_h * 0.52).min(58.0) };
            shapes.push(rect(plot_x - 2.0, a.y, 2.0, chart_h * self.m.grow(self.t - cue + 0.3, 0.5), &self.p.line()));
            for (i, row) in rows.iter().enumerate() {
                let y0 = a.y + i as f32 * row_h;
                let bar_y =
                    if stacked { y0 + row_h - thickness - row_h * 0.16 } else { y0 + (row_h - thickness) / 2.0 };
                let label_h = if stacked { bar_y - y0 - 10.0 } else { row_h * 0.92 };
                let layout = self.fit(
                    s(row, "label"),
                    label_style,
                    if stacked { a.w } else { label_w - 32.0 },
                    label_h.max(20.0),
                );
                let label_y = if stacked {
                    bar_y - 10.0 - layout.height()
                } else {
                    bar_y + thickness / 2.0 - layout.height() / 2.0
                };
                let label = self.draw(
                    &layout,
                    a.x,
                    label_y,
                    if stacked { a.w } else { label_w - 32.0 },
                    if stacked { Align::Left } else { Align::Right },
                    &self.p.ink,
                );
                let time = cue + i as f32 * 0.09;
                let grow = self.m.grow(self.t - time, 1.1);
                let value = n(row, "value", 0.0);
                let width = plot_w * zero_scale(value, max) as f32 * grow;
                let focused = focus_index == Some(i) && focus_p > 0.0;
                let bar = fframes::svgr!(<path d={bar_path(plot_x, bar_y, width, thickness, true)} fill={self.p.accent.clone()} />);
                let shown = if grow > 0.0 {
                    format_number(value * grow as f64, decimals, &prefix, &suffix)
                } else {
                    String::new()
                };
                let number = self.run(
                    shown,
                    plot_x + width + 16.0,
                    bar_y + thickness / 2.0 + value_size * 0.36,
                    Font::TextStrong,
                    value_size,
                    0.0,
                    if focused { &self.p.accent } else { &self.p.ink },
                );
                shapes.push(
                    fframes::svgr!(<g opacity={row_opacity(i)}>{self.rise(label, time - 0.15, 10.0)}{bar}{number}</g>),
                );
            }
        } else {
            let slot = a.w / count as f32;
            let bar_w = (slot * 0.56).min(170.0);
            let label_style = Style::text(if self.wide { 30.0 } else { 26.0 });
            let labels: Vec<_> =
                rows.iter().map(|r| self.fit(s(r, "label"), label_style, slot - 16.0, 104.0)).collect();
            let label_h = labels.iter().map(|l| l.height()).fold(0.0, f32::max);
            let baseline = a.y + chart_h - label_h - 22.0;
            let plot_top = a.y + value_size * 1.6;
            let plot_h = baseline - plot_top;
            shapes.push(rect(a.x, baseline, a.w * self.m.grow(self.t - cue + 0.3, 0.5), 2.0, &self.p.line()));
            for (i, row) in rows.iter().enumerate() {
                let x = a.x + slot * i as f32 + (slot - bar_w) / 2.0;
                let time = cue + i as f32 * 0.09;
                let grow = self.m.grow(self.t - time, 1.1);
                let value = n(row, "value", 0.0);
                let height = plot_h * zero_scale(value, max) as f32 * grow;
                let focused = focus_index == Some(i) && focus_p > 0.0;
                let bar = fframes::svgr!(<path d={bar_path(x, baseline - height, bar_w, height, false)} fill={self.p.accent.clone()} />);
                let shown = if grow > 0.0 {
                    format_number(value * grow as f64, decimals, &prefix, &suffix)
                } else {
                    String::new()
                };
                let shown_w = text::measure(Font::TextStrong, &shown, value_size, 0.0);
                let number = self.run(
                    shown,
                    x + (bar_w - shown_w) / 2.0,
                    baseline - height - 16.0,
                    Font::TextStrong,
                    value_size,
                    0.0,
                    if focused { &self.p.accent } else { &self.p.ink },
                );
                let label = self.draw(
                    &labels[i],
                    a.x + slot * i as f32 + 8.0,
                    baseline + 20.0,
                    slot - 16.0,
                    Align::Center,
                    &self.p.ink,
                );
                shapes.push(
                    fframes::svgr!(<g opacity={row_opacity(i)}>{bar}{number}{self.rise(label, time - 0.15, 8.0)}</g>),
                );
            }
        }
        if !note.is_empty() && focus_p > 0.0 {
            let layout = self.fit(note, Style::strong(30.0), a.w - 36.0, 70.0);
            let y = a.y + a.h - layout.height() - 8.0;
            let dot = fframes::svgr!(<circle cx={a.x + 9.0} cy={y + layout.baseline - layout.size * 0.35} r="9" fill={self.p.accent.clone()} />);
            let body = fframes::svgr!(<g>{dot}{self.draw(&layout, a.x + 32.0, y, a.w - 36.0, Align::Left, &self.p.accent)}</g>);
            let e = motion::out_cubic(focus_p * 1.4);
            shapes.push(
                fframes::svgr!(<g opacity={e} transform={format!("translate(0 {})", 10.0 * (1.0 - e))}>{body}</g>),
            );
        }
        fframes::svgr!(<g>{shapes}</g>)
    }

    pub(super) fn line(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let series = arr(p, "series");
        let (decimals, prefix, suffix) = format_parts(&p["format"]);
        let low = n(p, "min", series.iter().map(|v| n(v, "y", 0.0)).fold(0.0, f64::min));
        let high = n(p, "max", series.iter().map(|v| n(v, "y", 0.0)).fold(low, f64::max));
        let span = (high - low).max(1e-9);
        let (ticks, tick_decimals) = nice_ticks(low, high, if self.tall() { 4 } else { 5 });
        let tick_decimals = tick_decimals.max(decimals);
        let tick_size = 24.0;
        let tick_labels: Vec<String> =
            ticks.iter().map(|v| format_number(*v, tick_decimals, &prefix, &suffix)).collect();
        let label_w =
            tick_labels.iter().map(|l| text::measure(Font::Text, l, tick_size, 0.0)).fold(0.0, f32::max) + 22.0;
        let last_value = series.last().map_or(0.0, |v| n(v, "y", 0.0));
        let end_label = format_number(last_value, decimals, &prefix, &suffix);
        let end_w = text::measure(Font::TextStrong, &end_label, 34.0, 0.0) + 36.0;
        let x = a.x + label_w;
        let w = a.w - label_w - end_w;
        let y = a.y + 16.0;
        let h = a.h - 96.0;
        let minx = series.first().map_or(0.0, |v| n(v, "x", 0.0));
        let maxx = series.last().map_or(1.0, |v| n(v, "x", 1.0));
        let xrange = (maxx - minx).max(1e-9);
        let cue = self.b.cue_seconds;
        let mut shapes = vec![];
        let grid = self.m.grow(self.t - cue + 0.35, 0.6);
        for (value, label) in ticks.iter().zip(&tick_labels) {
            let ty = y + h - ((*value - low) / span) as f32 * h;
            let color = if *value == 0.0 && low < 0.0 { self.p.muted.clone() } else { self.p.line() };
            shapes.push(rect(x, ty - 0.75, w * grid, 1.5, &color));
            let lw = text::measure(Font::Text, label, tick_size, 0.0);
            shapes.push(self.run(
                label.clone(),
                x - 18.0 - lw,
                ty + tick_size * 0.35,
                Font::Text,
                tick_size,
                0.0,
                &self.p.muted,
            ));
        }
        let progress = self.m.grow(self.t - cue, 1.6);
        let count = series.len();
        let traversed = progress * count.saturating_sub(1) as f32;
        let mut points = vec![];
        for (i, item) in series.iter().enumerate() {
            if i as f32 > traversed + 1.0 {
                break;
            }
            let mut px = x + ((n(item, "x", i as f64) - minx) / xrange) as f32 * w;
            let mut py = y + h - ((n(item, "y", 0.0) - low) / span) as f32 * h;
            if i as f32 > traversed {
                let Some(&(prev_x, prev_y)) = points.last() else { break };
                let part = traversed.fract();
                px = prev_x + (px - prev_x) * part;
                py = prev_y + (py - prev_y) * part;
            }
            points.push((px, py));
            if i as f32 >= traversed {
                break;
            }
        }
        if points.len() >= 2 {
            let base_y = y + h - ((0.0f64.clamp(low, high) - low) / span) as f32 * h;
            let line: String = points
                .iter()
                .enumerate()
                .map(|(i, (px, py))| format!("{} {px} {py} ", if i == 0 { "M" } else { "L" }))
                .collect();
            let (first_x, last_x) = (points[0].0, points[points.len() - 1].0);
            let area = format!("{line}L {last_x} {base_y} L {first_x} {base_y} Z");
            let gradient = self.uid("area");
            shapes.push(fframes::svgr!(<g>
                <defs><linearGradient id={gradient.clone()} gradientUnits="userSpaceOnUse" x1="0" y1={y} x2="0" y2={base_y}>
                    <stop offset="0" stop-color={self.p.accent.clone()} stop-opacity={if self.p.dark { 0.34 } else { 0.24 }} />
                    <stop offset="1" stop-color={self.p.accent.clone()} stop-opacity="0" />
                </linearGradient></defs>
                <path d={area} fill={format!("url(#{gradient})")} />
                <path d={line} stroke={self.p.accent.clone()} stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </g>));
        }
        if let Some(&(cx, cy)) = points.last() {
            let pulse = ((self.t - cue).max(0.0) / 1.6).fract();
            shapes.push(fframes::svgr!(<g>
                <circle cx={cx} cy={cy} r={10.0 + 18.0 * pulse} fill={self.p.accent.clone()} opacity={0.28 * (1.0 - pulse)} />
                <circle cx={cx} cy={cy} r="10" fill={self.p.bg.clone()} stroke={self.p.accent.clone()} stroke-width="5" />
            </g>));
            if progress >= 0.999 {
                let e = self.enter(cue + 1.6);
                shapes.push(fframes::svgr!(<g opacity={e.alpha}>{self.run(end_label, cx + 26.0, cy + 12.0, Font::TextStrong, 34.0, 0.0, &self.p.accent)}</g>));
            }
        }
        let labels = arr(p, "labels");
        let xs: Vec<f64> = series.iter().enumerate().map(|(i, v)| n(v, "x", i as f64)).collect();
        for i in axis_label_indices(&xs) {
            let Some(label) = labels.get(i) else { continue };
            let lx = x + w * ((xs[i] - minx) / xrange) as f32;
            let width = (w / 7.0).min(180.0);
            let (node, _) = self.para(
                label.as_str().unwrap_or(""),
                Area { x: lx - width / 2.0, y: y + h + 22.0, w: width, h: 70.0 },
                Style::text(24.0),
                &self.p.muted,
                Align::Center,
            );
            shapes.push(self.rise(node, cue - 0.2, 6.0));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }

    pub(super) fn waffle(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let total = n(p, "total", 100.0) as usize;
        let cols = n(p, "cols", 10.0).max(1.0) as usize;
        let count = n(p, "value", 0.0) as usize;
        let icon = s(p, "icon");
        let rows = total.div_ceil(cols).max(1);
        let (grid_w, grid_h) = if self.wide { (a.w * 0.46, a.h * 0.92) } else { (a.w, a.h * 0.6) };
        let cell = (grid_w / cols as f32).min(grid_h / rows as f32);
        let gap = (cell * 0.16).max(3.0);
        let grid_top = a.y + if self.wide { (a.h - cell * rows as f32) / 2.0 } else { 0.0 };
        let cue = self.b.cue_seconds;
        let fill_start = cue + 0.35 + (rows + cols) as f32 * 0.012;
        let fill = self.m.grow(self.t - fill_start, 1.3);
        let filled = fill * count as f32;
        let mut tiles = vec![];
        for i in 0..total {
            let (row, col) = (i / cols, i % cols);
            let (x, y) = (a.x + col as f32 * cell, grid_top + row as f32 * cell);
            let size = cell - gap;
            let arrival = self.m.enter_over(self.t - cue - (row + col) as f32 * 0.012, 0.4);
            if arrival.hidden() {
                continue;
            }
            let amount = (filled - i as f32).clamp(0.0, 1.0);
            let color = if amount >= 1.0 {
                self.p.accent.clone()
            } else if amount > 0.0 {
                design_mix(&self.p.line(), &self.p.accent, amount)
            } else {
                self.p.line()
            };
            let shape = if icon.is_empty() {
                rounded(x, y, size, size, size * 0.2, &color)
            } else {
                crate::icons::render(icon, x, y, size, &color)
            };
            let scale = 0.5 + 0.5 * arrival.travel;
            let (cx, cy) = (x + size / 2.0, y + size / 2.0);
            tiles.push(fframes::svgr!(<g opacity={arrival.alpha} transform={format!("translate({cx} {cy}) scale({scale}) translate({} {})", -cx, -cy)}>{shape}</g>));
        }
        let (tx, ty, tw, th) = if self.wide {
            (a.x + a.w * 0.56, a.y, a.w * 0.44, a.h)
        } else {
            (a.x, grid_top + cell * rows as f32 + 36.0, a.w, a.y + a.h - (grid_top + cell * rows as f32 + 36.0))
        };
        let size = if self.wide { 150.0 } else { 104.0 };
        let shown = filled.floor().min(count as f32) as f64;
        let label = self.fit(
            s(p, "label"),
            Style::display(Font::Display, if self.wide { 40.0 } else { 36.0 }),
            tw,
            (th - size * 1.1 - 40.0).max(40.0),
        );
        let group = size * 0.95 + 28.0 + label.height();
        let top = ty + ((th - group) * if self.wide { 0.45 } else { 0.0 }).max(0.0);
        let (number, _) = self.numeral(
            shown,
            count as f64,
            0,
            "",
            &format!(" of {total}"),
            tx,
            top + size * 0.78,
            size,
            None,
            &self.p.accent,
            &self.p.muted,
        );
        let label = self.lines(&label, tx, top + size * 0.95 + 28.0, tw, Align::Left, &self.p.ink, cue + 0.4, &[]);
        let e = self.enter(cue + 0.2);
        fframes::svgr!(<g>{tiles}<g opacity={e.alpha}>{number}</g>{label}</g>)
    }

    pub(super) fn ring(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let (value, max) = (n(p, "value", 0.0), n(p, "max", 100.0));
        let decimals = n(p, "decimals", 0.0) as usize;
        let cue = self.b.cue_seconds;
        let progress = self.m.grow(self.t - cue, 1.4);
        let diameter = if self.wide { (a.w * 0.4).min(a.h * 0.94) } else { (a.w * 0.76).min(a.h * 0.62) };
        let stroke = (diameter * 0.085).clamp(18.0, 40.0);
        let r = diameter / 2.0 - stroke / 2.0;
        let (cx, cy) =
            if self.wide { (a.x + diameter / 2.0, a.y + a.h / 2.0) } else { (a.x + a.w / 2.0, a.y + diameter / 2.0) };
        let circumference = TAU * r;
        let arc = circumference * zero_scale(value, max) as f32 * progress;
        let cap = if arc > stroke * 0.5 { "round" } else { "butt" };
        let e = self.enter(cue - 0.2);
        let shape = fframes::svgr!(<g opacity={e.alpha}>
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={self.p.surface.clone()} stroke-width={stroke} />
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={self.p.accent.clone()} stroke-width={stroke} stroke-linecap={cap}
                stroke-dasharray={format!("{} {circumference}", arc.max(0.001))} transform={format!("rotate(-90 {cx} {cy})")} />
        </g>);
        let percent = max == 100.0;
        let inner = (r - stroke) * 1.6;
        let size = self.numeral_size(value, decimals, "", if percent { "%" } else { "" }, (r * 0.62).min(150.0), inner);
        let current = value * progress as f64;
        let (number, _) = self.numeral(
            current,
            value,
            decimals,
            "",
            if percent { "%" } else { "" },
            cx - inner / 2.0,
            cy + size * 0.36 - if percent { 0.0 } else { size * 0.18 },
            size,
            Some(inner),
            &self.p.ink,
            &self.p.ink,
        );
        let of = if percent {
            empty()
        } else {
            let layout = self.fit(
                &format!("of {}", format_number(max, decimals, "", "")),
                Style::text((size * 0.3).max(22.0)),
                inner,
                60.0,
            );
            self.draw(&layout, cx - inner / 2.0, cy + size * 0.36, inner, Align::Center, &self.p.muted)
        };
        let label_box = if self.wide {
            Area { x: a.x + diameter + 90.0, y: a.y, w: a.w - diameter - 90.0, h: a.h }
        } else {
            Area { x: a.x, y: cy + diameter / 2.0 + 44.0, w: a.w, h: a.y + a.h - (cy + diameter / 2.0 + 44.0) }
        };
        let label = self.fit(
            s(p, "label"),
            Style::display(Font::Display, if self.wide { 50.0 } else { 44.0 }),
            label_box.w,
            label_box.h,
        );
        let label_y = if self.wide { label_box.y + (label_box.h - label.height()) / 2.0 } else { label_box.y };
        let label = self.lines(
            &label,
            label_box.x,
            label_y,
            label_box.w,
            if self.wide { Align::Left } else { Align::Center },
            &self.p.ink,
            cue + 0.5,
            &[],
        );
        fframes::svgr!(<g>{shape}<g opacity={e.alpha}>{number}{of}</g>{label}</g>)
    }

    /// Part-to-whole: segments sweep in order, the legend states value and share.
    pub(super) fn donut(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let segments = arr(p, "segments");
        let values: Vec<f64> = segments.iter().map(|v| n(v, "value", 0.0).max(0.0)).collect();
        let total: f64 = values.iter().sum::<f64>().max(1e-12);
        let (decimals, prefix, suffix) = format_parts(&p["format"]);
        let cue = self.b.cue_seconds;
        let progress = self.m.grow(self.t - cue, 1.5) as f64;
        let diameter = if self.wide { (a.w * 0.42).min(a.h * 0.96) } else { (a.w * 0.72).min(a.h * 0.5) };
        let stroke = (diameter * 0.16).clamp(30.0, 90.0);
        let r = diameter / 2.0 - stroke / 2.0;
        let (cx, cy) =
            if self.wide { (a.x + diameter / 2.0, a.y + a.h / 2.0) } else { (a.x + a.w / 2.0, a.y + diameter / 2.0) };
        let circumference = TAU * r;
        let gap = if segments.len() > 1 { 5.0 } else { 0.0 };
        let mut arcs = vec![
            fframes::svgr!(<circle cx={cx} cy={cy} r={r} fill="none" stroke={self.p.surface.clone()} stroke-width={stroke} />),
        ];
        let mut start = 0.0f64;
        for (i, value) in values.iter().enumerate() {
            let share = value / total;
            let visible = (progress - start).clamp(0.0, share);
            let length = visible as f32 * circumference - gap;
            if length > 0.5 {
                let angle = -90.0 + start as f32 * 360.0 + gap / 2.0 / circumference * 360.0;
                arcs.push(fframes::svgr!(<circle cx={cx} cy={cy} r={r} fill="none" stroke={self.p.series(i)} stroke-width={stroke}
                    stroke-dasharray={format!("{length} {circumference}")} transform={format!("rotate({angle} {cx} {cy})")} />));
            }
            start += share;
        }
        let center_label = s(p, "center");
        let inner = (r - stroke / 2.0) * 1.5;
        let size = self.numeral_size(total, decimals, &prefix, &suffix, (r * 0.42).min(110.0), inner);
        let (number, _) = self.numeral(
            total * progress.min(1.0),
            total,
            decimals,
            &prefix,
            &suffix,
            cx - inner / 2.0,
            cy + size * 0.3 - if center_label.is_empty() { 0.0 } else { size * 0.2 },
            size,
            Some(inner),
            &self.p.ink,
            &self.p.ink,
        );
        let caption = if center_label.is_empty() {
            empty()
        } else {
            let layout = self.fit(center_label, Style::text((size * 0.3).max(22.0)), inner, 64.0);
            self.draw(&layout, cx - inner / 2.0, cy + size * 0.3, inner, Align::Center, &self.p.muted)
        };
        // Legend: swatch, label, value and share.
        let legend = if self.wide {
            Area { x: a.x + diameter + 90.0, y: a.y, w: (a.w - diameter - 90.0).min(780.0), h: a.h }
        } else {
            Area { x: a.x, y: cy + diameter / 2.0 + 40.0, w: a.w, h: a.y + a.h - (cy + diameter / 2.0 + 40.0) }
        };
        let row_h = (legend.h / segments.len().max(1) as f32).min(96.0);
        let legend_top =
            legend.y + ((legend.h - row_h * segments.len() as f32) / 2.0).max(0.0) * if self.wide { 1.0 } else { 0.0 };
        let mut rows = vec![];
        let mut start = 0.0f64;
        for (i, segment) in segments.iter().enumerate() {
            let share = values[i] / total;
            let y = legend_top + i as f32 * row_h;
            let value = format_number(values[i], decimals, &prefix, &suffix);
            let percent = format!("{}%", format_number(share * 100.0, if share < 0.1 { 1 } else { 0 }, "", ""));
            let stat = format!("{value} · {percent}");
            let stat_w = text::measure(Font::TextStrong, &stat, 28.0, 0.0);
            let label = self.fit(s(segment, "label"), Style::text(30.0), legend.w - stat_w - 76.0, row_h - 12.0);
            let row = fframes::svgr!(<g>
                {rounded(legend.x, y + label.baseline - 24.0, 26.0, 26.0, 7.0, &self.p.series(i))}
                {self.draw(&label, legend.x + 44.0, y, legend.w - stat_w - 76.0, Align::Left, &self.p.ink)}
                {self.run(stat, legend.x + legend.w - stat_w, y + label.baseline, Font::TextStrong, 28.0, 0.0, &self.p.muted)}
            </g>);
            // Each legend row arrives as its segment begins to draw (sweep is ~1.5s long).
            rows.push(self.rise(row, cue + start as f32 * 1.1, 12.0));
            start += share;
        }
        fframes::svgr!(<g>{arcs}{number}{caption}{rows}</g>)
    }

    pub(super) fn funnel(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let items = arr(p, "items");
        let values: Vec<f64> = items.iter().map(|i| n(i, "value", 0.0)).collect();
        let max = values.iter().copied().fold(0.0, f64::max).max(1e-9);
        let (decimals, prefix, suffix) = format_parts(&p["format"]);
        let rates = p.get("rates").and_then(Value::as_bool).unwrap_or(true);
        let row_h = (a.h / items.len().max(1) as f32).min(if self.wide { 200.0 } else { 190.0 });
        let a = Area { y: a.y + ((a.h - row_h * items.len() as f32) * 0.4).max(0.0), ..a };
        let plot_w = if self.wide { a.w * 0.56 } else { a.w * 0.54 };
        let bar_h = (row_h * if rates { 0.62 } else { 0.74 }).min(110.0);
        let mut shapes = vec![];
        for (i, item) in items.iter().enumerate() {
            let value = values[i];
            let y = a.y + i as f32 * row_h;
            let time = at(item, self.b.cue_seconds, i);
            let grow = self.m.grow(self.t - time, 0.9);
            let width = plot_w * zero_scale(value, max) as f32 * grow;
            let left = a.x + (plot_w - width) / 2.0;
            let bar = rounded(left, y, width, bar_h, 14.0f32.min(bar_h / 2.0), &self.p.accent);
            let text_x = a.x + plot_w + 44.0;
            let text_w = a.w - plot_w - 44.0;
            let title = self.fit(s(item, "label"), Style::display(Font::Display, 36.0), text_w, bar_h * 0.6);
            let number = format_number(value * grow as f64, decimals, &prefix, &suffix);
            let label_top = y + (bar_h - title.height() - 40.0) / 2.0;
            let texts = fframes::svgr!(<g>
                {self.draw(&title, text_x, label_top, text_w, Align::Left, &self.p.ink)}
                {self.run(number, text_x, label_top + title.height() + 30.0, Font::TextStrong, 28.0, 0.0, &self.p.muted)}
            </g>);
            shapes.push(fframes::svgr!(<g>{bar}{self.rise(texts, time, 12.0)}</g>));
            if rates && i > 0 && values[i - 1] > 0.0 {
                let rate = values[i] / values[i - 1] * 100.0;
                let chip = format!("↓ {}%", format_number(rate, if rate < 10.0 { 1 } else { 0 }, "", ""));
                let w = text::measure(Font::TextStrong, &chip, 24.0, 0.0);
                let gap_mid = y - (row_h - bar_h) / 2.0;
                let node =
                    self.run(chip, a.x + (plot_w - w) / 2.0, gap_mid + 9.0, Font::TextStrong, 24.0, 0.0, &self.p.muted);
                shapes.push(self.rise(node, time + 0.3, 6.0));
            }
        }
        fframes::svgr!(<g>{shapes}</g>)
    }

    /// Area-true squares for quantities that differ by orders of magnitude. One hue, so
    /// area is the only variable; squares too small to find get a locator ring.
    pub(super) fn magnitude(&self) -> Svgr<'a> {
        let a = self.area;
        let p = self.props();
        let items = arr(p, "items");
        let values: Vec<f64> = items.iter().map(|i| n(i, "value", 0.0).max(0.0)).collect();
        let (decimals, prefix, suffix) = format_parts(&p["format"]);
        let largest = values.iter().copied().fold(0.0, f64::max).max(1e-12);
        let min_gap = 48.0;
        let gaps = min_gap * (values.len() as f32 - 1.0);
        let texts: Vec<String> = values.iter().map(|v| format_number(*v, decimals, &prefix, &suffix)).collect();
        let labels: Vec<_> = items
            .iter()
            .map(|it| self.fit(s(it, "label"), Style::text(26.0), a.w / values.len() as f32 - min_gap, 64.0))
            .collect();
        // Value type shrinks until every column fits side by side; labels are already fitted.
        let mut value_size: f32 = if self.wide { 44.0 } else { 38.0 };
        let widest = |size: f32| {
            texts
                .iter()
                .zip(&labels)
                .map(|(t, l)| text::measure(Font::DisplayBold, t, size, 0.0).max(l.width()))
                .sum::<f32>()
        };
        while value_size > 20.0 && widest(value_size) + gaps > a.w {
            value_size -= 1.0;
        }
        let text_w: Vec<f32> = texts
            .iter()
            .zip(&labels)
            .map(|(t, l)| text::measure(Font::DisplayBold, t, value_size, 0.0).max(l.width()))
            .collect();
        if text_w.iter().sum::<f32>() + gaps > a.w + 0.5 {
            panic!(
                "Text overflow in scene '{}' (magnitude): values and labels need {:.0}px side by side but the row is {:.0}px. Shorten the values, units or labels, or use fewer items; the minimum font size is 14px.",
                self.b.id,
                text_w.iter().sum::<f32>() + gaps,
                a.w
            );
        }
        let text_h = value_size * 1.2 + 16.0 + labels.iter().map(|l| l.height()).fold(0.0, f32::max);
        let mut k = (a.h - text_h - 40.0).max(40.0) / (largest.sqrt() as f32);
        let mut sides: Vec<f32> = vec![];
        let mut slots: Vec<f32> = vec![];
        for _ in 0..60 {
            sides = values.iter().map(|v| (v.sqrt() as f32) * k).collect();
            slots = sides.iter().zip(&text_w).map(|(s, t)| s.max(*t)).collect();
            if slots.iter().sum::<f32>() + min_gap * (values.len() as f32 - 1.0) <= a.w {
                break;
            }
            k *= 0.95;
        }
        let used: f32 = slots.iter().sum();
        let gap = ((a.w - used) / (values.len() as f32 - 1.0).max(1.0)).clamp(min_gap, 160.0);
        let total = used + gap * (values.len() as f32 - 1.0);
        let biggest = sides.iter().copied().fold(0.0, f32::max);
        let baseline = a.y + ((a.h - text_h - biggest) * 0.5).max(0.0) + biggest;
        let cue = self.b.cue_seconds;
        let mut x = a.x + ((a.w - total) / 2.0).max(0.0);
        let mut shapes = vec![rect(a.x, baseline, a.w * self.m.grow(self.t - cue + 0.3, 0.6), 2.0, &self.p.line())];
        for (i, item) in items.iter().enumerate() {
            let (side, slot) = (sides[i], slots[i]);
            let time = n(item, "at", (cue + i as f32 * 0.45) as f64) as f32;
            let visible = side * self.m.grow(self.t - time, 0.9);
            let is_max = values[i] >= largest;
            let color =
                if is_max { self.p.accent.clone() } else { crate::design::mix(&self.p.accent, &self.p.bg, 0.3) };
            shapes.push(rounded(x, baseline - visible, visible, visible, (visible * 0.06).min(10.0), &color));
            if side < 14.0 {
                // Honest size, findable location: a ring that is not part of the data.
                let e = self.enter(time + 0.4);
                let (cx, cy) = (x + side / 2.0, baseline - side / 2.0);
                shapes.push(fframes::svgr!(<circle cx={cx} cy={cy} r={16.0 + side / 2.0} fill="none" stroke={self.p.accent.clone()} stroke-width="2.5" opacity={e.alpha * 0.9} />));
            }
            let value = self.run(
                texts[i].clone(),
                x,
                baseline + 16.0 + value_size,
                Font::DisplayBold,
                value_size,
                0.0,
                if is_max { &self.p.accent } else { &self.p.ink },
            );
            let label = self.draw(
                &labels[i],
                x,
                baseline + value_size * 1.2 + 24.0,
                slot.max(labels[i].width()),
                Align::Left,
                &self.p.muted,
            );
            shapes.push(self.rise(fframes::svgr!(<g>{value}{label}</g>), time + 0.3, 10.0));
            x += slot + gap;
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
}

fn design_mix(a: &str, b: &str, t: f32) -> String {
    crate::design::mix(a, b, t)
}

pub(crate) fn axis_label_indices(xs: &[f64]) -> Vec<usize> {
    if xs.len() < 2 {
        return (0..xs.len()).collect();
    }
    let first = xs[0];
    let span = xs[xs.len() - 1] - first;
    let gap = span / 6.0;
    let mut indices = vec![0];
    let mut previous = first;
    for (i, &x) in xs.iter().enumerate().take(xs.len() - 1).skip(1) {
        if x - previous >= gap && xs[xs.len() - 1] - x >= gap {
            indices.push(i);
            previous = x;
        }
    }
    indices.push(xs.len() - 1);
    indices
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn nice_ticks_label_exact_values_inside_the_domain() {
        let (ticks, decimals) = nice_ticks(0.0, 30.0, 5);
        assert_eq!(ticks, vec![0.0, 10.0, 20.0, 30.0]);
        assert_eq!(decimals, 0);
        let (ticks, decimals) = nice_ticks(0.0, 1.0, 4);
        assert_eq!(ticks, vec![0.0, 0.25, 0.5, 0.75, 1.0]);
        assert_eq!(decimals, 2);
        let (ticks, _) = nice_ticks(-12.0, 47.0, 5);
        assert!(ticks.iter().all(|t| *t >= -12.0 && *t <= 47.0) && ticks.contains(&0.0));
        let (ticks, _) = nice_ticks(3.0, 3.0000001, 5);
        assert!(!ticks.is_empty() && ticks.len() <= 20);
    }
    #[test]
    fn dense_and_irregular_axes_keep_endpoints_without_collisions() {
        let indices = axis_label_indices(&[0.0, 0.1, 0.2, 4.0, 8.0, 10.0]);
        assert_eq!(indices, vec![0, 3, 4, 5]);
        let dense = (0..40).map(|i| i as f64).collect::<Vec<_>>();
        let indices = axis_label_indices(&dense);
        assert_eq!(indices.first(), Some(&0));
        assert_eq!(indices.last(), Some(&39));
        assert!(indices.len() <= 7);
    }
    #[test]
    fn bar_paths_stay_square_at_the_baseline() {
        assert!(bar_path(10.0, 20.0, 200.0, 40.0, true).starts_with("M 10 20 H"));
        assert!(bar_path(0.0, 0.0, 0.2, 40.0, true).contains("h 0.2"));
        assert!(bar_path(0.0, 0.0, 40.0, 0.0, false).contains('Z'));
    }
}
