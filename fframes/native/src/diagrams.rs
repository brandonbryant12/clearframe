//! Frame-pure illustrated diagrams. Timing and geometry are independently implemented.
use super::*;
use std::f32::consts::{PI, TAU};

pub(crate) fn validate(block: &str, props: &Value) -> Result<(), &'static str> {
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
    else { ease((time - start) / duration) }
}

fn connector_progress(time: f32, cue: f32, next_cue: f32, last_frame: f32) -> f32 {
    // Snappy entrances may start only .30s before the final sample. Preserve that
    // authored cue while letting the line complete with its nodes before the cut.
    let duration = (next_cue - cue).max(0.45).min((last_frame - cue).max(0.0));
    if duration <= 0.0 { if time >= cue { 1.0 } else { 0.0 } }
    else { ease((time - cue) / duration) }
}

#[derive(Clone, Copy)]
struct CycleLayout { cx: f32, cy: f32, rx: f32, ry: f32, label_width: f32 }
impl CycleLayout {
    fn new(area: Area) -> Self {
        Self { cx: area.x + area.w * 0.5, cy: area.y + area.h * 0.5,
            rx: (area.w * 0.32).min(490.0), ry: ((area.h - 248.0) * 0.5).min(360.0),
            label_width: (area.w * 0.265).min(285.0) }
    }
    fn node(&self, index: usize, count: usize, clockwise: bool) -> (f32, f32, Area) {
        let angle = -PI / 2.0 + index as f32 / count as f32 * TAU * if clockwise { 1.0 } else { -1.0 };
        let x = self.cx + self.rx * angle.cos();
        let y = self.cy + self.ry * angle.sin();
        // Outward label bands keep upper labels clear of the lower side icons.
        let label_y = if angle.sin() < -0.1 { y - 43.0 - 74.0 } else { y + 43.0 };
        (x, y, Area { x: x - self.label_width * 0.5, y: label_y, w: self.label_width, h: 74.0 })
    }
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

fn connector<'a>(x1: f32, y1: f32, x2: f32, y2: f32, progress: f32, color: &str) -> Svgr<'a> {
    if progress <= 0.0 { return fframes::svgr!(<g />); }
    let p = progress.clamp(0.0, 1.0);
    let x = x1 + (x2 - x1) * p;
    let y = y1 + (y2 - y1) * p;
    let angle = (y2 - y1).atan2(x2 - x1);
    let d = format!("M {} {} L {x} {y} L {} {}",
        x - 10.0 * (angle - PI / 6.0).cos(), y - 10.0 * (angle - PI / 6.0).sin(),
        x - 10.0 * (angle + PI / 6.0).cos(), y - 10.0 * (angle + PI / 6.0).sin());
    fframes::svgr!(<g fill="none" stroke={color.to_owned()} stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <line x1={x1} y1={y1} x2={x} y2={y} />
        <path d={d} />
    </g>)
}

impl<'a, 'c, 'm> Draw<'a, 'c, 'm> {
    /// Keep an optional support line inside the normal content reserve.
    fn diagram_area(&mut self) -> (Area, Svgr<'a>) {
        let a = self.area;
        let support = s(&self.b.props, "support");
        if support.is_empty() { return (a, fframes::svgr!(<g />)); }
        let reserve = (a.h * 0.17).clamp(58.0, 92.0);
        let line = self.paragraph(support, Area { x: a.x, y: a.y + a.h - reserve + 12.0, w: a.w, h: reserve - 12.0 },
            28.0, &self.p.muted.clone(), 400, false);
        (Area { h: a.h - reserve - 12.0, ..a }, line)
    }

