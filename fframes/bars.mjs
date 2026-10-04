// Signed editorial bar charts: annual returns, contributions, flows in and out.
// Shares the plot's frame layout and type so bar and line beats cut together as one system.
import { plotLayout, titleText, titleShift } from './plots.mjs';
import { utcDay } from './plot-data.mjs';

const check = (ok, message) => { if (!ok) throw new Error(`bars: ${message}`); };
const finite = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e12;
const show = { at: 0, enter: 'none' };
const textWidth = (value, size) => String(value).length * size * 0.56;
const own = (o, keys, name) => {
  check(o && typeof o === 'object' && !Array.isArray(o), `${name} must be an object`);
  for (const k of Object.keys(o)) check(keys.includes(k), `unknown ${name}.${k}`);
};
const words = (v, name, max) => { check(typeof v === 'string' && v.trim() && v.length <= max, `${name} needs text up to ${max} characters`); return v; };

export function barsSpec(input, source) {
  own(input, ['title', 'unit', 'values', 'domain', 'ticks', 'decimals', 'prefix', 'suffix', 'orientation', 'reference', 'colors', 'asOf', 'source', 'motion'], 'bars');
  const p = { orientation: 'vertical', colors: 'sign', decimals: 0, prefix: '', suffix: '', ...structuredClone(input) };
  words(p.title, 'title', 70); words(p.unit, 'unit (the value label, with units)', 45); utcDay(p.asOf);
  check(p.source == null || source == null || p.source === source, 'source conflicts with props.source');
  p.source = words(p.source ?? source, 'source', 110);
  check(['vertical', 'horizontal'].includes(p.orientation), 'orientation is vertical or horizontal');
  check(['sign', 'single'].includes(p.colors), 'colors is sign or single');
  check(Number.isInteger(p.decimals) && p.decimals >= 0 && p.decimals <= 3, 'decimals must be 0–3');
  for (const k of ['prefix', 'suffix']) check(typeof p[k] === 'string' && p[k].length <= 8, `${k} must be text up to 8 characters`);
  check(Array.isArray(p.domain) && p.domain.length === 2 && p.domain.every(finite) && p.domain[0] <= 0 && p.domain[1] >= 0 && p.domain[0] < p.domain[1],
    'domain needs [min, max] that includes zero, so bar length is honest');
  check(Array.isArray(p.ticks) && p.ticks.length >= 2 && p.ticks.length <= 6 && p.ticks.every(finite), 'ticks needs 2–6 values');
  check(p.ticks[0] === p.domain[0] && p.ticks.at(-1) === p.domain[1] && p.ticks.every((t, i) => !i || t > p.ticks[i - 1]),
    'ticks must increase and include both domain ends');
  check(Array.isArray(p.values) && p.values.length >= 2 && p.values.length <= (p.orientation === 'vertical' ? 24 : 12),
    `values needs 2–${p.orientation === 'vertical' ? 24 : 12} bars`);
  const labels = new Set();
  for (const [i, v] of p.values.entries()) {
    own(v, ['label', 'value', 'highlight'], `values[${i}]`);
    words(v.label, `values[${i}].label`, 28);
    check(!labels.has(v.label), 'bar labels must be unique'); labels.add(v.label);
    check(finite(v.value) && v.value >= p.domain[0] && v.value <= p.domain[1], `values[${i}].value lies outside the domain`);
    check(v.highlight == null || typeof v.highlight === 'boolean', 'highlight is true or false');
  }
  if (p.reference != null) {
    own(p.reference, ['value', 'label'], 'reference');
    check(finite(p.reference.value) && p.reference.value >= p.domain[0] && p.reference.value <= p.domain[1], 'reference.value lies outside the domain');
    words(p.reference.label, 'reference.label', 24);
  }
  if (p.motion === undefined) p.motion = { at: 0.5, duration: 1.6 };
  if (p.motion !== 'none') {
    own(p.motion, ['at', 'duration'], 'motion');
    check(finite(p.motion.at) && p.motion.at >= 0 && p.motion.at <= 10, 'motion.at must be 0–10 seconds');
    check(finite(p.motion.duration) && p.motion.duration >= 0.2 && p.motion.duration <= 10, 'motion.duration must be 0.2–10 seconds');
  }
  return p;
}

