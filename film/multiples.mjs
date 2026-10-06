// Small multiples: one small line per series on one shared scale, so shapes compare honestly.
// Each panel's data passes the plot's own contract (dates, log axes, gaps); layout shares the chart system.
import { plotSpec, axisPosition, axisLabel, utcDay } from './plot-data.mjs';
import { plotLayout, titleText, titleShift } from './plots.mjs';

const check = (ok, message) => { if (!ok) throw new Error(`multiples: ${message}`); };
const show = { at: 0, enter: 'none' };
const own = (o, keys, name) => {
  check(o && typeof o === 'object' && !Array.isArray(o), `${name} must be an object`);
  for (const k of Object.keys(o)) check(keys.includes(k), `unknown ${name}.${k}`);
};

export function multiplesSpec(input, source) {
  own(input, ['title', 'unit', 'x', 'y', 'series', 'highlight', 'asOf', 'source', 'motion'], 'multiples');
  const p = structuredClone(input);
  check(p.source == null || source == null || p.source === source, 'source conflicts with props.source');
  p.source ??= source;
  check(typeof p.unit === 'string' && p.unit.trim() && p.unit.length <= 60, 'unit names the measure and scale, up to 60 characters');
  check(Array.isArray(p.series) && p.series.length >= 2 && p.series.length <= 9, 'series needs 2–9 panels');
  utcDay(p.asOf);
  // Every panel is validated as a one-series plot on the shared axes.
  p.panels = p.series.map(s => plotSpec({ title: p.title, x: p.x, y: p.y, series: [s], asOf: p.asOf, source: p.source, ...(p.motion !== undefined ? { motion: p.motion } : {}) }));
  const ids = new Set(p.series.map(s => s.id));
  check(ids.size === p.series.length, 'series ids must be unique');
  check(p.highlight == null || ids.has(p.highlight), 'highlight must name a series id');
  p.x = p.panels[0].x; p.y = p.panels[0].y; p.motion = p.panels[0].motion;
  return p;
}

