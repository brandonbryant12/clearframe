//! Frame-pure illustrated diagrams and sequences. Timing and geometry are independently
//! implemented; every entrance is scheduled to finish before the scene's final frame.
use super::*;
use std::f32::consts::{PI, TAU};

/// Structural checks the renderer relies on. The catalog gives friendlier messages first;
/// this keeps a hand-written job from reaching an undrawable state.
pub(crate) fn validate(block: &str, props: &Value) -> Result<(), &'static str> {
    let icon_ok = |icon: &str| icon.is_empty() || crate::icons::supported(icon);
    match block {
        "callout" | "waffle" => return if icon_ok(s(props, "icon")) { Ok(()) } else { Err("unsupported native icon") },
        "checklist" => return if (2..=6).contains(&arr(props, "items").len()) { Ok(()) } else { Err("checklist needs 2–6 items") },
        "donut" => {
            let segments = arr(props, "segments");
            let sum: f64 = segments.iter().map(|v| n(v, "value", -1.0)).sum();
            return if (2..=6).contains(&segments.len()) && segments.iter().all(|v| n(v, "value", -1.0) >= 0.0) && sum > 0.0 { Ok(()) }
                else { Err("donut needs 2–6 nonnegative segments with a positive total") };
        }
        "magnitude" => {
            let items = arr(props, "items");
            return if (2..=4).contains(&items.len()) && items.iter().all(|v| n(v, "value", 0.0) > 0.0) { Ok(()) }
                else { Err("magnitude needs 2–4 positive values") };
        }
        "annotate" => {
            let pins = arr(props, "pins");
            let unit = |v: &Value, key: &str| n(v, key, -1.0) >= 0.0 && n(v, key, -1.0) <= 1.0;
            let focus = &props["focus"];
            let focus_ok = !focus.is_object() || (["x", "y", "w", "h"].iter().all(|k| unit(focus, k))
                && n(focus, "x", 0.0) + n(focus, "w", 0.0) <= 1.0 + 1e-9 && n(focus, "y", 0.0) + n(focus, "h", 0.0) <= 1.0 + 1e-9);
            return if (1..=6).contains(&pins.len()) && pins.iter().all(|p| unit(p, "x") && unit(p, "y")) && focus_ok { Ok(()) }
                else { Err("annotate needs 1–6 pins and a focus inside the image (0–1 coordinates)") };
        }
        "highlight" => {
            let text = s(props, "text").split_whitespace().collect::<Vec<_>>().join(" ");
            let found = phrases(props, "phrases").iter().all(|p| text::find_words(&text, &p.split_whitespace().collect::<Vec<_>>().join(" ")).is_some());
            return if found && (1..=4).contains(&arr(props, "phrases").len()) { Ok(()) } else { Err("highlight phrases must be 1–4 whole-word parts of the text") };
        }
        _ => {}
    }
    let entries = match block {
        "icon-grid" => arr(props, "items"), "flow" | "cycle" => arr(props, "nodes"),
        "breathing" => arr(props, "phases"), _ => return Ok(()),
    };
    let (min_count, max_count) = match block { "icon-grid" => (1, 8), "cycle" => (3, 6), _ => (2, 6) };
    if !(min_count..=max_count).contains(&entries.len()) { return Err("invalid diagram item count"); }
    for entry in entries {
        if s(entry, "label").trim().is_empty() { return Err("diagram labels must not be empty"); }
        let icon = s(entry, "icon");
        if (block == "icon-grid" || !icon.is_empty()) && !crate::icons::supported(icon) {
            return Err("unsupported native icon");
        }
        if let Some(time) = entry.get("at") {
            if !time.as_f64().is_some_and(|v| v.is_finite() && v >= 0.0) { return Err("invalid diagram cue"); }
        }
    }
    let bounded = |key: &str, default: f64, min: f64, max: f64| {
        let value = n(props, key, default); value.is_finite() && (min..=max).contains(&value)
    };
    match block {
        "icon-grid" | "flow" if !bounded("stagger", 0.45, 0.0, 2.0) => return Err("stagger must be 0..2"),
        "cycle" if !bounded("period", 8.0, 2.0, 60.0) => return Err("cycle period must be 2..60"),
        "breathing" => {
            if !bounded("minScale", 0.55, 0.2, 1.0) || !bounded("maxScale", 1.0, 0.2, 1.0)
                || n(props, "minScale", 0.55) >= n(props, "maxScale", 1.0) { return Err("invalid breathing scale bounds"); }
            for entry in entries {
                let seconds = n(entry, "seconds", 0.0);
                if !seconds.is_finite() || !(0.25..=30.0).contains(&seconds) { return Err("invalid breathing phase duration"); }
                let scale = s(entry, "scale");
                if !["expand", "hold", "contract"].contains(&scale) && !(entries.len() == 2 && scale.is_empty()) {
                    return Err("breathing phases need expand, hold, or contract");
                }
            }
        }
        _ => (),
    }
    Ok(())
}

fn staged_at(item: &Value, cue: f32, index: usize, stagger: f32) -> f32 {
    n(item, "at", (cue + index as f32 * stagger) as f64) as f32
}

fn vertical_flow(orientation: &str, width: f32, height: f32) -> bool {
    height > width || orientation == "vertical" || (orientation != "horizontal" && width / height <= 1.3)
}

