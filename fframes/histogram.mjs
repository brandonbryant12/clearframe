// Editorial histogram for storyboards: how often outcomes landed in each range.
// Counting and edges come from distribution-data.mjs; this module only lays the result out
// on the plot's frame so it cuts with line, bar and stat beats.
import { distribution } from './distribution-data.mjs';
import { plotLayout, titleText, titleShift } from './plots.mjs';

const check = (ok, message) => { if (!ok) throw new Error(`distribution: ${message}`); };
const show = { at: 0, enter: 'none' };
const textWidth = (value, size) => String(value).length * size * 0.56;
const own = (o, keys, name) => {
  check(o && typeof o === 'object' && !Array.isArray(o), `${name} must be an object`);
  for (const k of Object.keys(o)) check(keys.includes(k), `unknown ${name}.${k}`);
};

export function histogramSpec(input, source) {
  own(input, ['title', 'unit', 'observations', 'edges', 'threshold', 'marker', 'prefix', 'suffix', 'decimals', 'tone', 'asOf', 'source', 'motion'], 'distribution');
  const p = { prefix: '', suffix: '', decimals: 0, tone: 'negative', ...structuredClone(input) };
  check(p.source == null || source == null || p.source === source, 'source conflicts with props.source');
  p.source ??= source;
  check(typeof p.title === 'string' && p.title.length <= 70, 'title needs text up to 70 characters');
  check(['negative', 'highlight'].includes(p.tone), 'tone is negative or highlight');
  for (const k of ['prefix', 'suffix']) check(typeof p[k] === 'string' && p[k].length <= 8, `${k} must be text up to 8 characters`);
  check(Number.isInteger(p.decimals) && p.decimals >= 0 && p.decimals <= 2, 'decimals must be 0–2');
  own(p.threshold, ['value', 'relation', 'label'], 'threshold');
  check(typeof p.threshold.label === 'string' && p.threshold.label.trim() && p.threshold.label.length <= 32, 'threshold.label names the qualifying outcomes, up to 32 characters');
  const { label, ...threshold } = p.threshold;
  // Counting needs a y scale; the editorial layout labels counts on the bars instead of drawing an axis.
  const probe = distribution({ title: p.title, source: p.source, asOf: p.asOf, unit: p.unit, observations: p.observations, edges: p.edges, mode: 'count', threshold, y: { max: 1e6, ticks: [0, 1e6] } });
  const max = Math.max(...probe.bins.map(b => b.count));
  p.model = distribution({ title: p.title, source: p.source, asOf: p.asOf, unit: p.unit, observations: p.observations, edges: p.edges, mode: 'count', threshold, y: { max, ticks: [0, max] } });
  if (p.marker != null) {
    own(p.marker, ['value', 'label'], 'marker');
    check(typeof p.marker.value === 'number' && p.marker.value >= p.edges[0] && p.marker.value <= p.edges.at(-1), 'marker.value must lie inside the bins');
    check(typeof p.marker.label === 'string' && p.marker.label.trim() && p.marker.label.length <= 24, 'marker.label needs text up to 24 characters');
  }
  if (p.motion === undefined) p.motion = { at: 0.5, duration: 1.6 };
  if (p.motion !== 'none') {
    own(p.motion, ['at', 'duration'], 'motion');
    check(p.motion.at >= 0 && p.motion.at <= 10 && p.motion.duration >= 0.2 && p.motion.duration <= 10, 'motion needs at 0–10 and duration 0.2–10 seconds');
  }
  return p;
}

