// Explicit scales -> existing native geometry. Data never passes through a raster illustration.
import { plotSpec, axisPosition, axisLabel } from './plot-data.mjs';
const check = (ok, message) => { if (!ok) throw new Error(`plot: ${message}`); };
const show = { at: 0, enter: 'none' };
const line = (id, x1, y1, x2, y2, extra = {}) => ({ id, type: 'line', x1, y1, x2, y2, stroke: 'line', width: 1.5, ...show, ...extra });
const text = (id, value, x, y, size, extra = {}) => ({ id, type: 'text', text: value, x, y, size, fill: 'ink', font: 'text', ...show, ...extra });
const colors = ['accent', 'accent2', 'ink', 'muted'];
// Rough advance width of tabular figures and UI text, for spacing checks only.
const textWidth = (value, size) => String(value).length * size * 0.56;
// Dots read as observations on short series; on long ones they turn a line into beads.
const DOT_LIMIT = 16;

/** Frame geometry. Landscape keeps the plot in the middle half of the frame; vertical and square
 * frames stack title, key and plot. Every size is relative to the frame, never fixed pixels. */
export function plotLayout({ width, height }, { xLabel = false } = {}) {
  check(Number.isFinite(width) && Number.isFinite(height) && width >= 640 && height >= 640, 'frame must be at least 640×640');
  const u = Math.min(width, height), aspect = width / height;
  const shape = aspect > 1.2 ? 'landscape' : aspect < 0.8 ? 'vertical' : 'square';
  const P = {
    landscape: { margin: .065, title: .034, titleY: .135, key: .0175, keyY: .215, type: .0145, top: .31, bottom: .77, yReserve: .052, endReserve: .115 },
    square: { margin: .10, title: .052, titleY: .13, key: .029, keyY: .215, type: .025, top: .32, bottom: .77, yReserve: .11, endReserve: .17 },
    vertical: { margin: .10, title: .062, titleY: .12, key: .034, keyY: .19, type: .029, top: .30, bottom: .78, yReserve: .125, endReserve: .19 },
  }[shape];
  const margin = width * P.margin, type = Math.max(width * P.type, 20);
  const left = margin + width * P.yReserve, right = width - margin - width * P.endReserve;
  return { u, shape, tall: shape !== 'landscape', margin, type, keyType: width * P.key, titleType: width * P.title,
    titleY: height * P.titleY, keyY: height * P.keyY, left, right, top: height * P.top, bottom: height * (P.bottom - (xLabel ? .045 : 0)) };
}

/** Labels that would print over each other are an authoring error, not something to discover in review. */
function checkSpacing(p, L, px, py) {
  const yPos = p.y.ticks.map(py);
  for (let i = 1; i < yPos.length; i++)
    check(Math.abs(yPos[i] - yPos[i - 1]) >= L.type * 1.35,
      `y ticks ${axisLabel(p.y.ticks[i - 1], p.y)} and ${axisLabel(p.y.ticks[i], p.y)} would overlap; choose ticks further apart`);
  const spans = p.x.ticks.map((t, i) => {
    const w = textWidth(axisLabel(t, p.x), L.type), x = px(t);
    const a = i === 0 ? x : i === p.x.ticks.length - 1 ? x - w : x - w / 2;
    return [a, a + w];
  });
  for (let i = 1; i < spans.length; i++)
    check(spans[i][0] - spans[i - 1][1] >= L.type * 0.6,
      `x ticks ${axisLabel(p.x.ticks[i - 1], p.x)} and ${axisLabel(p.x.ticks[i], p.x)} would overlap; choose ticks further apart`);
}

/** Terminal value labels sit beside the line ends; push neighbours apart so they never collide. */
function endLabelPositions(targets, gap, top, bottom) {
  const order = targets.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++) order[k].y = Math.max(order[k].y, order[k - 1].y + gap);
  const overflow = order.length ? order.at(-1).y - bottom : 0;
  if (overflow > 0) for (const o of order) o.y -= overflow;
  for (let k = order.length - 2; k >= 0; k--) order[k].y = Math.min(order[k].y, order[k + 1].y - gap);
  check(!order.length || order[0].y >= top - gap, 'too many series end near the same value to label them');
  const out = []; for (const o of order) out[o.i] = o.y; return out;
}


/** Landscape titles stay on one line; tall frames wrap to two lines and move the key down to make room. */
export const titleLines = (title, L, width) => L.shape === 'landscape' ? 1 : textWidth(title, L.titleType * .93) > width ? 2 : 1;
export const titleShift = (title, L, width) => (titleLines(title, L, width) - 1) * L.titleType * 1.2;
export function titleText(title, L, width) {
  if (titleLines(title, L, width) === 1) return text('plot-title', title, L.margin, L.titleY, L.titleType, { fit: width, font: 'display' });
  return text('plot-title', title, L.margin, L.titleY, L.titleType, { width, height: L.titleType * 2.5, font: 'display' });
}