fn cycle_position(time: f32, cue: f32, period: f32, clockwise: bool) -> (f32, f32) {
    let turns = (time - cue).max(0.0) / period.max(0.001);
    let angle = -PI / 2.0 + turns.rem_euclid(1.0) * TAU * if clockwise { 1.0 } else { -1.0 };
    (angle.cos(), angle.sin())
}

fn cycle_arrival(time: f32, cue: f32, index: usize, count: usize, last_frame: f32, preset: &str) -> f32 {
    let nominal_duration: f32 = match preset { "snappy" => 0.30, "spring" => 0.72, _ => 0.55 };
    let available = (last_frame - cue).max(0.0);
    let duration = nominal_duration.min(available);
    let step = 0.12_f32.min((available - duration - 0.08).max(0.0) / count.saturating_sub(1).max(1) as f32);
    let start = cue + index as f32 * step;
    if duration <= 0.0 { if time >= start { 1.0 } else { 0.0 } }
    else { motion::out_cubic((time - start) / duration) }
}

fn connector_progress(time: f32, cue: f32, next_cue: f32, last_frame: f32) -> f32 {
    // Snappy entrances may start only .30s before the final sample. Preserve that
    // authored cue while letting the line complete with its nodes before the cut.
    let duration = (next_cue - cue).max(0.45).min((last_frame - cue).max(0.0));
    if duration <= 0.0 { if time >= cue { 1.0 } else { 0.0 } }
    else { motion::out_cubic((time - cue) / duration) }
}

#[derive(Clone, Copy)]
struct CycleLayout { cx: f32, cy: f32, rx: f32, ry: f32, label_width: f32 }
impl CycleLayout {
    fn new(area: Area) -> Self {
        Self { cx: area.x + area.w * 0.5, cy: area.y + area.h * 0.5,
            rx: (area.w * 0.32).min(490.0), ry: ((area.h - 248.0) * 0.5).min(360.0),
            label_width: (area.w * 0.265).min(285.0) }
    }
    fn angle(index: usize, count: usize, clockwise: bool) -> f32 {
        -PI / 2.0 + index as f32 / count as f32 * TAU * if clockwise { 1.0 } else { -1.0 }
    }
    fn node(&self, index: usize, count: usize, clockwise: bool) -> (f32, f32, Area) {
        let angle = Self::angle(index, count, clockwise);
        let x = self.cx + self.rx * angle.cos();
        let y = self.cy + self.ry * angle.sin();
        // Outward label bands keep upper labels clear of the lower side icons.
        let label_y = if angle.sin() < -0.1 { y - 47.0 - 74.0 } else { y + 47.0 };
        (x, y, Area { x: x - self.label_width * 0.5, y: label_y, w: self.label_width, h: 74.0 })
    }
}

/// Phase index and seconds elapsed within it (half-open intervals, looping).
fn phase_clock(phases: &[Value], time: f32, cue: f32) -> (usize, f32) {
    let period: f32 = phases.iter().map(|p| n(p, "seconds", 1.0) as f32).sum();
    if phases.is_empty() || period <= 0.0 { return (0, 0.0); }
    let mut elapsed = (time - cue).max(0.0).rem_euclid(period);
    for (index, phase) in phases.iter().enumerate() {
        let duration = n(phase, "seconds", 1.0) as f32;
        if elapsed < duration || index == phases.len() - 1 { return (index, elapsed); }
        elapsed -= duration;
    }
    (0, 0.0)
}

/// Half-open phase intervals; a hold inherits the preceding target across the loop seam.
fn breathing_state(phases: &[Value], time: f32, cue: f32, min: f32, max: f32) -> (usize, f32) {
    let period: f32 = phases.iter().map(|p| n(p, "seconds", 1.0) as f32).sum();
    if phases.is_empty() || period <= 0.0 { return (0, min); }
    let mode = |index: usize| -> &str {
        let value = s(&phases[index], "scale");
        if value.is_empty() && phases.len() == 2 { if index == 0 { "expand" } else { "contract" } } else { value }
    };
    let target = |kind: &str, current: f32| match kind { "expand" => max, "contract" => min, _ => current };
    let mut from = (0..phases.len()).rev().find_map(|i| match mode(i) {
        "expand" => Some(max), "contract" => Some(min), _ => None,
    }).unwrap_or(min);
    let mut elapsed = (time - cue).max(0.0).rem_euclid(period);
    for (index, phase) in phases.iter().enumerate() {
        let duration = n(phase, "seconds", 1.0) as f32;
        let to = target(mode(index), from);
        if elapsed < duration || index == phases.len() - 1 {
            let progress = (elapsed / duration.max(0.001)).clamp(0.0, 1.0);
            let smooth = (1.0 - (PI * progress).cos()) * 0.5;
            return (index, from + (to - from) * smooth);
        }
        elapsed -= duration;
        from = to;
    }
    (0, min)
}

pub(super) fn connector<'a>(x1: f32, y1: f32, x2: f32, y2: f32, progress: f32, color: &str) -> Svgr<'a> {
    if progress <= 0.0 { return fframes::svgr!(<g />); }
    let p = progress.clamp(0.0, 1.0);
    let x = x1 + (x2 - x1) * p;
    let y = y1 + (y2 - y1) * p;
    let angle = (y2 - y1).atan2(x2 - x1);
    let head = 12.0 * p.min(1.0).max(0.4);
    let d = format!("M {} {} L {x} {y} L {} {}",
        x - head * (angle - PI / 6.0).cos(), y - head * (angle - PI / 6.0).sin(),
        x - head * (angle + PI / 6.0).cos(), y - head * (angle + PI / 6.0).sin());
    fframes::svgr!(<g fill="none" stroke={color.to_owned()} stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1={x1} y1={y1} x2={x} y2={y} />
        <path d={d} />
    </g>)
}