export function histogramElements(p, frame) {
  const { width } = frame, L = plotLayout(frame), font = L.type, m = p.model;
  const fmt = v => `${v < 0 ? '−' : ''}${p.prefix}${Math.abs(v).toFixed(p.decimals)}${p.suffix}`;
  const arrive = t => t === 0 ? show : { at: t, enter: 'fade', dur: 0.3 };
  const shift = titleShift(p.title, L, width - 2 * L.margin);
  const title = titleText(p.title, L, width - 2 * L.margin); title.id = 'distribution-title';
  const left = L.margin + width * .01, right = width - L.margin - width * .01, top = L.top + shift + font * 2.6, bottom = L.bottom;
  const [lo, hi] = [m.edges[0], m.edges.at(-1)], px = v => left + (v - lo) / (hi - lo) * (right - left);
  const py = c => bottom - c / m.y.max * (bottom - top);
  const n = m.bins.length, end = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration;
  const t = p.model.threshold, qualifies = v => t.relation === 'gte' ? v >= t.value : t.relation === 'gt' ? v > t.value : t.relation === 'lte' ? v <= t.value : v < t.value;
  const elements = [title,
    { id: 'distribution-unit', type: 'text', text: p.unit, x: L.margin, y: L.keyY + shift, size: L.keyType, fill: 'muted', font: 'semibold', fit: width - 2 * L.margin, ...show }];
  const gap = Math.max(2, (right - left) / n * .06);
  for (const [i, b] of m.bins.entries()) {
    const x1 = px(b.low) + gap / 2, x2 = px(b.high) - gap / 2, y = py(b.count), at = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration * .7 * i / Math.max(n - 1, 1);
    // A bin wholly on the qualifying side takes the tone; a bin the threshold splits stays neutral.
    const side = qualifies(b.low) && qualifies(b.high - 1e-9) ? (p.tone === 'negative' ? 'negative' : 'accent2') : 'accent';
    if (b.count > 0) {
      elements.push({ id: `distribution-bar-${i}`, type: 'rect', x: x1, y, w: x2 - x1, h: bottom - y, r: Math.min(4, (x2 - x1) * .06), fill: side,
        ...(p.motion === 'none' ? show : { at, enter: 'grow-y', origin: [(x1 + x2) / 2, bottom], dur: p.motion.duration * .35 }) },
        { id: `distribution-count-${i}`, type: 'text', text: String(b.count), x: (x1 + x2) / 2, y: y - font * .5, size: font, fill: 'ink', font: 'figures', anchor: 'middle',
          ...arrive(at + (p.motion === 'none' ? 0 : p.motion.duration * .35)) });
    }
  }
  elements.push({ id: 'distribution-base', type: 'line', x1: left, y1: bottom, x2: right, y2: bottom, stroke: 'muted', width: 2, ...show });
  // Edge labels, thinned so neighbours never collide; the ends are kept.
  let lastEnd = -Infinity;
  for (const [i, e] of m.edges.entries()) {
    const text = fmt(e), w = textWidth(text, font), x = px(e), a = i === 0 ? x : i === m.edges.length - 1 ? x - w : x - w / 2;
    const isEnd = i === m.edges.length - 1;
    if (a < lastEnd + font && !isEnd) continue;
    if (isEnd && a < lastEnd + font) elements.pop();
    elements.push({ id: `distribution-edge-${i}`, type: 'text', text, x, y: bottom + font * 1.6, size: font, fill: 'muted', font: 'figures',
      anchor: i === 0 ? 'start' : isEnd ? 'end' : 'middle', ...show });
    lastEnd = a + w;
  }
  const tx = px(t.value);
  elements.push({ id: 'distribution-threshold', type: 'line', x1: tx, y1: top - font * .4, x2: tx, y2: bottom, stroke: 'ink', width: 2, dash: [10, 8], ...arrive(end) });
  // The threshold sentence sits in the header, keyed by a dashed swatch, so it never competes with the bars.
  const sentence = `${p.threshold.label}: ${t.count} of ${t.denominator}`, K = L.keyType, sy = L.keyY + shift + K * 1.7;
  elements.push({ id: 'distribution-threshold-key', type: 'line', x1: L.margin, y1: sy - K * .32, x2: L.margin + K * 1.2, y2: sy - K * .32, stroke: 'ink', width: 2, dash: [6, 5], ...arrive(end) },
    { id: 'distribution-threshold-label', type: 'text', text: sentence, x: L.margin + K * 1.6, y: sy, size: K, fill: 'ink', font: 'semibold', fit: width - 2 * L.margin - K * 1.6, ...arrive(end + .2) });
  if (p.marker) {
    const b = m.bins.find(b => p.marker.value >= b.low && (p.marker.value < b.high || b.rightClosed && p.marker.value <= b.high));
    const x = px(p.marker.value), y = py(b.count) - font * 1.6;
    elements.push({ id: 'distribution-marker', type: 'poly', closed: true, points: [[x - font * .45, y - font * .7], [x + font * .45, y - font * .7], [x, y]], fill: 'accent2', ...arrive(end + .5) },
      { id: 'distribution-marker-label', type: 'text', text: p.marker.label, x, y: y - font * 1.1, size: font, fill: 'accent2', font: 'semibold', anchor: 'middle', ...arrive(end + .5) });
  }
  return elements;
}

export function expandHistogramProps(input, frame) {
  if (input?.distribution == null) return input;
  const { distribution: spec, ...rest } = structuredClone(input);
  for (const key of ['plot', 'bars', 'stat', 'kpi', 'teaching', 'chart', 'sketch', 'plates', 'world', 'dolly', 'focus', 'view', 'viewFrom', 'viewTall', 'viewDrift', 'title'])
    check(rest[key] == null, `cannot combine distribution with ${key}`);
  const p = histogramSpec(spec, rest.source);
  const end = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration + .5;
  if (frame.duration != null) check(frame.duration >= end + 2, 'beat needs two seconds after the threshold and marker land');
  const elements = histogramElements(p, frame);
  if (frame.beatId) for (const el of elements) el.id = `${frame.beatId}-${el.id}`;
  const missing = p.model.missing ? ` ${p.model.missing} missing observation${p.model.missing > 1 ? 's' : ''} excluded.` : '';
  return { ...rest, sourceSize: Math.max(32, plotLayout(frame).type * .95), source: `${p.source}${missing} · ${p.asOf}`, view: [0, 0, frame.width, frame.height], elements: [...elements, ...(rest.elements ?? [])] };
}