export function plotElements(p, frame) {
  const { width, height } = frame, L = plotLayout(frame, { xLabel: p.x.type !== 'date' }), { u, left, right, bottom } = L;
  // Extra key rows and a wrapped title push the plot down instead of crowding the unit label.
  const keyRows = Math.ceil(p.series.length / (L.shape === 'landscape' ? p.series.length : 2));
  const top = L.top + (keyRows - 1) * L.keyType * 1.6 + titleShift(p.title, L, width - 2 * L.margin);
  check(bottom - top >= (bottom - L.top) * 0.7, 'too many series or too long a title for this frame');
  const px = x => left + axisPosition(x, p.x) * (right - left);
  const py = y => bottom - axisPosition(y, p.y) * (bottom - top);
  checkSpacing(p, L, px, py);
  const time = x => p.motion === 'none' ? 0 : p.motion.at + p.motion.duration * axisPosition(x, p.x);
  const end = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration;
  const begin = p.motion === 'none' ? 0 : p.motion.at;
  const arrive = at => at === 0 ? show : { at, enter: 'fade', dur: 0.35 };
  const font = L.type, contentWidth = width - 2 * L.margin;
  const elements = [
    titleText(p.title, L, contentWidth),
    text('plot-unit', p.y.label + (p.y.type === 'log' ? ' · log scale' : ''), left, top - font * 1.1, font,
      { fill: 'muted', fit: right - left }),
  ];
  if (p.x.type !== 'date')
    elements.push(text('plot-x-label', p.x.label, (left + right) / 2, bottom + font * 3.3, font, { anchor: 'middle', fill: 'muted', fit: right - left }));
  // Key: one row in landscape, two columns otherwise. Labels only; values appear at the line ends.
  const perRow = L.shape === 'landscape' ? p.series.length : Math.min(2, p.series.length);
  const column = contentWidth / Math.max(perRow, 1), K = L.keyType;
  for (const [i, s] of p.series.entries()) {
    const x = L.margin + (i % perRow) * column, y = L.keyY + titleShift(p.title, L, contentWidth) + Math.floor(i / perRow) * K * 1.6;
    elements.push(line(`plot-${s.id}-key`, x, y - K * .32, x + K * 1.1, y - K * .32, { stroke: colors[i], width: K * .16, cap: 'round' }),
      text(`plot-${s.id}-label`, s.label, x + K * 1.45, y, K, { font: 'semibold', fill: colors[i], fit: column - K * 1.9 }));
  }
  // Regime bands (recessions, policy cycles) sit under the grid and fade in before the line draws.
  for (const [i, b] of (p.bands ?? []).entries()) {
    const x1 = px(b.from), x2 = px(b.to);
    elements.push({ id: `plot-band-${i}`, type: 'rect', x: x1, y: top, w: x2 - x1, h: bottom - top, fill: 'surface', opacity: 0.85, ...arrive(begin * 0.6) });
    // A label shows only where it clears the next band; narrow neighbouring bands stay unlabelled.
    const room = (i + 1 < p.bands.length ? px(p.bands[i + 1].from) : right) - x1 - font * .7;
    if (b.label && textWidth(b.label, font * 1.2) <= room) elements.push(text(`plot-band-${i}-label`, b.label, x1 + font * .35, top + font * 1.4, font * 1.2,
      { fill: 'muted', font: 'semibold', fit: Math.max(x2 - x1 - font * .5, font * 4), ...arrive(begin * 0.6) }));
  }
  for (const [i, y] of p.y.ticks.entries()) {
    elements.push(line(`plot-y-grid-${i}`, left, py(y), right, py(y), { stroke: y === 0 && p.y.type !== 'log' ? 'muted' : 'line', width: y === 0 ? 2 : 1.25 }),
      text(`plot-y-tick-${i}`, axisLabel(y, p.y), left - font * .7, py(y) + font * .35, font, { anchor: 'end', font: 'figures', fill: 'muted', fit: left - L.margin }));
  }
  for (const [i, x] of p.x.ticks.entries()) {
    elements.push(line(`plot-x-tick-${i}`, px(x), bottom, px(x), bottom + font * .5, { stroke: 'muted' }),
      text(`plot-x-value-${i}`, axisLabel(x, p.x), px(x), bottom + font * 1.75, font,
        { anchor: i === 0 ? 'start' : i === p.x.ticks.length - 1 ? 'end' : 'middle', font: 'figures', fill: 'muted' }));
  }
  const strokeWidth = u * (L.shape === 'landscape' ? .0042 : .0062);
  const terminals = [];
  for (const [seriesIndex, s] of p.series.entries()) {
    const color = colors[seriesIndex], dots = s.values.filter(v => v.y !== null).length <= DOT_LIMIT;
    // Optional soft area under the first series: one closed polygon per unbroken run.
    if (p.area && seriesIndex === 0) {
      let run = [];
      const flush = k => {
        if (run.length > 1) elements.push({ id: `plot-${s.id}-area-${k}`, type: 'poly', closed: true,
          points: [[px(run[0].x), bottom], ...run.map(v => [px(v.x), py(v.y)]), [px(run.at(-1).x), bottom]],
          fill: { gradient: [color, 'bg'], angle: 90, fade: true }, opacity: 0.35, ...arrive(end) });
        run = [];
      };
      s.values.forEach((v, k) => { if (v.y === null) flush(k); else run.push(v); });
      flush('end');
    }
    let last = null;
    for (const [i, v] of s.values.entries()) {
      if (v.y === null) { last = null; continue; }
      const x = px(v.x), y = py(v.y), at = time(v.x);
      if (last) {
        const start = time(last.x), duration = at - start;
        elements.push(line(`plot-${s.id}-segment-${i}`, px(last.x), py(last.y), x, y,
          { stroke: color, width: strokeWidth, cap: 'round', ...(p.motion === 'none' ? show : { at: start, dur: duration, enter: 'draw', drawEase: 'linear' }) }));
      }
      // Dots mark observations on short series, including isolated points on either side of a gap.
      if (dots || !last && s.values[i + 1]?.y == null)
        elements.push({ id: `plot-${s.id}-point-${i}`, type: 'circle', cx: x, cy: y, r: strokeWidth * 1.15, fill: color, ...(p.motion === 'none' ? show : { at, enter: 'none' }) });
      last = v;
    }
    const terminal = s.values.findLast(v => v.y !== null);
    terminals.push({ s, color, terminal, x: px(terminal.x), y: py(terminal.y), labelled: axisPosition(terminal.x, p.x) > 0.999 });
  }
  const valueType = font * 1.2;
  // Values label the line ends at the right edge; a series that stops earlier (history before a projection) keeps only its end dot.
  const labelled = terminals.filter(t => t.labelled);
  const placed = endLabelPositions(labelled.map(t => t.y), valueType * 1.25, top, bottom);
  for (const t of terminals)
    elements.push({ id: `plot-${t.s.id}-end`, type: 'circle', cx: t.x, cy: t.y, r: strokeWidth * 1.9, fill: t.color, ...arrive(time(t.terminal.x)) });
  for (const [i, t] of labelled.entries())
    elements.push(text(`plot-${t.s.id}-value`, axisLabel(t.terminal.y, p.y), right + font * .9, placed[i] + valueType * .36, valueType,
      { font: 'figures', fill: t.color, fit: width - L.margin - right - font, ...arrive(time(t.terminal.x)) }));
  if (p.annotation) {
    const a = p.annotation, point = p.series.find(s => s.id === a.seriesId).values.find(v => v.x === a.x);
    const x = px(point.x), y = py(point.y), tx = x + a.dx * (right - left), ty = y + a.dy * (bottom - top);
    check(tx >= left && tx <= right && ty >= top && ty <= bottom, 'annotation offsets must keep the label anchor inside the plot');
    const anchor = a.dx < 0 ? 'end' : 'start', fit = a.dx < 0 ? tx - left : right - tx;
    check(fit >= u * .14, 'annotation needs a wider clear text region');
    const at = arrive(Math.max(time(point.x), begin) + 0.2);
    elements.push(line('plot-annotation-leader', x, y, tx, ty - font * .45, { stroke: 'muted', width: 1.5, ...at }),
      { id: 'plot-annotation-point', type: 'circle', cx: x, cy: y, r: strokeWidth * 2.6, fill: 'none', stroke: 'ink', width: 2, ...at },
      text('plot-annotation-text', a.label, tx, ty, font * 1.1, { anchor, fit, font: 'semibold', ...at }));
  }
  return elements;
}

