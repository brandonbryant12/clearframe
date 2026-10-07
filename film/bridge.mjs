// Metric bridges (waterfall charts): how a total moved from one value to another, driver by driver.
// Start and end totals stand on an honest zero; each driver floats from the running total and must
// reconcile exactly, so a gap is an explicit step, never a silent residual. Shares the plot and bar
// frame, type and palette tokens, so a bridge cuts with bar and line beats as one system.
import { plotLayout, titleText, titleShift } from './plots.mjs';
import { utcDay } from './plot-data.mjs';

const check = (ok, message) => { if (!ok) throw new Error(`bridge: ${message}`); };
const finite = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e12;
const show = { at: 0, enter: 'none' };
// A layout estimate only (about half an em per character); the renderer measures the real glyphs,
// `fit` caps a line at its room, and the native frame audit is what proves nothing overflows.
const textWidth = (value, size) => String(value).length * size * 0.56;
const own = (o, keys, name) => {
  check(o && typeof o === 'object' && !Array.isArray(o), `${name} must be an object`);
  for (const k of Object.keys(o)) check(keys.includes(k), `unknown ${name}.${k}`);
};
const words = (v, name, max) => { check(typeof v === 'string' && v.trim() && v.length <= max, `${name} needs text up to ${max} characters`); return v; };
const spoken = (v, name) => check(v == null || (typeof v === 'string' && v.trim() && v.length <= 40), `${name}.say is a word or short phrase from the narration`);

export function bridgeSpec(input, source) {
  own(input, ['title', 'unit', 'start', 'steps', 'end', 'domain', 'ticks', 'decimals', 'prefix', 'suffix', 'good', 'orientation', 'asOf', 'source', 'motion'], 'bridge');
  const p = { orientation: 'auto', good: 'up', decimals: 0, prefix: '', suffix: '', ...structuredClone(input) };
  words(p.title, 'title', 70); words(p.unit, 'unit (the value label, with units)', 45); utcDay(p.asOf);
  check(p.source == null || source == null || p.source === source, 'source conflicts with props.source');
  p.source = words(p.source ?? source, 'source', 110);
  check(['auto', 'vertical', 'horizontal'].includes(p.orientation), 'orientation is auto, vertical or horizontal');
  check(['up', 'down'].includes(p.good), 'good is up (an increase is good news) or down (a decrease is, as with costs)');
  check(Number.isInteger(p.decimals) && p.decimals >= 0 && p.decimals <= 3, 'decimals must be 0–3');
  for (const k of ['prefix', 'suffix']) check(typeof p[k] === 'string' && p[k].length <= 8, `${k} must be text up to 8 characters`);
  check(Array.isArray(p.domain) && p.domain.length === 2 && p.domain.every(finite) && p.domain[0] <= 0 && p.domain[1] >= 0 && p.domain[0] < p.domain[1],
    'domain needs [min, max] that includes zero, so the totals stand on an honest baseline');
  check(Array.isArray(p.ticks) && p.ticks.length >= 2 && p.ticks.length <= 6 && p.ticks.every(finite), 'ticks needs 2–6 values');
  check(p.ticks[0] === p.domain[0] && p.ticks.at(-1) === p.domain[1] && p.ticks.every((t, i) => !i || t > p.ticks[i - 1]),
    'ticks must increase and include both domain ends');
  const inside = (v, name) => check(v >= p.domain[0] && v <= p.domain[1], `${name} lies outside the domain`);
  for (const k of ['start', 'end']) {
    own(p[k], ['label', 'value', 'say'], k);
    words(p[k].label, `${k}.label`, 28);
    check(finite(p[k].value), `${k}.value must be a number`);
    spoken(p[k].say, k);
    inside(p[k].value, `${k}.value`);
  }
  check(p.start.say == null, 'start appears with the chart; cue the drivers and the end instead');
  check(Array.isArray(p.steps) && p.steps.length >= 1 && p.steps.length <= 10, 'steps needs 1–10 drivers (subtotals included)');
  // Display rounding is the only tolerance: what the viewer can add up must add up.
  const tolerance = 0.5 * 10 ** -p.decimals + 1e-9;
  const fmt = v => `${v < 0 ? '−' : ''}${p.prefix}${Math.abs(v).toFixed(p.decimals)}${p.suffix}`;
  const labels = new Set([p.start.label, p.end.label]);
  check(labels.size === 2, 'start and end need different labels');
  let level = p.start.value;
  for (const [i, s] of p.steps.entries()) {
    own(s, ['label', 'value', 'total', 'say'], `steps[${i}]`);
    words(s.label, `steps[${i}].label`, 28);
    check(!labels.has(s.label), 'labels must be unique'); labels.add(s.label);
    spoken(s.say, `steps[${i}]`);
    if (s.total != null) {
      check(s.total === true, `steps[${i}].total is true for a subtotal`);
      check(i > 0, 'a subtotal follows at least one driver');
      check(s.value == null || (finite(s.value) && Math.abs(s.value - level) <= tolerance),
        `steps[${i}] (${s.label}) says ${fmt(s.value)} but the drivers before it reach ${fmt(level)}`);
      s.value = level;
    } else {
      check(finite(s.value) && s.value !== 0, `steps[${i}].value must be a nonzero number (drop a driver that did not move)`);
      level += s.value;
    }
    inside(level, `the running total after steps[${i}] (${s.label})`);
  }
  check(Math.abs(level - p.end.value) <= tolerance,
    `the drivers take ${fmt(p.start.value)} to ${fmt(level)}, but end is ${fmt(p.end.value)}. ` +
    `Add the difference (${fmt(p.end.value - level)}) as an explicit step, for example {"label": "Other", "value": ${+(p.end.value - level).toFixed(p.decimals + 2)}}, rather than hiding it`);
  if (p.motion === undefined) p.motion = { at: 0.5, duration: Math.min(1 + 0.6 * p.steps.length, 7) };
  if (p.motion !== 'none') {
    own(p.motion, ['at', 'duration'], 'motion');
    check(finite(p.motion.at) && p.motion.at >= 0 && p.motion.at <= 10, 'motion.at must be 0–10 seconds');
    check(finite(p.motion.duration) && p.motion.duration >= 0.2 && p.motion.duration <= 12, 'motion.duration must be 0.2–12 seconds');
  }
  return p;
}