/// An icon centred in a soft badge.
fn badge<'a>(icon: &str, cx: f32, cy: f32, radius: f32, fill: &str, color: &str) -> Svgr<'a> {
    let glyph = radius * 1.12;
    fframes::svgr!(<g>
        <circle cx={cx} cy={cy} r={radius} fill={fill.to_owned()} />
        {crate::icons::render(icon, cx - glyph / 2.0, cy - glyph / 2.0, glyph, color)}
    </g>)
}

impl<'a, 'c, 'm> Draw<'a, 'c, 'm> {
    /// Keep an optional support line inside the normal content reserve.
    fn diagram_area(&self) -> (Area, Svgr<'a>) {
        let a = self.area;
        let support = s(self.props(), "support");
        if support.is_empty() { return (a, fframes::svgr!(<g />)); }
        let reserve = (a.h * 0.17).clamp(58.0, 92.0);
        let (line, _) = self.para(support, Area { x: a.x, y: a.y + a.h - reserve + 12.0, w: a.w, h: reserve - 12.0 },
            Style::text(28.0), &self.p.muted, Align::Left);
        (Area { h: a.h - reserve - 12.0, ..a }, self.rise(line, self.b.cue_seconds + 0.8, 10.0))
    }

    pub(super) fn icon_grid(&self) -> Svgr<'a> {
        let (a, support) = self.diagram_area();
        let items = arr(self.props(), "items");
        let default_columns = if self.wide { items.len().min(4) } else { items.len().min(2) };
        let columns = (n(self.props(), "columns", default_columns.max(1) as f64) as usize).clamp(1, 4);
        let rows = items.len().max(1).div_ceil(columns);
        let cellw = a.w / columns as f32;
        let cellh = (a.h / rows as f32).min(if columns == 1 { 170.0 } else { 330.0 });
        let a = Area { y: a.y + ((a.h - cellh * rows as f32) * 0.4).max(0.0), ..a };
        let gap = 28.0_f32.min(cellw * 0.1);
        let stagger = n(self.props(), "stagger", 0.45) as f32;
        let compact = cellh < 230.0 || columns == 1;
        let mut shapes = vec![];
        for (index, item) in items.iter().enumerate() {
            let x = a.x + (index % columns) as f32 * cellw;
            let y = a.y + (index / columns) as f32 * cellh;
            let inline = cellh < 120.0 && cellw > 600.0 && !s(item, "detail").is_empty();
            let icon_size = if inline { (cellh * 0.46).clamp(30.0, 64.0) }
                else if compact { (cellh * 0.46).clamp(40.0, 76.0) } else { (cellh * 0.28).clamp(72.0, 110.0) };
            let icon_y = y + if inline { (cellh - icon_size) * 0.5 } else { 12.0 };
            let (cx, cy) = (x + icon_size / 2.0, icon_y + icon_size / 2.0);
            let time = staged_at(item, self.b.cue_seconds, index, stagger);
            let icon = self.pop(badge(s(item, "icon"), cx, cy, icon_size / 2.0, &self.p.wash(&self.p.accent), &self.p.accent), time, cx, cy);
            let tx = x + if compact { icon_size + if inline { 18.0 } else { 24.0 } } else { 0.0 };
            let ty = y + if inline { 6.0 } else if compact { 12.0 } else { icon_size + 34.0 };
            let tw = cellw - gap - (tx - x);
            let detail = s(item, "detail");
            let available = cellh - (ty - y) - if inline { 6.0 } else { 18.0 };
            let labelh = if detail.is_empty() { available } else { available * 0.46 };
            let label_box = if inline { Area { x: tx, y: ty, w: tw * 0.36, h: available } } else { Area { x: tx, y: ty, w: tw, h: labelh } };
            let label = self.fit(s(item, "label"), Style::display(Font::Display, if compact { 32.0 } else { 38.0 }), label_box.w, label_box.h);
            let detail_box = if inline { Area { x: tx + tw * 0.40, y: ty, w: tw * 0.60, h: available } }
                else { Area { x: tx, y: ty + label.height() + 8.0, w: tw, h: (available - label.height() - 8.0).max(0.0) } };
            let (detail, _) = self.para(detail, detail_box, Style::text(26.0), &self.p.muted, Align::Left);
            let text = fframes::svgr!(<g>{self.draw(&label, label_box.x, label_box.y, label_box.w, Align::Left, &self.p.ink)}{detail}</g>);
            shapes.push(fframes::svgr!(<g>{icon}{self.rise(text, time + 0.08, 16.0)}</g>));
        }
        fframes::svgr!(<g>{shapes}{support}</g>)
    }

    pub(super) fn flow(&self) -> Svgr<'a> {
        let (a, support) = self.diagram_area();
        let nodes = arr(self.props(), "nodes");
        let count = nodes.len().max(1);
        let vertical = vertical_flow(s(self.props(), "orientation"), self.b.environment.width, self.b.environment.height);
        let slot = if vertical { a.h } else { a.w } / count as f32;
        let radius = if vertical { (slot * 0.28).min(46.0) } else { 50.0 };
        let stagger = n(self.props(), "stagger", 0.45) as f32;
        let last_frame = self.last_frame();
        let mut shapes = vec![];
        for (index, node) in nodes.iter().enumerate() {
            let cx = if vertical { a.x + radius + 8.0 } else { a.x + slot * (index as f32 + 0.5) };
            let cy = if vertical { a.y + slot * (index as f32 + 0.5) } else { a.y + a.h * 0.22 };
            let cue = staged_at(node, self.b.cue_seconds, index, stagger);
            if index + 1 < count {
                let (x1, y1, x2, y2) = if vertical {
                    (cx, cy + radius + 10.0, cx, cy + slot - radius - 14.0)
                } else { (cx + radius + 12.0, cy, cx + slot - radius - 16.0, cy) };
                let next_cue = staged_at(&nodes[index + 1], self.b.cue_seconds, index + 1, stagger);
                let progress = connector_progress(self.t, cue, next_cue, last_frame);
                shapes.push(connector(x1, y1, x2, y2, progress, &self.p.accent));
            }
            let arrived = self.enter(cue);
            let ring = fframes::svgr!(<g>
                <circle cx={cx} cy={cy} r={radius} fill={self.p.wash(&self.p.accent)} />
                <circle cx={cx} cy={cy} r={radius} fill="none" stroke={self.p.accent.clone()} stroke-width="3" opacity={arrived.alpha} />
            </g>);
            let icon = if s(node, "icon").is_empty() {
                fframes::svgr!(<circle cx={cx} cy={cy} r={radius * 0.22} fill={self.p.accent.clone()} />)
            } else { crate::icons::render(s(node, "icon"), cx - radius * 0.56, cy - radius * 0.56, radius * 1.12, &self.p.accent) };
            let text_area = if vertical {
                Area { x: cx + radius + 32.0, y: a.y + index as f32 * slot + 6.0, w: a.w - radius * 2.0 - 48.0, h: slot - 14.0 }
            } else {
                Area { x: a.x + index as f32 * slot + 14.0, y: cy + radius + 30.0, w: slot - 28.0, h: a.y + a.h - cy - radius - 30.0 }
            };
            let detail = s(node, "detail");
            let labelh = if detail.is_empty() { text_area.h } else { text_area.h * 0.47 };
            let align = if vertical { Align::Left } else { Align::Center };
            let label = self.fit(s(node, "label"), Style::display(Font::Display, 36.0), text_area.w, labelh);
            let label_y = if vertical && detail.is_empty() { cy - label.height() / 2.0 } else if vertical { cy - label.height() - 2.0 } else { text_area.y };
            let (detail, _) = self.para(detail, Area { y: label_y + label.height() + 6.0, h: (text_area.h - label.height() - 6.0).max(0.0), ..text_area },
                Style::text(26.0), &self.p.muted, align);
            let text = fframes::svgr!(<g>{self.draw(&label, text_area.x, label_y, text_area.w, align, &self.p.ink)}{detail}</g>);
            shapes.push(fframes::svgr!(<g>{self.pop(fframes::svgr!(<g>{ring}{icon}</g>), cue, cx, cy)}{self.rise(text, cue + 0.06, 12.0)}</g>));
        }
        fframes::svgr!(<g>{shapes}{support}</g>)
    }

    pub(super) fn cycle(&self) -> Svgr<'a> {
        let (a, support) = self.diagram_area();
        let nodes = arr(self.props(), "nodes");
        let count = nodes.len().max(1);
        let layout = CycleLayout::new(a);
        let CycleLayout { cx, cy, rx, ry, .. } = layout;
        let radius = 36.0;
        let clockwise = self.props().get("clockwise").and_then(Value::as_bool).unwrap_or(true);
        let period = n(self.props(), "period", 8.0) as f32;
        let last_frame = self.last_frame();
        let preset = self.b.environment.motion.preset.as_str();
        let track_in = cycle_arrival(self.t, self.b.cue_seconds, 0, count, last_frame, preset);
        let mut shapes = vec![fframes::svgr!(<g opacity={track_in}>
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={self.p.line()} stroke-width="4" />
        </g>)];
        // A short comet: the marker plus three fading trail dots behind it.
        for (lag, size, opacity) in [(0.0f32, 11.0f32, 1.0f32), (0.018, 8.0, 0.5), (0.036, 6.0, 0.3), (0.054, 4.5, 0.16)] {
            let (dx, dy) = cycle_position(self.t - lag * period, self.b.cue_seconds, period, clockwise);
            shapes.push(fframes::svgr!(<circle cx={cx + rx * dx} cy={cy + ry * dy} r={size} fill={self.p.accent.clone()} opacity={opacity * track_in} />));
        }
        for (index, node) in nodes.iter().enumerate() {
            let (x, y, label_box) = layout.node(index, count, clockwise);
            let disc = fframes::svgr!(<circle cx={x} cy={y} r={radius + 8.0} fill={self.p.bg.clone()} stroke={self.p.line()} stroke-width="3" />);
            let icon = if s(node, "icon").is_empty() {
                fframes::svgr!(<circle cx={x} cy={y} r="13" fill={self.p.accent.clone()} />)
            } else { crate::icons::render(s(node, "icon"), x - radius * 0.66, y - radius * 0.66, radius * 1.32, &self.p.accent) };
            let label = self.paragraph(s(node, "label"), label_box, 29.0, &self.p.ink, 600, true);
            let arrival = cycle_arrival(self.t, self.b.cue_seconds, index, count, last_frame, preset);
            if arrival <= 0.0 { continue; }
            let scale = 0.7 + 0.3 * arrival;
            shapes.push(fframes::svgr!(<g opacity={arrival}>
                <g transform={format!("translate({x} {y}) scale({scale}) translate({} {})", -x, -y)}>{disc}{icon}</g>
                {label}
            </g>));
        }
        fframes::svgr!(<g>{shapes}{support}</g>)
    }

    pub(super) fn breathing(&self) -> Svgr<'a> {
        let (a, support) = self.diagram_area();
        let phases = arr(self.props(), "phases");
        let (index, scale) = breathing_state(phases, self.t, self.b.cue_seconds,
            n(self.props(), "minScale", 0.55) as f32, n(self.props(), "maxScale", 1.0) as f32);
        let cx = a.x + a.w * 0.5;
        let cy = a.y + a.h * 0.5;
        let radius = (a.w * 0.43).min(a.h * 0.44);
        let ring = self.props().get("ring").and_then(Value::as_bool).unwrap_or(true);
        let outer = if ring {
            fframes::svgr!(<circle cx={cx} cy={cy} r={radius} fill="none" stroke={self.p.line()} stroke-width="2" />)
        } else { fframes::svgr!(<g />) };
        let glow = self.uid("breath");
        let disc = fframes::svgr!(<g>
            <defs><radialGradient id={glow.clone()} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={radius * scale}>
                <stop offset="0" stop-color={self.p.accent.clone()} stop-opacity="0.04" />
                <stop offset="1" stop-color={self.p.accent.clone()} stop-opacity={if self.p.dark { 0.3 } else { 0.2 }} />
            </radialGradient></defs>
            <circle cx={cx} cy={cy} r={radius * scale} fill={format!("url(#{glow})")} stroke={self.p.accent.clone()} stroke-width="4" />
        </g>);
        // Phase labels cross-fade instead of switching on a single frame.
        let (_, elapsed) = phase_clock(phases, self.t, self.b.cue_seconds);
        let fade = motion::in_out_cubic(elapsed / 0.35);
        let label_box = Area { x: cx - radius * 0.72, y: cy - 44.0, w: radius * 1.44, h: 88.0 };
        let current = self.paragraph(phases.get(index).map(|phase| s(phase, "label")).unwrap_or(""), label_box, 48.0, &self.p.ink, 600, true);
        let started = self.t - self.b.cue_seconds > 0.35;
        let previous = if fade < 1.0 && started && phases.len() > 1 {
            let before = (index + phases.len() - 1) % phases.len();
            let node = self.paragraph(s(&phases[before], "label"), label_box, 48.0, &self.p.ink, 600, true);
            fframes::svgr!(<g opacity={1.0 - fade}>{node}</g>)
        } else { fframes::svgr!(<g />) };
        let current = if started { fframes::svgr!(<g opacity={fade}>{current}</g>) } else { current };
        fframes::svgr!(<g>{outer}{disc}{previous}{current}{support}</g>)
    }

    /// Numbered steps on a rail that draws from one arrival to the next.
    pub(super) fn steps(&self) -> Svgr<'a> {
        let a = self.area;
        let items = arr(self.props(), "items");
        let count = items.len().max(1);
        let times: Vec<f32> = items.iter().enumerate().map(|(i, it)| at(it, self.b.cue_seconds, i)).collect();
        let r = 30.0;
        let mut shapes = vec![];
        if self.wide {
            let slot = a.w / count as f32;
            let content_h = (2.0 * r + 40.0 + 200.0f32).min(a.h);
            let cy = a.y + ((a.h - content_h) * 0.4).max(0.0) + r + 8.0;
            for i in 0..count.saturating_sub(1) {
                let (x1, x2) = (a.x + slot * i as f32 + 2.0 * r + 14.0, a.x + slot * (i + 1) as f32 - 14.0);
                let grow = self.m.grow(self.t - times[i] - 0.1, (times[i + 1] - times[i]).max(0.3));
                shapes.push(rect(x1, cy - 1.5, (x2 - x1) * grow, 3.0, &self.p.line()));
            }
            for (i, item) in items.iter().enumerate() {
                let x = a.x + slot * i as f32;
                let marker = self.step_marker(i, x + r, cy, r, times[i]);
                let w = slot - 44.0;
                let title = self.fit(nonempty(s(item, "title"), s(item, "label")), Style::display(Font::Display, 40.0), w, (a.y + a.h - cy - r - 40.0) * 0.45);
                let (detail, _) = self.para(s(item, "detail"), Area { x, y: cy + r + 40.0 + title.height() + 12.0, w, h: (a.y + a.h - (cy + r + 40.0 + title.height() + 12.0)).max(0.0) }, Style::text(28.0), &self.p.muted, Align::Left);
                let text = fframes::svgr!(<g>{self.draw(&title, x, cy + r + 40.0, w, Align::Left, &self.p.ink)}{detail}</g>);
                shapes.push(fframes::svgr!(<g>{marker}{self.rise(text, times[i] + 0.1, 16.0)}</g>));
            }
        } else {
            let row_h = (a.h / count as f32).min(230.0);
            let a = Area { y: a.y + ((a.h - row_h * count as f32) * 0.35).max(0.0), ..a };
            for i in 0..count.saturating_sub(1) {
                let y1 = a.y + row_h * i as f32 + 2.0 * r + 12.0;
                let y2 = a.y + row_h * (i + 1) as f32 - 12.0;
                let grow = self.m.grow(self.t - times[i] - 0.1, (times[i + 1] - times[i]).max(0.3));
                shapes.push(rect(a.x + r - 1.5, y1, 3.0, (y2 - y1) * grow, &self.p.line()));
            }
            for (i, item) in items.iter().enumerate() {
                let y = a.y + row_h * i as f32;
                let marker = self.step_marker(i, a.x + r, y + r, r, times[i]);
                let (x, w) = (a.x + 2.0 * r + 32.0, a.w - 2.0 * r - 32.0);
                let title = self.fit(nonempty(s(item, "title"), s(item, "label")), Style::display(Font::Display, 38.0), w, row_h * 0.45);
                let (detail, _) = self.para(s(item, "detail"), Area { x, y: y + title.height() + 10.0, w, h: (row_h - title.height() - 22.0).max(0.0) }, Style::text(28.0), &self.p.muted, Align::Left);
                let text = fframes::svgr!(<g>{self.draw(&title, x, y + r - title.height() / 2.0 - (if s(item, "detail").is_empty() { 0.0 } else { title.height() / 2.0 - 8.0 }), w, Align::Left, &self.p.ink)}{detail}</g>);
                shapes.push(fframes::svgr!(<g>{marker}{self.rise(text, times[i] + 0.1, 14.0)}</g>));
            }
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
    fn step_marker(&self, index: usize, cx: f32, cy: f32, r: f32, time: f32) -> Svgr<'a> {
        let label = format!("{}", index + 1);
        let size = r * 0.95;
        let w = text::measure(Font::DisplayBold, &label, size, 0.0);
        let body = fframes::svgr!(<g>
            <circle cx={cx} cy={cy} r={r} fill={self.p.accent.clone()} />
            {self.run(label, cx - w / 2.0, cy + size * 0.36, Font::DisplayBold, size, 0.0, &self.p.bg)}
        </g>);
        self.pop(body, time, cx, cy)
    }

    /// Dated events on a rail that grows as each one arrives.
    pub(super) fn timeline(&self) -> Svgr<'a> {
        let a = self.area;
        let items = arr(self.props(), "items");
        let count = items.len().max(1);
        let times: Vec<f32> = items.iter().enumerate().map(|(i, it)| at(it, self.b.cue_seconds, i)).collect();
        let row_h = (a.h / count as f32).min(210.0);
        let a = Area { y: a.y + ((a.h - row_h * count as f32) * 0.35).max(0.0), ..a };
        let has_time = items.iter().any(|it| !s(it, "label").is_empty() && !s(it, "title").is_empty());
        let time_w = if has_time {
            items.iter().map(|it| text::measure(Font::TextStrong, s(it, "label"), 30.0, 0.0)).fold(0.0, f32::max).min(a.w * 0.28) + 40.0
        } else { 0.0 };
        let rail_x = a.x + 12.0;
        let first_y = a.y + 22.0;
        let reached = times.iter().enumerate().map(|(i, time)| {
            let grow = self.m.grow(self.t - time + 0.25, 0.4);
            first_y + row_h * (i as f32 - 1.0 + grow).max(0.0)
        }).fold(first_y, f32::max);
        let mut shapes = vec![rect(rail_x - 1.5, first_y, 3.0, reached - first_y, &self.p.line())];
        for (i, item) in items.iter().enumerate() {
            let y = a.y + i as f32 * row_h;
            let dot = fframes::svgr!(<g>
                <circle cx={rail_x} cy={y + 22.0} r="13" fill={self.p.bg.clone()} stroke={self.p.accent.clone()} stroke-width="4" />
                <circle cx={rail_x} cy={y + 22.0} r="5" fill={self.p.accent.clone()} />
            </g>);
            let x = a.x + 50.0;
            let label = if has_time { self.para(s(item, "label"), Area { x, y: y + 4.0, w: time_w - 30.0, h: row_h * 0.44 }, Style::strong(30.0), &self.p.accent, Align::Left).0 } else { empty() };
            let tx = x + time_w;
            let tw = a.w - 50.0 - time_w;
            let heading = nonempty(s(item, "title"), s(item, "label"));
            let title = self.fit(heading, Style::display(Font::Display, 38.0), tw, row_h * 0.42);
            let (detail, _) = self.para(s(item, "detail"), Area { x: tx, y: y + title.height() + 12.0, w: tw, h: (row_h - title.height() - 26.0).max(0.0) }, Style::text(28.0), &self.p.muted, Align::Left);
            let text = fframes::svgr!(<g>{label}{self.draw(&title, tx, y, tw, Align::Left, &self.p.ink)}{detail}</g>);
            shapes.push(fframes::svgr!(<g>{self.pop(dot, times[i], rail_x, y + 22.0)}{self.rise(text, times[i] + 0.06, 14.0)}</g>));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }

    /// Items appear unchecked, then each box fills and its check draws on at its cue.
    pub(super) fn checklist(&self) -> Svgr<'a> {
        let a = self.area;
        let items = arr(self.props(), "items");
        let count = items.len().max(1);
        let row_h = (a.h / count as f32).min(170.0);
        let top = a.y + ((a.h - row_h * count as f32) * 0.3).max(0.0);
        let box_size = 50.0;
        let cue = self.b.cue_seconds;
        let mut shapes = vec![];
        for (i, item) in items.iter().enumerate() {
            let y = top + i as f32 * row_h;
            let check_at = n(item, "at", (cue + 0.6 + i as f32 * 0.55) as f64) as f32;
            let x = a.x + box_size + 34.0;
            let w = a.w - box_size - 34.0;
            let value = nonempty(s(item, "text"), item.as_str().unwrap_or(""));
            let layout = self.fit(value, Style::display(Font::Display, if self.wide { 44.0 } else { 40.0 }), w, row_h * 0.52);
            let detail = s(item, "detail");
            let box_y = y + layout.baseline - layout.size * 0.36 - box_size / 2.0;
            let checked = self.m.enter_over(self.t - check_at, 0.3);
            let draw = self.m.grow(self.t - check_at - 0.08, 0.32);
            let (bx, by) = (a.x, box_y);
            let fill = if checked.alpha > 0.0 {
                let scale = 0.6 + 0.4 * self.m.pop(self.t - check_at).min(1.1);
                let (cx, cy) = (bx + box_size / 2.0, by + box_size / 2.0);
                fframes::svgr!(<g opacity={checked.alpha} transform={format!("translate({cx} {cy}) scale({scale}) translate({} {})", -cx, -cy)}>
                    {rounded(bx, by, box_size, box_size, 13.0, &self.p.accent)}
                </g>)
            } else { empty() };
            let tick = if draw > 0.0 {
                // Two-segment check drawn by length.
                let (p0, p1, p2) = ((bx + 13.0, by + 26.0), (bx + 22.0, by + 35.0), (bx + 38.0, by + 17.0));
                let first = ((p1.0 - p0.0) as f32).hypot(p1.1 - p0.1);
                let second = ((p2.0 - p1.0) as f32).hypot(p2.1 - p1.1);
                let length = (first + second) * draw;
                let d = if length <= first {
                    let k = length / first;
                    format!("M {} {} L {} {}", p0.0, p0.1, p0.0 + (p1.0 - p0.0) * k, p0.1 + (p1.1 - p0.1) * k)
                } else {
                    let k = (length - first) / second;
                    format!("M {} {} L {} {} L {} {}", p0.0, p0.1, p1.0, p1.1, p1.0 + (p2.0 - p1.0) * k, p1.1 + (p2.1 - p1.1) * k)
                };
                fframes::svgr!(<path d={d} fill="none" stroke={self.p.bg.clone()} stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />)
            } else { empty() };
            let outline = fframes::svgr!(<rect x={bx + 1.5} y={by + 1.5} width={box_size - 3.0} height={box_size - 3.0} rx="12" ry="12" fill="none" stroke={self.p.line()} stroke-width="3" />);
            let color = if checked.alpha >= 0.5 { self.p.ink.clone() } else { self.p.muted.clone() };
            let (detail, _) = self.para(detail, Area { x, y: y + layout.height() + 8.0, w, h: (row_h - layout.height() - 20.0).max(0.0) }, Style::text(28.0), &self.p.muted, Align::Left);
            let row = fframes::svgr!(<g>{outline}{fill}{tick}{self.draw(&layout, x, y, w, Align::Left, &color)}{detail}</g>);
            shapes.push(self.rise(row, cue - 0.15 + i as f32 * 0.08, 14.0));
        }
        fframes::svgr!(<g>{shapes}</g>)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn flow_respects_timed_nodes_and_portrait_direction() {
        let node = serde_json::json!({"at": 2.3});
        assert_eq!(staged_at(&node, 0.5, 3, 0.45), 2.3);
        assert_eq!(staged_at(&Value::Null, 0.5, 2, 0.45), 1.4);
        assert!(vertical_flow("horizontal", 1080.0, 1920.0));
        assert!(!vertical_flow("auto", 1920.0, 1080.0));
        assert!(vertical_flow("vertical", 1920.0, 1080.0));
    }
    #[test]
    fn late_snappy_flow_connectors_finish_on_the_last_sample_without_advancing_the_cue() {
        for fps in [24, 25, 30, 50, 60] {
            let last = (fps - 1) as f32 / fps as f32;
            let cue = last - 0.30;
            assert_eq!(connector_progress(cue - 0.01, cue, cue, last), 0.0);
            assert_eq!(connector_progress(cue, cue, cue, last), 0.0);
            assert_eq!(connector_progress(last, cue, cue, last), 1.0);
            let middle = connector_progress(cue + 0.15, cue, cue, last);
            assert!(middle > 0.0 && middle < 1.0);
        }
        // A connector spanning later authored nodes also completes at the cut.
        assert_eq!(connector_progress(1.0, 0.2, 0.8, 1.0), 1.0);
    }
    #[test]
    fn cycle_has_exact_period_and_reverses_direction() {
        let (x, y) = cycle_position(3.0, 1.0, 8.0, true);
        assert!((x - 1.0).abs() < 0.0001 && y.abs() < 0.0001);
        assert_eq!(cycle_position(3.0, 1.0, 8.0, true), cycle_position(11.0, 1.0, 8.0, true));
        assert!((cycle_position(3.0, 1.0, 8.0, false).0 + 1.0).abs() < 0.0001);
        assert_eq!(cycle_position(0.0, 1.0, 8.0, true), cycle_position(1.0, 1.0, 8.0, true));
    }
    #[test]
    fn cycle_labels_and_icons_stay_disjoint_in_every_dense_canvas() {
        for (width, height) in [(1920.0_f32, 1080.0_f32), (1080.0, 1920.0), (1080.0, 1350.0), (1080.0, 1080.0)] {
            for captions in [false, true] { for support in [false, true] {
                let wide = width / height > 1.3;
                let x = if wide { 120.0 } else { 86.0 };
                let y = 335.0 + if height > width { height * 0.11 - 108.0 } else { 0.0 };
                let bottom = if captions { if height > width { 365.0 } else { 215.0 } } else { 145.0 };
                let mut h = height - y - bottom;
                if support { h -= (h * 0.17).clamp(58.0, 92.0) + 12.0; }
                let area = Area { x, y, w: width - 2.0 * x, h };
                let layout = CycleLayout::new(area);
                for count in 3..=6 { for clockwise in [false, true] {
                    let nodes: Vec<_> = (0..count).map(|index| layout.node(index, count, clockwise)).collect();
                    for (index, (_, _, label)) in nodes.iter().enumerate() {
                        assert!(label.x >= area.x && label.y >= area.y);
                        assert!(label.x + label.w <= area.x + area.w && label.y + label.h <= area.y + area.h);
                        for (other, (cx, cy, next)) in nodes.iter().enumerate() {
                            if index == other { continue; }
                            let dx = cx - cx.clamp(label.x, label.x + label.w);
                            let dy = cy - cy.clamp(label.y, label.y + label.h);
                            assert!(dx * dx + dy * dy >= 44.0_f32.powi(2), "label must not cover another icon disc");
                            assert!(label.x >= next.x + next.w || label.x + label.w <= next.x
                                || label.y >= next.y + next.h || label.y + label.h <= next.y, "label boxes must not intersect");
                        }
                    }
                } }
            } }
        }
    }
    #[test]
    fn short_cycle_beats_complete_every_automatic_arrival_on_the_final_sample() {
        for fps in [24, 25, 30, 50, 60] {
            let last = (fps / 2 - 1) as f32 / fps as f32;
            for preset in ["gentle", "snappy", "spring"] { for index in 0..6 {
                assert_eq!(cycle_arrival(0.0, 0.35, index, 6, last, preset), 0.0);
                assert!((cycle_arrival(last, 0.35, index, 6, last, preset) - 1.0).abs() < 0.0001);
            } }
        }
    }
    #[test]
    fn breathing_phases_hold_at_boundaries_and_wrap_without_a_jump() {
        let phases = serde_json::json!([
            {"label":"Expand","seconds":2,"scale":"expand"},
            {"label":"Pause","seconds":1,"scale":"hold"},
            {"label":"Contract","seconds":3,"scale":"contract"},
            {"label":"Rest","seconds":1,"scale":"hold"}]);
        let phases = phases.as_array().unwrap();
        assert_eq!(breathing_state(phases, 0.0, 0.5, 0.5, 1.0), (0, 0.5));
        assert_eq!(breathing_state(phases, 2.5, 0.5, 0.5, 1.0), (1, 1.0));
        assert_eq!(breathing_state(phases, 3.5, 0.5, 0.5, 1.0), (2, 1.0));
        assert_eq!(breathing_state(phases, 6.5, 0.5, 0.5, 1.0), (3, 0.5));
        assert_eq!(breathing_state(phases, 7.5, 0.5, 0.5, 1.0), (0, 0.5));
        assert_eq!(breathing_state(phases, 1.5, 0.5, 0.5, 1.0), (0, 0.75));
        assert_eq!(phase_clock(phases, 3.0, 0.5), (1, 0.5));
        assert_eq!(phase_clock(phases, 7.6, 0.5).0, 0);
    }
    #[test]
    fn new_blocks_reject_undrawable_props() {
        use serde_json::json;
        assert!(validate("donut", &json!({"segments":[{"label":"A","value":0},{"label":"B","value":0}]})).is_err());
        assert!(validate("donut", &json!({"segments":[{"label":"A","value":1},{"label":"B","value":-1}]})).is_err());
        assert!(validate("donut", &json!({"segments":[{"label":"A","value":1},{"label":"B","value":0}]})).is_ok());
        assert!(validate("magnitude", &json!({"items":[{"label":"A","value":1},{"label":"B","value":0}]})).is_err());
        assert!(validate("annotate", &json!({"pins":[{"x":1.2,"y":0.5,"label":"A"}]})).is_err());
        assert!(validate("annotate", &json!({"pins":[{"x":0.5,"y":0.5,"label":"A"}],"focus":{"x":0.6,"y":0,"w":0.5,"h":0.5}})).is_err());
        assert!(validate("highlight", &json!({"text":"A long tail","phrases":["tail"]})).is_ok());
        assert!(validate("highlight", &json!({"text":"A long tail","phrases":["ail"]})).is_err());
        assert!(validate("callout", &json!({"icon":"../x.svg"})).is_err());
    }
}