export function expandPlotProps(input, frame) {
  if (input?.plot == null) return input;
  const { plot, ...rest } = structuredClone(input);
  for (const key of ['kpi','teaching','chart','sketch','plates','world','dolly','focus','view','viewFrom','viewTall','viewDrift','title'])
    check(rest[key] == null, `cannot combine plot with ${key}`);
  const p=plotSpec(plot,rest.source);
  const end=p.motion==='none'?0:p.motion.at+p.motion.duration;
  if (frame.duration!=null) check(frame.duration>=end+2.15,'beat needs two seconds after the final plot labels settle');
  const elements=plotElements(p,frame);
  if (frame.beatId) for (const el of elements) if(el.id)el.id=`${frame.beatId}-${el.id}`;
  // Disclose gaps inside a series; a series that simply starts or ends elsewhere is visible as such.
  const interior=s=>{const i=s.values.findIndex(v=>v.y!==null),j=s.values.findLastIndex(v=>v.y!==null);return s.values.slice(i,j+1).filter(v=>v.y===null).map(v=>v.x);};
  const missing=[...new Set(p.series.flatMap(interior))];
  const note=missing.length?`Gap: ${missing.slice(0,2).join(', ')}${missing.length>2?'…':''}.`:'';
  const L=plotLayout(frame);
  return {...rest,sourceSize:Math.max(32,L.type*.95),source:`${p.source}${note?` ${note}`:''} · ${p.asOf}`,view:[0,0,frame.width,frame.height],elements:[...elements,...(rest.elements??[])]};
}