    pub(super) fn icon_grid(&mut self) -> Svgr<'a> {
        let (a, support) = self.diagram_area();
        let items = arr(&self.b.props, "items");
        let default_columns = if self.wide { items.len().min(4) } else { items.len().min(2) };
        let columns = (n(&self.b.props, "columns", default_columns.max(1) as f64) as usize).clamp(1, 4);
        let rows = items.len().max(1).div_ceil(columns);
        let cellw = a.w / columns as f32;
        let cellh = a.h / rows as f32;
        let gap = 28.0_f32.min(cellw * 0.1);
        let stagger = n(&self.b.props, "stagger", 0.45) as f32;
        let compact = cellh < 230.0 || columns == 1;
        let mut shapes = vec![];
        for (index, item) in items.iter().enumerate() {
            let x = a.x + (index % columns) as f32 * cellw;
            let y = a.y + (index / columns) as f32 * cellh;
            let inline = cellh < 120.0 && cellw > 600.0 && !s(item, "detail").is_empty();
            let icon_size = if inline { (cellh * 0.40).clamp(28.0, 60.0) }
                else if compact { (cellh * 0.40).clamp(34.0, 68.0) } else { (cellh * 0.23).clamp(62.0, 94.0) };
            let icon_y = y + if inline { (cellh - icon_size) * 0.5 } else { 15.0 };
            let icon = crate::icons::render(s(item, "icon"), x, icon_y, icon_size, &self.p.accent);
            let tx = x + if compact { icon_size + if inline { 16.0 } else { 20.0 } } else { 0.0 };
            let ty = y + if inline { 6.0 } else if compact { 10.0 } else { icon_size + 32.0 };
            let tw = cellw - gap - (tx - x);
            let detail = s(item, "detail");
            let available = cellh - (ty - y) - if inline { 6.0 } else { 18.0 };
            let labelh = if detail.is_empty() { available } else { available * 0.46 };
            let label_box = if inline { Area { x: tx, y: ty, w: tw * 0.36, h: available } }
                else { Area { x: tx, y: ty, w: tw, h: labelh } };
            let detail_box = if inline { Area { x: tx + tw * 0.40, y: ty, w: tw * 0.60, h: available } }
                else { Area { x: tx, y: ty + labelh + 6.0, w: tw, h: (available - labelh - 6.0).max(0.0) } };
            let label = self.paragraph(s(item, "label"), label_box,
                if compact { 30.0 } else { 36.0 }, &self.p.ink.clone(), 600, false);
            let detail = self.paragraph(detail, detail_box,
                25.0, &self.p.muted.clone(), 400, false);
            let divider = rule(x, y + cellh - 3.0, cellw - gap, &self.p.surface);
            shapes.push(reveal(fframes::svgr!(<g>{icon}{label}{detail}{divider}</g>),
                self.progress(staged_at(item, self.b.cue_seconds, index, stagger)), 16.0 * self.b.environment.motion.intensity));
        }
        fframes::svgr!(<g>{shapes}{support}</g>)
    }