export function multiplesElements(p, frame) {
  const { width, height } = frame, L = plotLayout(frame), tall = L.shape !== 'landscape', n = p.panels.length;
  const shift = titleShift(p.title, L, width - 2 * L.margin);
  const title = titleText(p.title, L, width - 2 * L.margin); title.id = 'multiples-title';
  const elements = [title,
    { id: 'multiples-unit', type: 'text', text: p.unit + (p.y.type === 'log' ? ' · log scale' : ''), x: L.margin, y: L.keyY + shift, size: L.keyType, fill: 'muted', font: 'semibold', fit: width - 2 * L.margin, ...show }];
  const cols = tall ? 2 : n <= 4 ? n : 3, rows = Math.ceil(n / cols);
  const font = L.type, gridTop = L.top + shift - font * .6, gridBottom = L.bottom + font * .8;
  const tickW = width * (tall ? .085 : .045), gapX = width * (tall ? .05 : .03), gapY = font * 3.4;
  const panelW = (width - 2 * L.margin - font * .6 - tickW - gapX * (cols - 1)) / cols, panelH = (gridBottom - gridTop - gapY * (rows - 1) - font * 1.6) / rows;
  check(panelH >= font * 4 && panelW >= font * 6, 'too many panels for this frame; use fewer series');
  const end = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration;
  const time = x => p.motion === 'none' ? 0 : p.motion.at + p.motion.duration * axisPosition(x, p.x);
  const arrive = at => at === 0 ? show : { at, enter: 'fade', dur: 0.3 };
  const stroke = width * (tall ? .006 : .0032);
  for (const [k, panel] of p.panels.entries()) {
    const s = panel.series[0], col = k % cols, row = Math.floor(k / cols);
    const left = L.margin + tickW + col * (panelW + gapX), top = gridTop + font * 1.6 + row * (panelH + gapY), bottom = top + panelH, right = left + panelW;
    const px = x => left + axisPosition(x, p.x) * (right - left), py = y => bottom - axisPosition(y, p.y) * (bottom - top);
    const hot = p.highlight === s.id, dim = p.highlight != null && !hot, color = hot ? 'accent2' : 'accent';
    const id = `multiples-${s.id}`;
    // Shared scale: ticks on the outer edges only, light grid in every panel.
    for (const [i, y] of [p.y.ticks[0], p.y.ticks.at(-1)].entries()) {
      elements.push({ id: `${id}-grid-${i}`, type: 'line', x1: left, y1: py(y), x2: right, y2: py(y), stroke: 'line', width: 1.25, ...show });
      if (col === 0) elements.push({ id: `${id}-tick-${i}`, type: 'text', text: axisLabel(y, p.y), x: left - font * .5, y: py(y) + font * .35, size: font * .9, fill: 'muted', font: 'figures', anchor: 'end', fit: tickW - font * .3, ...show });
    }
    if (p.y.domain[0] < 0 && p.y.domain[1] > 0) elements.push({ id: `${id}-zero`, type: 'line', x1: left, y1: py(0), x2: right, y2: py(0), stroke: 'muted', width: 1.5, ...show });
    if (row === rows - 1 || k + cols >= n)
      for (const [i, x] of [p.x.ticks[0], p.x.ticks.at(-1)].entries())
        elements.push({ id: `${id}-x-${i}`, type: 'text', text: axisLabel(x, p.x), x: i ? right : left, y: bottom + font * 1.45, size: font * .9, fill: 'muted', font: 'figures', anchor: i ? 'end' : 'start', ...show });
    elements.push({ id: `${id}-label`, type: 'text', text: s.label, x: left, y: top - font * .6, size: font * 1.05, fill: hot ? 'accent2' : dim ? 'muted' : 'ink', font: 'semibold', fit: panelW * .66, ...show });
    let last = null;
    for (const [i, v] of s.values.entries()) {
      if (v.y === null) { last = null; continue; }
      if (last) elements.push({ id: `${id}-segment-${i}`, type: 'line', x1: px(last.x), y1: py(last.y), x2: px(v.x), y2: py(v.y), stroke: dim ? 'muted' : color, width: stroke, cap: 'round',
        ...(p.motion === 'none' ? show : { at: time(last.x), dur: time(v.x) - time(last.x), enter: 'draw', drawEase: 'linear' }) });
      last = v;
    }
    const terminal = s.values.findLast(v => v.y !== null);
    elements.push({ id: `${id}-end`, type: 'circle', cx: px(terminal.x), cy: py(terminal.y), r: stroke * 1.8, fill: dim ? 'muted' : color, ...arrive(time(terminal.x)) },
      { id: `${id}-value`, type: 'text', text: axisLabel(terminal.y, p.y), x: right, y: top - font * .6, size: font * 1.05, fill: hot ? 'accent2' : dim ? 'muted' : 'ink', font: 'figures', anchor: 'end', fit: panelW * .32, ...arrive(end) });
  }
  return elements;
}

export function expandMultiplesProps(input, frame) {
  if (input?.multiples == null) return input;
  const { multiples, ...rest } = structuredClone(input);
  for (const key of ['plot', 'bars', 'stat', 'distribution', 'kpi', 'teaching', 'chart', 'sketch', 'plates', 'world', 'dolly', 'focus', 'view', 'viewFrom', 'viewTall', 'viewDrift', 'title'])
    check(rest[key] == null, `cannot combine multiples with ${key}`);
  const p = multiplesSpec(multiples, rest.source);
  const end = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration;
  if (frame.duration != null) check(frame.duration >= end + 2, 'beat needs two seconds after the panels settle');
  const elements = multiplesElements(p, frame);
  if (frame.beatId) for (const el of elements) el.id = `${frame.beatId}-${el.id}`;
  return { ...rest, sourceSize: Math.max(32, plotLayout(frame).type * .95), source: `${p.source} · ${p.asOf}`, view: [0, 0, frame.width, frame.height], elements: [...elements, ...(rest.elements ?? [])] };
}