/** The columns in reading order, each with the level it starts from and the level it reaches. */
export function bridgeColumns(p) {
  const out = [{ kind: 'start', label: p.start.label, from: 0, to: p.start.value, value: p.start.value }];
  let level = p.start.value;
  for (const s of p.steps) {
    if (s.total) out.push({ kind: 'subtotal', label: s.label, from: 0, to: level, value: level, say: s.say });
    else { out.push({ kind: 'step', label: s.label, from: level, to: level + s.value, value: s.value, say: s.say }); level += s.value; }
  }
  out.push({ kind: 'end', label: p.end.label, from: 0, to: p.end.value, value: p.end.value, say: p.end.say });
  return out;
}

export function bridgeElements(p, frame) {
  const { width, height } = frame, L = plotLayout(frame), font = L.type;
  // Columns suit wide frames while every name fits in two lines of its column; otherwise rows read better.
  const colsAhead = p.steps.length + 2, slotAhead = (L.right + width * .06 - L.left) / colsAhead;
  const lines = label => { let n = 1, line = 0; for (const w of label.split(/\s+/)) { const ww = textWidth(w, font * .92); if (line && line + textWidth(' ', font * .92) + ww > slotAhead * .94) { n++; line = ww; } else line += (line ? textWidth(' ', font * .92) : 0) + ww; } return n; };
  const columnsFit = [p.start.label, p.end.label, ...p.steps.map(s => s.label)].every(l => lines(l) <= 2);
  const vertical = p.orientation === 'auto' ? width >= height && columnsFit : p.orientation === 'vertical';
  if (p.orientation === 'vertical') check(columnsFit, 'some names need more than two lines in their columns; shorten them or use orientation auto or horizontal');
  const fmt = v => `${v < 0 ? '−' : ''}${p.prefix}${Math.abs(v).toFixed(p.decimals)}${p.suffix}`;
  const signed = v => `${v < 0 ? '−' : '+'}${p.prefix}${Math.abs(v).toFixed(p.decimals)}${p.suffix}`;
  // Axis ticks carry only the decimals they need ($60, not $60.0).
  const tickDecimals = Math.min(p.decimals, Math.max(0, ...p.ticks.map(t => (String(t).split('.')[1] ?? '').length)));
  const tick = v => `${v < 0 ? '−' : ''}${p.prefix}${Math.abs(v).toFixed(tickDecimals)}${p.suffix}`;
  const [lo, hi] = p.domain, frac = v => (v - lo) / (hi - lo);
  const cols = bridgeColumns(p), n = cols.length;
  const valueText = c => c.kind === 'step' ? signed(c.value) : fmt(c.value);
  // Each column arrives in reading order: on its spoken word when it has one, else evenly across the motion.
  const timed = (c, i) => c.say != null ? { say: c.say } : { at: p.motion === 'none' ? 0 : p.motion.at + p.motion.duration * i / Math.max(n - 1, 1) };
  const grow = (c, i, axis, origin) => p.motion === 'none' ? show : { ...timed(c, i), enter: axis, origin, dur: 0.5 };
  const fadeIn = (c, i) => p.motion === 'none' ? show : { ...timed(c, i), enter: 'fade', dur: 0.4 };
  const link = (i) => p.motion === 'none' ? show : { ...timed(cols[i + 1], i + 1), enter: 'draw', dur: 0.3 };
  const good = c => (c.value > 0) === (p.good === 'up');
  const color = c => c.kind === 'end' ? 'accent2' : c.kind === 'step' ? (good(c) ? 'accent' : 'negative') : 'muted';
  const shift = titleShift(p.title, L, width - 2 * L.margin);
  const title = titleText(p.title, L, width - 2 * L.margin); title.id = 'bridge-title';
  const elements = [title,
    { id: 'bridge-unit', type: 'text', text: p.unit, x: L.margin, y: L.keyY + shift, size: L.keyType, fill: 'muted', font: 'semibold', fit: width - 2 * L.margin, ...show }];
  const top = L.top + shift, bottom = L.bottom;
  if (vertical) {
    const left = L.left, right = L.right + width * .06, slot = (right - left) / n, thickness = slot * .64;
    const py = v => bottom - frac(v) * (bottom - top), zero = py(0);
    check(thickness >= font * 1.6, 'too many columns for this frame; group small drivers or use orientation horizontal');
    check(cols.every(c => textWidth(valueText(c), font) <= slot * .96), 'values are too wide for their columns; use fewer decimals, a shorter unit or orientation horizontal');
    for (let i = 1; i < p.ticks.length; i++) check(py(p.ticks[i - 1]) - py(p.ticks[i]) >= font * 1.35, 'ticks would overlap; choose fewer ticks');
    for (const [i, t] of p.ticks.entries())
      elements.push({ id: `bridge-grid-${i}`, type: 'line', x1: left, y1: py(t), x2: right, y2: py(t), stroke: t === 0 ? 'muted' : 'line', width: t === 0 ? 2 : 1.25, ...show },
        { id: `bridge-tick-${i}`, type: 'text', text: tick(t), x: left - font * .7, y: py(t) + font * .35, size: font, fill: 'muted', font: 'figures', anchor: 'end', fit: left - L.margin, ...show });
    for (const [i, c] of cols.entries()) {
      const cx = left + slot * (i + .5), y0 = py(c.from), y1 = py(c.to), up = c.to >= c.from;
      elements.push({ id: `bridge-bar-${i}`, type: 'rect', x: cx - thickness / 2, y: Math.min(y0, y1), w: thickness, h: Math.max(Math.abs(y1 - y0), 2),
        r: Math.min(4, thickness * .06), fill: color(c), ...grow(c, i, 'grow-y', [cx, y0]) });
      // A value sits at the end the bar grew to: above a rise, below a fall.
      elements.push({ id: `bridge-value-${i}`, type: 'text', text: valueText(c), x: cx, y: up ? Math.min(y0, y1) - font * .55 : Math.max(y0, y1) + font * 1.25,
        size: font, fill: c.kind === 'end' ? 'accent2' : 'ink', font: 'figures', anchor: 'middle', fit: slot * .96, ...fadeIn(c, i) });
      elements.push({ id: `bridge-label-${i}`, type: 'text', text: c.label, x: cx, y: Math.max(bottom, zero) + font * 1.75, size: font * .92,
        fill: c.kind === 'step' ? 'muted' : 'ink', font: c.kind === 'step' ? 'semibold' : 'strong', anchor: 'middle', width: slot * .94, leading: 1.1, ...show });
      // The connector carries the running total across to where the next column starts.
      if (i < n - 1) {
        const level = py(c.to);
        elements.push({ id: `bridge-link-${i}`, type: 'line', x1: cx + thickness / 2, y1: level, x2: left + slot * (i + 1.5) - thickness / 2, y2: level,
          stroke: 'muted', width: 1.5, dash: [6, 6], ...link(i) });
      }
    }
  } else {
    // Rows read a bridge down the page. Wide frames keep the names in a column beside the bars; tall
    // frames put each name on a line above its bar so the bars keep the full width.
    const beside = width >= height;
    const labelW = beside ? Math.min(width * .34, Math.max(...cols.map(c => textWidth(c.label, font))) + font) : 0;
    const left = L.margin + labelW, right = width - L.margin - Math.max(...cols.map(c => textWidth(valueText(c), font))) - font;
    const slot = (bottom - top) / n, thickness = beside ? slot * .6 : Math.min(slot * .48, font * 2.2, slot - font * 1.5), px = v => left + frac(v) * (right - left), zero = px(0);
    check(right - left >= width * (beside ? .3 : .5), 'names or values are too wide for this frame; shorten them');
    check(beside ? slot >= font * 1.35 && thickness >= font * .75 : thickness >= font * .8, 'too many rows for this frame; group small drivers');
    // Tick labels that would collide are dropped (their grid lines stay); zero and the ends are kept first.
    const order = p.ticks.map((t, i) => i).sort((a, b) => (p.ticks[b] === 0) - (p.ticks[a] === 0) || (b === 0 || b === p.ticks.length - 1) - (a === 0 || a === p.ticks.length - 1) || a - b);
    const spans = [], labelled = new Set();
    for (const i of order) {
      const t = p.ticks[i], w = textWidth(tick(t), font), x = px(t), a = i === 0 ? x : i === p.ticks.length - 1 ? x - w : x - w / 2;
      if (spans.every(([s, e]) => a + w + font * .6 <= s || a >= e + font * .6)) { spans.push([a, a + w]); labelled.add(i); }
    }
    for (const [i, t] of p.ticks.entries()) {
      elements.push({ id: `bridge-grid-${i}`, type: 'line', x1: px(t), y1: top, x2: px(t), y2: bottom, stroke: t === 0 ? 'muted' : 'line', width: t === 0 ? 2 : 1.25, ...show });
      if (labelled.has(i)) elements.push({ id: `bridge-tick-${i}`, type: 'text', text: tick(t), x: px(t), y: bottom + font * 1.6, size: font, fill: 'muted', font: 'figures', anchor: i === 0 ? 'start' : i === p.ticks.length - 1 ? 'end' : 'middle', ...show });
    }
    for (const [i, c] of cols.entries()) {
      const cy = top + slot * (i + .5) + (beside ? 0 : font * .55), x0 = px(c.from), x1 = px(c.to);
      elements.push({ id: `bridge-bar-${i}`, type: 'rect', x: Math.min(x0, x1), y: cy - thickness / 2, w: Math.max(Math.abs(x1 - x0), 2), h: thickness,
        r: Math.min(4, thickness * .06), fill: color(c), ...grow(c, i, 'grow-x', [x0, cy]) },
        beside
          ? { id: `bridge-label-${i}`, type: 'text', text: c.label, x: left - font * .7, y: cy + font * .35, size: font, fill: c.kind === 'step' ? 'muted' : 'ink',
            font: c.kind === 'step' ? 'semibold' : 'strong', anchor: 'end', fit: labelW - font * .7, ...show }
          : { id: `bridge-label-${i}`, type: 'text', text: c.label, x: left + font * .5, y: cy - thickness / 2 - font * .45, size: font * .92, fill: c.kind === 'step' ? 'muted' : 'ink',
            font: c.kind === 'step' ? 'semibold' : 'strong', fit: (right - left) * .6, ...show },
        { id: `bridge-value-${i}`, type: 'text', text: valueText(c), x: Math.max(x0, x1, zero) + font * .5, y: cy + font * .35, size: font,
          fill: c.kind === 'end' ? 'accent2' : 'ink', font: 'figures', anchor: 'start', fit: width - L.margin - Math.max(x0, x1, zero) - font * .5, ...fadeIn(c, i) });
      if (i < n - 1) {
        const x = px(c.to), y1 = cy + thickness / 2, y2 = cy + slot - thickness / 2, nameBase = y2 - font * .45;
        // The next row's name sits in the gap: break the line around it rather than strike through the words.
        const name = cols[i + 1].label, crosses = !beside && x >= left + font * .2 && x <= left + font * .5 + textWidth(name, font * .92) + font * .3;
        const spans = crosses ? [[y1, nameBase - font * 1.05], [nameBase + font * .3, y2]] : [[y1, y2]];
        spans.filter(([a, b]) => b - a > 4).forEach(([a, b], k) => elements.push({ id: `bridge-link-${i}${k ? `-${k}` : ''}`, type: 'line', x1: x, y1: a, x2: x, y2: b,
          stroke: 'muted', width: 1.5, dash: [6, 6], ...link(i) }));
      }
    }
  }
  return elements;
}