export function barsElements(p, frame) {
  const { width } = frame, L = plotLayout(frame), font = L.type, vertical = p.orientation === 'vertical';
  const fmt = v => `${v < 0 ? '−' : ''}${p.prefix}${Math.abs(v).toFixed(p.decimals)}${p.suffix}`;
  const [lo, hi] = p.domain, frac = v => (v - lo) / (hi - lo);
  const n = p.values.length, end = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration;
  const arrive = at => at === 0 ? show : { at, enter: 'fade', dur: 0.3 };
  const shift = titleShift(p.title, L, width - 2 * L.margin);
  // Horizontal bars need room for category names on the left.
  const left = vertical ? L.left : L.margin + Math.min(width * .26, Math.max(...p.values.map(v => textWidth(v.label, font))) + font);
  const right = vertical ? L.right : L.right + width * .02, top = L.top + shift, bottom = L.bottom;
  const color = v => v.highlight ? 'accent2' : p.colors === 'single' || v.value >= 0 ? 'accent' : 'negative';
  const title = titleText(p.title, L, width - 2 * L.margin); title.id = 'bars-title';
  const elements = [title,
    { id: 'bars-unit', type: 'text', text: p.unit, x: L.margin, y: L.keyY + shift, size: L.keyType, fill: 'muted', font: 'semibold', fit: width - 2 * L.margin, ...show },
  ];
  const slot = (vertical ? right - left : bottom - top) / n, thickness = slot * (vertical ? .62 : .58);
  check(thickness >= font * .5, 'too many bars for this frame; aggregate or use a line plot');
  if (vertical) {
    const py = v => bottom - frac(v) * (bottom - top), zero = py(0);
    for (let i = 1; i < p.ticks.length; i++) check(py(p.ticks[i - 1]) - py(p.ticks[i]) >= font * 1.35, 'ticks would overlap; choose fewer ticks');
    for (const [i, t] of p.ticks.entries())
      elements.push({ id: `bars-grid-${i}`, type: 'line', x1: left, y1: py(t), x2: right, y2: py(t), stroke: t === 0 ? 'muted' : 'line', width: t === 0 ? 2 : 1.25, ...show },
        { id: `bars-tick-${i}`, type: 'text', text: fmt(t), x: left - font * .7, y: py(t) + font * .35, size: font, fill: 'muted', font: 'figures', anchor: 'end', fit: left - L.margin, ...show });
    const every = Math.ceil((Math.max(...p.values.map(v => textWidth(v.label, font))) + font * .6) / slot);
    // Narrow bars label only the extremes and highlights; every value stays in the bar height.
    const allValues = textWidth(fmt(p.values.reduce((a, v) => Math.abs(v.value) > Math.abs(a.value) ? v : a).value), font) <= slot * .95;
    const max = p.values.reduce((a, v) => v.value > a.value ? v : a), min = p.values.reduce((a, v) => v.value < a.value ? v : a);
    for (const [i, v] of p.values.entries()) {
      const cx = left + slot * (i + .5), y = py(v.value), at = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration * .6 * i / Math.max(n - 1, 1);
      const h = Math.max(Math.abs(y - zero), 1.5);
      elements.push({ id: `bars-bar-${i}`, type: 'rect', x: cx - thickness / 2, y: Math.min(y, zero), w: thickness, h, r: Math.min(4, thickness * .08), fill: color(v),
        ...(p.motion === 'none' ? show : { at, enter: 'grow-y', origin: [cx, zero], dur: p.motion.duration * .4 }) });
      const labelY = v.value >= 0 ? y - font * .55 : y + font * 1.25;
      if (allValues || v.highlight || v === max || v === min)
        elements.push({ id: `bars-value-${i}`, type: 'text', text: fmt(v.value), x: cx, y: labelY, size: font, fill: v.highlight ? 'accent2' : 'ink',
          font: 'figures', anchor: 'middle', ...arrive(at + (p.motion === 'none' ? 0 : p.motion.duration * .4)) });
      if ((i % every === 0 && n - 1 - i >= every) || i === n - 1)
        elements.push({ id: `bars-label-${i}`, type: 'text', text: v.label, x: cx, y: Math.max(bottom, zero) + font * 1.75, size: font, fill: v.highlight ? 'ink' : 'muted', font: 'figures', anchor: 'middle', fit: slot * every * .95, ...show });
    }
    if (p.reference) {
      const y = py(p.reference.value);
      elements.push({ id: 'bars-reference', type: 'line', x1: left, y1: y, x2: right, y2: y, stroke: 'ink', width: 2, dash: [10, 8], ...arrive(end) },
        { id: 'bars-reference-label', type: 'text', text: `${p.reference.label} ${fmt(p.reference.value)}`, x: right + font * .6, y: y + font * .35, size: font,
          fill: 'ink', font: 'semibold', fit: width - L.margin - right - font * .6, ...arrive(end) });
    }
  } else {
    const px = v => left + frac(v) * (right - left), zero = px(0);
    // Tick labels that would collide are dropped (their grid lines stay); zero and the ends are kept first.
    const order = p.ticks.map((t, i) => i).sort((a, b) => (p.ticks[b] === 0) - (p.ticks[a] === 0) || (b === 0 || b === p.ticks.length - 1) - (a === 0 || a === p.ticks.length - 1) || a - b);
    const spans = [], labelled = new Set();
    for (const i of order) {
      const t = p.ticks[i], w = textWidth(fmt(t), font), x = px(t);
      const a = i === 0 ? x : i === p.ticks.length - 1 ? x - w : x - w / 2;
      if (spans.every(([s, e]) => a + w + font * .6 <= s || a >= e + font * .6)) { spans.push([a, a + w]); labelled.add(i); }
    }
    for (const [i, t] of p.ticks.entries()) {
      elements.push({ id: `bars-grid-${i}`, type: 'line', x1: px(t), y1: top, x2: px(t), y2: bottom, stroke: t === 0 ? 'muted' : 'line', width: t === 0 ? 2 : 1.25, ...show });
      if (labelled.has(i)) elements.push({ id: `bars-tick-${i}`, type: 'text', text: fmt(t), x: px(t), y: bottom + font * 1.6, size: font, fill: 'muted', font: 'figures', anchor: i === 0 ? 'start' : i === p.ticks.length - 1 ? 'end' : 'middle', ...show });
    }
    for (const [i, v] of p.values.entries()) {
      const cy = top + slot * (i + .5), x = px(v.value), at = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration * .6 * i / Math.max(n - 1, 1);
      elements.push({ id: `bars-bar-${i}`, type: 'rect', x: Math.min(x, zero), y: cy - thickness / 2, w: Math.max(Math.abs(x - zero), 1.5), h: thickness, r: Math.min(4, thickness * .08), fill: color(v),
        ...(p.motion === 'none' ? show : { at, enter: 'grow-x', origin: [zero, cy], dur: p.motion.duration * .4 }) },
        { id: `bars-label-${i}`, type: 'text', text: v.label, x: left - font * .7, y: cy + font * .35, size: font, fill: v.highlight ? 'ink' : 'muted', font: 'semibold', anchor: 'end', fit: left - L.margin - font * .7, ...show },
        // A negative value sits left of its bar unless that would reach the category names; then it moves past zero.
        (() => { const w = textWidth(fmt(v.value), font), outside = v.value >= 0 || x - font * .5 - w >= left + font * .3;
          return { id: `bars-value-${i}`, type: 'text', text: fmt(v.value), x: v.value >= 0 ? x + font * .5 : outside ? x - font * .5 : zero + font * .5, y: cy + font * .35, size: font,
            fill: v.highlight ? 'accent2' : 'ink', font: 'figures', anchor: v.value >= 0 || !outside ? 'start' : 'end', ...arrive(at + (p.motion === 'none' ? 0 : p.motion.duration * .4)) }; })());
      check(thickness >= font * 1.1, 'horizontal bars need room for one line of label; use fewer bars');
    }
    if (p.reference) {
      const x = px(p.reference.value);
      elements.push({ id: 'bars-reference', type: 'line', x1: x, y1: top - font * .6, x2: x, y2: bottom, stroke: 'ink', width: 2, dash: [10, 8], ...arrive(end) },
        { id: 'bars-reference-label', type: 'text', text: `${p.reference.label} ${fmt(p.reference.value)}`, x, y: top - font * 1.0, size: font, fill: 'ink', font: 'semibold', anchor: 'middle', ...arrive(end) });
    }
  }
  return elements;
}

export function expandBarsProps(input, frame) {
  if (input?.bars == null) return input;
  const { bars, ...rest } = structuredClone(input);
  for (const key of ['plot', 'kpi', 'teaching', 'chart', 'sketch', 'plates', 'world', 'dolly', 'focus', 'view', 'viewFrom', 'viewTall', 'viewDrift', 'title'])
    check(rest[key] == null, `cannot combine bars with ${key}`);
  const p = barsSpec(bars, rest.source);
  const end = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration;
  if (frame.duration != null) check(frame.duration >= end + 2, 'beat needs two seconds after the bars settle');
  const elements = barsElements(p, frame);
  if (frame.beatId) for (const el of elements) el.id = `${frame.beatId}-${el.id}`;
  return { ...rest, sourceSize: Math.max(32, plotLayout(frame).type * .95), source: `${p.source} · ${p.asOf}`, view: [0, 0, frame.width, frame.height], elements: [...elements, ...(rest.elements ?? [])] };
}