    pub(super) fn flow(&mut self) -> Svgr<'a> {
        let (a, support) = self.diagram_area();
        let nodes = arr(&self.b.props, "nodes");
        let count = nodes.len().max(1);
        let vertical = vertical_flow(s(&self.b.props, "orientation"), self.b.environment.width, self.b.environment.height);
        let slot = if vertical { a.h } else { a.w } / count as f32;
        let radius = if vertical { (slot * 0.27).min(44.0) } else { 46.0 };
        let stagger = n(&self.b.props, "stagger", 0.45) as f32;
        let last_frame = self.b.frames.saturating_sub(1) as f32 / self.f.fps as f32;
        let mut shapes = vec![];
        for (index, node) in nodes.iter().enumerate() {
            let cx = if vertical { a.x + radius + 8.0 } else { a.x + slot * (index as f32 + 0.5) };
            let cy = if vertical { a.y + slot * (index as f32 + 0.5) } else { a.y + a.h * 0.23 };
            let cue = staged_at(node, self.b.cue_seconds, index, stagger);
            if index + 1 < count {
                let (x1, y1, x2, y2) = if vertical {
                    (cx, cy + radius + 8.0, cx, cy + slot - radius - 12.0)
                } else { (cx + radius + 8.0, cy, cx + slot - radius - 12.0, cy) };
                let next_cue = staged_at(&nodes[index + 1], self.b.cue_seconds, index + 1, stagger);
                let progress = connector_progress(self.t, cue, next_cue, last_frame);
                shapes.push(connector(x1, y1, x2, y2, progress, &self.p.accent));
            }
            let circle = fframes::svgr!(<circle cx={cx} cy={cy} r={radius} fill={self.p.surface.clone()} />);
            let icon = if s(node, "icon").is_empty() {
                fframes::svgr!(<circle cx={cx} cy={cy} r={radius * 0.20} fill={self.p.accent.clone()} />)
            } else { crate::icons::render(s(node, "icon"), cx - radius * 0.58, cy - radius * 0.58, radius * 1.16, &self.p.accent) };
            let text_area = if vertical {
                Area { x: cx + radius + 30.0, y: a.y + index as f32 * slot + 8.0, w: a.w - radius * 2.0 - 46.0, h: slot - 18.0 }
            } else {
                Area { x: a.x + index as f32 * slot + 14.0, y: cy + radius + 28.0, w: slot - 28.0, h: a.y + a.h - cy - radius - 28.0 }
            };
            let detail = s(node, "detail");
            let labelh = if detail.is_empty() { text_area.h } else { text_area.h * 0.47 };
            let label = self.paragraph(s(node, "label"), Area { h: labelh, ..text_area }, 34.0, &self.p.ink.clone(), 600, !vertical);
            let detail = self.paragraph(detail, Area { y: text_area.y + labelh + 4.0, h: (text_area.h - labelh - 4.0).max(0.0), ..text_area },
                26.0, &self.p.muted.clone(), 400, !vertical);
            shapes.push(reveal(fframes::svgr!(<g>{circle}{icon}{label}{detail}</g>), self.progress(cue), 12.0 * self.b.environment.motion.intensity));
        }
        fframes::svgr!(<g>{shapes}{support}</g>)
    }

    pub(super) fn cycle(&mut self) -> Svgr<'a> {
        let (a, support) = self.diagram_area();
        let nodes = arr(&self.b.props, "nodes");
        let count = nodes.len().max(1);
        let layout = CycleLayout::new(a);
        let CycleLayout { cx, cy, rx, ry, .. } = layout;
        let radius = 34.0;
        let clockwise = self.b.props.get("clockwise").and_then(Value::as_bool).unwrap_or(true);
        let last_frame = self.b.frames.saturating_sub(1) as f32 / self.f.fps as f32;
        let (dx, dy) = cycle_position(self.t, self.b.cue_seconds, n(&self.b.props, "period", 8.0) as f32, clockwise);
        let dot = fframes::svgr!(<circle cx={cx + rx * dx} cy={cy + ry * dy} r="9" fill={self.p.accent.clone()} />);
        let dot = reveal(dot, cycle_arrival(self.t, self.b.cue_seconds, 0, count, last_frame, &self.b.environment.motion.preset), 0.0);
        let mut shapes = vec![fframes::svgr!(<ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={self.p.surface.clone()} stroke-width="5" />), dot];
        for (index, node) in nodes.iter().enumerate() {
            let (x, y, label_box) = layout.node(index, count, clockwise);
            let disc = fframes::svgr!(<circle cx={x} cy={y} r={radius + 7.0} fill={self.p.bg.clone()} />);
            let icon = if s(node, "icon").is_empty() {
                fframes::svgr!(<circle cx={x} cy={y} r="13" fill={self.p.accent.clone()} />)
            } else { crate::icons::render(s(node, "icon"), x - radius * 0.68, y - radius * 0.68, radius * 1.36, &self.p.accent) };
            let label = self.paragraph(s(node, "label"), label_box,
                29.0, &self.p.ink.clone(), 600, true);
            shapes.push(reveal(fframes::svgr!(<g>{disc}{icon}{label}</g>),
                cycle_arrival(self.t, self.b.cue_seconds, index, count, last_frame, &self.b.environment.motion.preset), 0.0));
        }
        fframes::svgr!(<g>{shapes}{support}</g>)
    }

    pub(super) fn breathing(&mut self) -> Svgr<'a> {
        let (a, support) = self.diagram_area();
        let phases = arr(&self.b.props, "phases");
        let (index, scale) = breathing_state(phases, self.t, self.b.cue_seconds,
            n(&self.b.props, "minScale", 0.55) as f32, n(&self.b.props, "maxScale", 1.0) as f32);
        let cx = a.x + a.w * 0.5;
        let cy = a.y + a.h * 0.5;
        let radius = (a.w * 0.43).min(a.h * 0.44);
        let ring = self.b.props.get("ring").and_then(Value::as_bool).unwrap_or(true);
        let outer = if ring {
            fframes::svgr!(<circle cx={cx} cy={cy} r={radius} fill="none" stroke={self.p.surface.clone()} stroke-width="2" />)
        } else { fframes::svgr!(<g />) };
        let disc = fframes::svgr!(<circle cx={cx} cy={cy} r={radius * scale} fill={self.p.accent.clone()} fill-opacity="0.09" stroke={self.p.accent.clone()} stroke-width="4" />);
        // The label box is fixed, so pulse motion never reflows or scales the words.
        let label = self.paragraph(phases.get(index).map(|phase| s(phase, "label")).unwrap_or(""),
            Area { x: cx - radius * 0.72, y: cy - 38.0, w: radius * 1.44, h: 88.0 },
            48.0, &self.p.ink.clone(), 600, true);
        fframes::svgr!(<g>{outer}{disc}{label}{support}</g>)
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
        for fps in [24,25,30,50,60] {
            let last = (fps - 1) as f32 / fps as f32;
            let cue = last - 0.30;
            assert_eq!(connector_progress(cue - 0.01, cue, cue, last), 0.0);
            assert_eq!(connector_progress(cue, cue, cue, last), 0.0);
            assert_eq!(connector_progress(last, cue, cue, last), 1.0);
            let middle = connector_progress(cue + 0.15, cue, cue, last);
            assert!(middle > 0.0 && middle < 1.0);
            assert_eq!(connector_progress(cue - 0.01, cue, cue, last), 0.0);
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
        for (width, height) in [(1920.0_f32,1080.0_f32),(1080.0,1920.0),(1080.0,1350.0),(1080.0,1080.0)] {
            for captions in [false,true] { for support in [false,true] {
                let wide = width / height > 1.3;
                let x = if wide { 120.0 } else { 86.0 };
                let y = 335.0 + if height > width { height * 0.11 - 108.0 } else { 0.0 };
                let bottom = if captions { if height > width { 365.0 } else { 215.0 } } else { 145.0 };
                let mut h = height - y - bottom;
                if support { h -= (h * 0.17).clamp(58.0,92.0) + 12.0; }
                let area = Area { x, y, w: width - 2.0 * x, h };
                let layout = CycleLayout::new(area);
                for count in 3..=6 { for clockwise in [false,true] {
                    let nodes: Vec<_> = (0..count).map(|index| layout.node(index,count,clockwise)).collect();
                    for (index, (_, _, label)) in nodes.iter().enumerate() {
                        assert!(label.x >= area.x && label.y >= area.y);
                        assert!(label.x + label.w <= area.x + area.w && label.y + label.h <= area.y + area.h);
                        for (other, (cx, cy, next)) in nodes.iter().enumerate() {
                            if index == other { continue; }
                            let dx = cx - cx.clamp(label.x,label.x+label.w);
                            let dy = cy - cy.clamp(label.y,label.y+label.h);
                            assert!(dx*dx+dy*dy >= 41.0_f32.powi(2), "label must not cover another icon");
                            assert!(label.x >= next.x+next.w || label.x+label.w <= next.x
                                || label.y >= next.y+next.h || label.y+label.h <= next.y, "label boxes must not intersect");
                        }
                    }
                } }
            } }
        }
    }
    #[test]
    fn short_cycle_beats_complete_every_automatic_arrival_on_the_final_sample() {
        for fps in [24,25,30,50,60] {
            let last = (fps / 2 - 1) as f32 / fps as f32;
            for preset in ["gentle","snappy","spring"] { for index in 0..6 {
                assert_eq!(cycle_arrival(0.0,0.35,index,6,last,preset),0.0);
                assert!((cycle_arrival(last,0.35,index,6,last,preset)-1.0).abs()<0.0001);
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
    }
}