/**
 * Reading order once spoken cues are resolved: cued columns are anchors and keep their times;
 * uncued columns keep theirs when they already fall in order between the anchors, otherwise they
 * are spread evenly between them (a gap apart after the last anchor). Cued columns out of order
 * are the author's to fix. Returns one time per column.
 */
export function orderBridgeTimes(times, cued, gap = 0.35) {
  const out = [...times], anchors = cued.map((c, i) => c ? i : -1).filter(i => i >= 0);
  for (let k = 1; k < anchors.length; k++)
    check(out[anchors[k]] > out[anchors[k - 1]], `column ${anchors[k] + 1} is cued at ${out[anchors[k]].toFixed(2)} s, before column ${anchors[k - 1] + 1} (${out[anchors[k - 1]].toFixed(2)} s); cue the drivers in reading order`);
  check(!cued[0], 'the opening total is never cued');
  let i = 0;
  while (i < out.length) {
    if (cued[i]) { i++; continue; }
    let j = i; while (j < out.length && !cued[j]) j++;
    const lo = i > 0 ? out[i - 1] : -Infinity, hi = j < out.length ? out[j] : Infinity;
    const run = out.slice(i, j), inOrder = run.every((t, k) => t > (k ? run[k - 1] : lo) && t < hi && (k || i > 0 || t >= 0));
    if (!inOrder) {
      if (Number.isFinite(hi)) {
        const from = Number.isFinite(lo) ? lo : Math.max(0, hi - gap * (run.length + 1)), step = (hi - from) / (run.length + (Number.isFinite(lo) ? 1 : 0.5));
        run.forEach((_, k) => { out[i + k] = Number.isFinite(lo) ? from + step * (k + 1) : from + step * k; });
      } else run.forEach((t, k) => { out[i + k] = Math.max(t, (k ? out[i + k - 1] : lo) + gap); });
    }
    i = j;
  }
  return out;
}

export function expandBridgeProps(input, frame) {
  if (input?.bridge == null) return input;
  const { bridge, ...rest } = structuredClone(input);
  for (const key of ['plot', 'bars', 'stat', 'distribution', 'multiples', 'kpi', 'teaching', 'chart', 'sketch', 'plates', 'world', 'dolly', 'focus', 'view', 'viewFrom', 'viewTall', 'viewDrift', 'title'])
    check(rest[key] == null, `cannot combine bridge with ${key}`);
  const p = bridgeSpec(bridge, rest.source);
  // Spoken cues are checked against the narration when the job is built; timed reveals need a reading hold here.
  const cued = p.end.say != null || p.steps.some(s => s.say != null), end = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration + 0.5;
  if (frame.duration != null && !cued) check(frame.duration >= end + 2, 'beat needs two seconds after the bridge settles');
  const elements = bridgeElements(p, frame);
  if (frame.beatId) for (const el of elements) el.id = `${frame.beatId}-${el.id}`;
  return { ...rest, sourceSize: Math.max(32, plotLayout(frame).type * .95), source: `${p.source} · ${p.asOf}`, view: [0, 0, frame.width, frame.height], elements: [...elements, ...(rest.elements ?? [])] };
}
