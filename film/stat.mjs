// A headline figure: one sourced number, what it measures, and how it changed.
// Shares the plot's frame and type so a stat can introduce or follow a chart in the same film.
import { plotLayout, titleText } from './plots.mjs';
import { utcDay } from './plot-data.mjs';

const check = (ok, message) => { if (!ok) throw new Error(`stat: ${message}`); };
const finite = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e12;
const show = { at: 0, enter: 'none' };
const own = (o, keys, name) => {
  check(o && typeof o === 'object' && !Array.isArray(o), `${name} must be an object`);
  for (const k of Object.keys(o)) check(keys.includes(k), `unknown ${name}.${k}`);
};
const words = (v, name, max) => { check(typeof v === 'string' && v.trim() && v.length <= max, `${name} needs text up to ${max} characters`); return v; };
const affix = (v, name) => { check(v == null || (typeof v === 'string' && v.length <= 8), `${name} must be text up to 8 characters`); return v ?? ''; };

export function statSpec(input, source) {
  own(input, ['kicker', 'value', 'decimals', 'prefix', 'suffix', 'label', 'change', 'asOf', 'source', 'motion', 'count'], 'stat');
  const p = { decimals: 0, count: true, ...structuredClone(input) };
  if (p.kicker != null) words(p.kicker, 'kicker', 40);
  words(p.label, 'label (what the number measures, with its period)', 60);
  check(finite(p.value), 'value must be a finite number');
  check(Number.isInteger(p.decimals) && p.decimals >= 0 && p.decimals <= 2, 'decimals must be 0–2');
  p.prefix = affix(p.prefix, 'prefix'); p.suffix = affix(p.suffix, 'suffix');
  check(typeof p.count === 'boolean', 'count is true or false');
  utcDay(p.asOf);
  check(p.source == null || source == null || p.source === source, 'source conflicts with props.source');
  p.source = words(p.source ?? source, 'source', 110);
  if (p.change != null) {
    own(p.change, ['value', 'decimals', 'suffix', 'context', 'good'], 'change');
    check(finite(p.change.value), 'change.value must be a finite number');
    p.change.decimals ??= p.decimals;
    check(Number.isInteger(p.change.decimals) && p.change.decimals >= 0 && p.change.decimals <= 2, 'change.decimals must be 0–2');
    p.change.suffix = affix(p.change.suffix, 'change.suffix');
    words(p.change.context, 'change.context (for example "vs a year earlier")', 40);
    // Whether a rise is good news depends on the measure (returns: up; inflation or fees: down).
    check(['up', 'down', 'neutral'].includes(p.change.good ?? 'up'), 'change.good is up, down or neutral');
    p.change.good ??= 'up';
  }
  if (p.motion === undefined) p.motion = { at: 0.4, duration: 1.4 };
  if (p.motion !== 'none') {
    own(p.motion, ['at', 'duration'], 'motion');
    check(finite(p.motion.at) && p.motion.at >= 0 && p.motion.at <= 10, 'motion.at must be 0–10 seconds');
    check(finite(p.motion.duration) && p.motion.duration >= 0.2 && p.motion.duration <= 6, 'motion.duration must be 0.2–6 seconds');
  }
  return p;
}

const number = (v, decimals) => Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

export function statElements(p, frame) {
  const { width, height } = frame, L = plotLayout(frame), tall = L.shape !== 'landscape';
  const W = width - 2 * L.margin, x = L.margin;
  const at = p.motion === 'none' ? 0 : p.motion.at, dur = p.motion === 'none' ? 0 : p.motion.duration;
  const arrive = t => t === 0 ? show : { at: t, enter: 'rise', dur: 0.45 };
  const valueSize = width * (tall ? .22 : .135), text = `${p.value < 0 ? '−' : ''}${p.prefix}${number(p.value, p.decimals)}${p.suffix}`;
  const valueY = height * (tall ? .5 : .56);
  const elements = [];
  if (p.kicker) {
    const k = titleText(p.kicker, { ...L, titleType: L.keyType * 1.05 }, W);
    Object.assign(k, { id: 'stat-kicker', y: valueY - valueSize * 1.05, font: 'semibold', fill: 'muted', upper: true, tracking: .08, ...arrive(at * .5) });
    elements.push(k);
  }
  // Tabular figures while counting: proportional digits make the suffix jump as widths change.
  elements.push({ id: 'stat-value', type: 'text', text, x, y: valueY, size: valueSize, fill: 'ink', font: p.count && p.motion !== 'none' ? 'figures' : 'display', fit: W,
    ...(p.count && p.motion !== 'none'
      ? { at, enter: 'fade', dur: 0.2, count: { from: 0, to: Math.abs(p.value), decimals: p.decimals, prefix: `${p.value < 0 ? '−' : ''}${p.prefix}`, suffix: p.suffix, dur } }
      : arrive(at)) });
  const labelSize = width * (tall ? .045 : .026);
  elements.push({ id: 'stat-label', type: 'text', text: p.label, x, y: valueY + labelSize * 1.9, size: labelSize, fill: 'ink', font: 'semibold',
    width: W, height: labelSize * 2.6, ...arrive(at + dur * .5) });
  if (p.change) {
    const c = p.change, up = c.value > 0, flat = c.value === 0;
    const tone = flat || c.good === 'neutral' ? 'muted' : (up === (c.good === 'up') ? 'positive' : 'negative');
    const sign = flat ? '±' : up ? '+' : '−';
    elements.push({ id: 'stat-change', type: 'text', text: `${flat ? '■' : up ? '▲' : '▼'}  ${sign}${number(c.value, c.decimals)}${c.suffix} ${c.context}`,
      x, y: valueY + labelSize * (tall ? 5.2 : 4.4), size: labelSize * .9, fill: tone, font: 'figures', fit: W, ...arrive(at + dur + .2) });
  }
  return elements;
}

export function expandStatProps(input, frame) {
  if (input?.stat == null) return input;
  const { stat, ...rest } = structuredClone(input);
  for (const key of ['plot', 'bars', 'kpi', 'teaching', 'chart', 'sketch', 'plates', 'world', 'dolly', 'focus', 'view', 'viewFrom', 'viewTall', 'viewDrift', 'title'])
    check(rest[key] == null, `cannot combine stat with ${key}`);
  const p = statSpec(stat, rest.source);
  const end = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration + .65;
  if (frame.duration != null) check(frame.duration >= end + 2, 'beat needs two seconds after the figure settles');
  const elements = statElements(p, frame);
  if (frame.beatId) for (const el of elements) el.id = `${frame.beatId}-${el.id}`;
  return { ...rest, sourceSize: Math.max(32, plotLayout(frame).type * .95), source: `${p.source} · ${p.asOf}`, view: [0, 0, frame.width, frame.height], elements: [...elements, ...(rest.elements ?? [])] };
}
