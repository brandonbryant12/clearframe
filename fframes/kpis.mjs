// Dimensional KPI pictures compiled from literal data into existing native primitives.
// Front faces encode values. Decorative depth is constant and never changes the scale.
const forms = ['pedestal', 'comparison', 'rail', 'seesaw', 'stack'];
const presets = ['none', 'reveal', 'stagger', 'emphasis'];
const colors = ['accent', 'accent2', 'muted', 'positive'];
const show = { at: 0, enter: 'none' };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const check = (ok, message) => { if (!ok) throw new Error(`kpi: ${message}`); };
const text = (value, x, y, size, extra = {}) => ({ type: 'text', text: value, x, y, size, font: 'display', fill: 'ink', ...show, ...extra });
const rect = (id, x, y, w, h, fill, extra = {}) => ({ type: 'rect', id, x, y, w, h, fill, ...show, ...extra });
const poly = (id, points, fill, extra = {}) => ({ type: 'poly', id, points, fill, ...show, ...extra });
const line = (id, x1, y1, x2, y2, extra = {}) => ({ type: 'line', id, x1, y1, x2, y2, stroke: 'muted', width: 2, ...show, ...extra });
const cleanText = (value, key, max, optional = false) => {
  if (value == null && optional) return '';
  check(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `${key} must be nonempty text up to ${max} characters`);
  return value;
};
function motionSpec(input, form) {
  const out = typeof input === 'string' ? { preset: input } : input == null ? { preset: 'reveal' } : { ...input };
  check(input == null || typeof input === 'string' || (typeof input === 'object' && !Array.isArray(input)), 'motion must be a preset or an object');
  for (const key of Object.keys(out)) check(['preset', 'duration', 'stagger'].includes(key), `unknown motion.${key}`);
  check(presets.includes(out.preset), `motion.preset must be ${presets.join(', ')}`);
  check(out.preset !== 'stagger' || ['comparison', 'stack'].includes(form), 'stagger motion is for comparisons and stacks');
  const duration = out.duration ?? (out.preset === 'none' ? 0 : 0.9);
  check(finite(duration) && (out.preset === 'none' ? duration === 0 : duration >= 0.2 && duration <= 2), 'motion.duration must be 0 for none, or 0.2–2 seconds');
  const stagger = out.stagger ?? (out.preset === 'stagger' ? 0.18 : 0);
  check(finite(stagger) && stagger >= 0 && stagger <= 0.6, 'motion.stagger must be 0–0.6 seconds');
  check(out.preset === 'stagger' || stagger === 0, 'motion.stagger only applies to stagger');
  return { preset: out.preset, duration, stagger };
}

export function kpiSpec(input, source) {
  check(input && typeof input === 'object' && !Array.isArray(input), 'must be an object');
  const allowed = ['form', 'label', 'unit', 'value', 'values', 'total', 'domain', 'prefix', 'suffix', 'decimals', 'motion', 'focus', 'source'];
  for (const key of Object.keys(input)) check(allowed.includes(key), `unknown field ${key}`);
  const p = structuredClone(input);
  check(forms.includes(p.form), `form must be ${forms.join(', ')}`);
  p.label = cleanText(p.label, 'label', 70);
  p.unit = cleanText(p.unit, 'unit', 24, true);
  for (const key of ['prefix', 'suffix']) {
    if (p[key] == null) p[key] = '';
    check(typeof p[key] === 'string' && p[key].length <= 8, `${key} must be text up to 8 characters`);
  }
  p.decimals ??= 0;
  check(Number.isInteger(p.decimals) && p.decimals >= 0 && p.decimals <= 3, 'decimals must be an integer from 0 to 3');
  if (p.source != null && source != null) check(p.source === source, 'source conflicts with props.source');
  p.source = cleanText(p.source ?? source, 'source', 160);
  p.motion = motionSpec(p.motion, p.form);
  if (['comparison', 'seesaw', 'stack'].includes(p.form)) {
    check(p.value == null, `${p.form} uses values`);
    const count = p.form === 'seesaw' ? [2, 2] : [2, 4];
    check(Array.isArray(p.values) && p.values.length >= count[0] && p.values.length <= count[1], `${p.form} needs ${count[0] === count[1] ? 'exactly 2' : '2–4'} values`);
    const labels = new Set();
    for (const [i, row] of p.values.entries()) {
      check(row && typeof row === 'object' && !Array.isArray(row), `values[${i}] must be an object`);
      for (const key of Object.keys(row)) check(['label', 'value'].includes(key), `unknown values[${i}].${key}`);
      row.label = cleanText(row.label, `values[${i}].label`, 28);
      check(!labels.has(row.label), 'comparison labels must be distinct'); labels.add(row.label);
      check(finite(row.value) && row.value >= 0, `values[${i}].value must be a finite nonnegative number`);
    }
    if (p.form === 'comparison') {
      check(p.total == null, 'comparison uses domain, not total');
      p.domain ??= [0, Math.max(1, ...p.values.map(row => row.value))];
      check(Array.isArray(p.domain) && p.domain.length === 2 && p.domain[0] === 0 && finite(p.domain[1]) && p.domain[1] > 0, 'domain must be [0, positive maximum]');
      check(p.values.every(row => row.value <= p.domain[1]), 'a value is outside the shared domain');
      p.focus ??= p.values.length - 1;
      check(Number.isInteger(p.focus) && p.focus >= 0 && p.focus < p.values.length, 'focus must be a valid value index');
    } else {
      p.unit = cleanText(p.unit, 'unit', 24);
      check(p.domain == null && p.focus == null, `${p.form} does not use domain or focus`);
      if (p.form === 'stack') {
        check(finite(p.total) && p.total > 0, 'stack needs an explicit finite positive total');
        const total = p.values.reduce((sum, row) => sum + row.value, 0);
        check(finite(total) && total - p.total <= Number.EPSILON * Math.max(total, p.total) * 8, 'stack contributions cannot exceed the explicit total');
      } else check(p.total == null, 'seesaw compares two values without a total');
    }
  } else {
    check(p.values == null && p.domain == null && p.focus == null, `${p.form} uses one value${p.form === 'rail' ? ' and total' : ''}`);
    check(finite(p.value) && (p.form === 'pedestal' || p.value >= 0), `value must be a finite${p.form === 'pedestal' ? '' : ' nonnegative'} number`);
    if (p.form === 'rail') {
      check(finite(p.total) && p.total > 0, 'total must be a finite positive number');
      check(p.value <= p.total, 'value cannot exceed total; use an explicit comparison for above-target results');
    } else check(p.total == null, 'pedestal does not encode a total');
  }
  return p;
}

const number = (value, p) => `${p.prefix}${value.toFixed(p.decimals)}${p.suffix}`;
// A qualitative metaphor. Normalize first so even very large finite inputs stay finite.
export function seesawAngle(values) {
  const [a, b] = values.map(row => row.value), max = Math.max(a, b);
  return max === 0 ? 0 : 12 * ((b / max - a / max) / (a / max + b / max));
}
const reveal = (p, index = 0) => {
  const animated = ['reveal', 'stagger'].includes(p.motion.preset);
  const delay = animated ? 0.15 + index * p.motion.stagger : 0;
  return { animated, delay, end: animated ? delay + p.motion.duration : 0 };
};
const arrival = end => end > 0 ? { at: end, enter: 'fade', dur: 0.18 } : show;
const pulse = duration => [{ at: 0, dur: 0, opacity: 0.15 }, { at: 0.25, dur: duration / 2, opacity: 0.7, ease: 'inOut' }, { at: 0.25 + duration / 2, dur: duration / 2, opacity: 0.15, ease: 'inOut' }];
function faceGroup(id, face, origin, axis, p, index = 0) {
  const r = reveal(p, index);
  return { type: 'group', id, origin, children: [face], ...show,
    ...(r.animated ? { keys: [{ at: 0, dur: 0, [axis]: 0 }, { at: r.delay, dur: p.motion.duration, [axis]: 1, ease: 'inOut' }] } : {}) };
}
function extrusion(id, x, y, w, h, depth, color, at = 0) {
  return [
    poly(`${id}-side`, [[x + w, y], [x + w + depth, y - depth], [x + w + depth, y + h - depth], [x + w, y + h]], 'ink', { opacity: 0.24, ...arrival(at) }),
    poly(`${id}-top`, [[x, y], [x + depth, y - depth], [x + w + depth, y - depth], [x + w, y]], color, { opacity: 0.65, ...arrival(at) }),
  ];
}

/** Return only native geometry. width/height are final frame coordinates, not render scale. */
export function kpiElements(spec, { width = 1920, height = 1080 } = {}) {
  const p = spec, tall = width <= height * 1.1, x = width * 0.12, w = width * 0.76,
    u = Math.min(width, height), font = u * 0.066, depth = u * 0.023,
    top = height * (tall ? 0.36 : 0.38), bottom = height * 0.79, h = bottom - top;
  const elements = [
    text(p.label, x, height * 0.195, font, { fit: w, id: 'kpi-heading' }),
    ...(p.unit ? [text(p.unit, x, height * 0.267, u * 0.032, { fill: 'muted', font: 'mono', fit: w, id: 'kpi-unit' })] : []),
  ];
  if (p.form === 'pedestal') {
    const pw = w * 0.72, px = x + (w - pw) / 2 - depth / 2, py = height * 0.67, ph = height * 0.068, d = depth * 2.3;
    const art = [...extrusion('kpi-pedestal', px, py, pw, ph, d, 'accent2'), rect('kpi-pedestal-face', px, py, pw, ph, 'surface')];
    elements.push({ type: 'group', id: 'kpi-decorative-plinth', children: art, ...show,
      ...(p.motion.preset === 'reveal' ? { keys: [{ at: 0, dur: 0, y: u * 0.018, opacity: 0 }, { at: 0.1, dur: p.motion.duration, y: 0, opacity: 1, ease: 'out' }] } : {}) });
    elements.push(text(number(p.value, p), width / 2, py - u * 0.095, u * 0.2, { anchor: 'middle', fit: w, font: 'figures', id: 'kpi-value-label', ...(p.motion.preset === 'reveal' ? { at: 0.1, enter: 'fade', dur: p.motion.duration } : {}) }));
    if (p.motion.preset === 'emphasis') elements.push(line('kpi-emphasis', px, py + ph + depth, px + pw, py + ph + depth, { stroke: 'accent', width: 5, keys: pulse(p.motion.duration) }));
  } else if (p.form === 'comparison') {
    const axis = x + w * 0.1, plotW = w * 0.86, plotH = h * 0.85, baseline = bottom,
      cell = plotW / p.values.length, barW = cell * (tall ? 0.48 : 0.44), max = p.domain[1];
    for (const fraction of [0, 0.5, 1]) {
      const y = baseline - plotH * fraction;
      elements.push(line(`kpi-grid-${fraction}`, axis, y, axis + plotW, y, { opacity: fraction === 0 ? 0.7 : 0.2 }),
        text((max * fraction).toFixed(p.decimals), axis - u * 0.025, y + u * 0.01, u * 0.028, { anchor: 'end', fill: 'muted', font: 'mono', fit: w * 0.12 }));
    }
    p.values.forEach((row, index) => {
      const bx = axis + cell * (index + 0.5) - barW / 2, bh = plotH * row.value / max, by = baseline - bh, color = colors[index], r = reveal(p, index);
      if (row.value > 0) {
        elements.push(faceGroup(`kpi-value-group-${index}`, rect(`kpi-value-face-${index}`, bx, by, barW, bh, color), [bx, baseline], 'scaleY', p, index));
        elements.push(...extrusion(`kpi-depth-${index}`, bx, by, barW, bh, depth, color, r.end));
      }
      elements.push(text(number(row.value, p), bx + barW / 2, by - depth - u * 0.035, u * (tall ? 0.055 : 0.06), { anchor: 'middle', font: 'figures', fit: cell * 0.92, id: `kpi-value-label-${index}`, ...arrival(r.end) }),
        text(row.label, bx + barW / 2, baseline + u * 0.052, u * 0.032, { anchor: 'middle', fit: cell * 0.94, id: `kpi-category-${index}` }));
      if (p.motion.preset === 'emphasis' && index === p.focus) elements.push(rect('kpi-emphasis', bx - depth * 0.35, by - depth * 1.45, barW + depth * 1.7, Math.max(bh, 1) + depth * 1.8, 'none', { stroke: color, width: 3, keys: pulse(p.motion.duration) }));
    });
  } else if (p.form === 'seesaw') {
    const cx = width * 0.5, cy = height * (tall ? 0.66 : 0.70), beamW = w * 0.9, beamH = u * 0.025,
      weightW = Math.min(u * 0.16, beamW * 0.2), weightH = u * 0.09,
      centers = [cx - beamW * 0.33, cx + beamW * 0.33], angle = seesawAngle(p.values),
      artwork = [];
    elements.push(poly('kpi-fulcrum-side', [[cx, cy + beamH], [cx + u * 0.1, cy + u * 0.17], [cx + depth, cy + u * 0.17 - depth], [cx + depth, cy - depth]], 'ink', { opacity: 0.25 }),
      poly('kpi-fulcrum-front', [[cx, cy + beamH], [cx - u * 0.09, cy + u * 0.17], [cx + u * 0.09, cy + u * 0.17]], 'surface'));
    artwork.push(...extrusion('kpi-beam-depth', cx - beamW / 2, cy, beamW, beamH, depth, 'surface'), rect('kpi-beam-face', cx - beamW / 2, cy, beamW, beamH, 'surface'));
    for (const [i, bx] of centers.entries()) artwork.push(...extrusion(`kpi-weight-${i}`, bx - weightW / 2, cy - weightH, weightW, weightH, depth, colors[i]), rect(`kpi-weight-face-${i}`, bx - weightW / 2, cy - weightH, weightW, weightH, colors[i]));
    elements.push({ type: 'group', id: 'kpi-balance-beam', origin: [cx, cy], children: artwork, ...show,
      ...(p.motion.preset === 'reveal' ? { keys: [{ at: 0, dur: 0, rotate: 0 }, { at: 0.15, dur: p.motion.duration, rotate: angle, ease: 'inOut' }] } : { rotate: angle }) });
    p.values.forEach((row, i) => {
      elements.push(text(number(row.value, p), centers[i], height * 0.41, u * 0.1, { anchor: 'middle', fit: beamW * 0.43, font: 'figures', id: `kpi-value-label-${i}` }),
        text(row.label, centers[i], height * 0.48, u * 0.035, { anchor: 'middle', fit: beamW * 0.43, id: `kpi-category-${i}` }));
    });
    if (p.motion.preset === 'emphasis') elements.push(line('kpi-emphasis', x + w * 0.25, height * 0.87, x + w * 0.75, height * 0.87, { stroke: 'accent', width: 4, keys: pulse(p.motion.duration) }));
  } else if (p.form === 'stack') {
    const sy = height * (tall ? 0.43 : 0.44), sh = u * 0.105;
    elements.push(...extrusion('kpi-stack-track', x, sy, w, sh, depth, 'surface'), rect('kpi-stack-track-face', x, sy, w, sh, 'surface'));
    let offset = 0, finalArrival = 0;
    p.values.forEach((row, i) => {
      const sw = w * row.value / p.total, sx = x + offset, color = colors[i],
        staged = p.motion.preset === 'stagger', r = reveal(p, i),
        delay = staged ? 0.15 + i * (p.motion.duration + p.motion.stagger) : r.delay,
        end = r.animated ? delay + p.motion.duration : 0,
        group = faceGroup(`kpi-stack-group-${i}`, rect(`kpi-stack-face-${i}`, sx, sy, sw, sh, color), [sx, sy], 'scaleX', p, i);
      finalArrival = Math.max(finalArrival, end);
      if (group.keys) group.keys[1].at = delay;
      if (row.value > 0) elements.push(group, poly(`kpi-stack-top-${i}`, [[sx, sy], [sx + depth, sy - depth], [sx + sw + depth, sy - depth], [sx + sw, sy]], color, { opacity: 0.65, ...arrival(end) }));
      const col = tall ? 0 : i % 2, rowIndex = tall ? i : Math.floor(i / 2),
        lx = x + col * w * 0.51, ly = height * (tall ? 0.62 : 0.69) + rowIndex * u * (tall ? 0.088 : 0.092), lw = w * (tall ? 1 : 0.47);
      elements.push(rect(`kpi-stack-key-${i}`, lx, ly - u * 0.025, u * 0.019, u * 0.019, color, arrival(end)),
        text(`${row.label}: ${number(row.value, p)}`, lx + u * 0.034, ly, u * 0.035, { fit: lw - u * 0.04, id: `kpi-value-label-${i}`, ...arrival(end) }));
      offset += sw;
    });
    elements.push(text('0', x, sy + sh + u * 0.055, u * 0.028, { font: 'mono', fill: 'muted' }),
      text(`Total ${number(p.total, p)}`, x + w, sy + sh + u * 0.055, u * 0.028, { anchor: 'end', font: 'mono', fill: 'muted', fit: w * 0.55 }));
    const remainder = p.total - p.values.reduce((sum, row) => sum + row.value, 0);
    if (remainder > Number.EPSILON * p.total * 8) elements.push(text(`Remainder ${number(remainder, p)}`, x, height * 0.865, u * 0.028, { fill: 'muted', font: 'mono', fit: w, id: 'kpi-stack-remainder', ...arrival(finalArrival) }));
    if (p.motion.preset === 'emphasis') elements.push(rect('kpi-emphasis', x - depth * 0.4, sy - depth * 1.4, w + depth * 1.8, sh + depth * 1.8, 'none', { stroke: 'accent', width: 3, keys: pulse(p.motion.duration) }));
  } else {
    const ry = top + h * 0.44, rh = Math.min(u * 0.095, h * 0.25), fillW = w * p.value / p.total, r = reveal(p);
    elements.push(...extrusion('kpi-track-depth', x, ry, w, rh, depth, 'surface'), rect('kpi-track-face', x, ry, w, rh, 'surface'));
    if (p.value > 0) {
      elements.push(faceGroup('kpi-value-group-0', rect('kpi-value-face-0', x, ry, fillW, rh, 'accent'), [x, ry], 'scaleX', p));
      elements.push(poly('kpi-fill-top', [[x, ry], [x + depth, ry - depth], [x + fillW + depth, ry - depth], [x + fillW, ry]], 'accent', { opacity: 0.65, ...arrival(r.end) }));
    }
    elements.push(text(`${number(p.value, p)} / ${number(p.total, p)}`, x, ry - u * 0.085, u * 0.12, { font: 'figures', fit: w, id: 'kpi-value-label-0', ...arrival(r.end) }),
      line('kpi-zero-tick', x, ry + rh + u * 0.025, x, ry + rh + u * 0.045),
      line('kpi-total-tick', x + w, ry + rh + u * 0.025, x + w, ry + rh + u * 0.045),
      text('0', x, ry + rh + u * 0.095, u * 0.032, { font: 'mono', fill: 'muted' }),
      text(number(p.total, p), x + w, ry + rh + u * 0.095, u * 0.032, { font: 'mono', anchor: 'end', fill: 'muted' }));
    if (p.motion.preset === 'emphasis') elements.push(rect('kpi-emphasis', x - depth * 0.4, ry - depth * 1.4, w + depth * 1.8, rh + depth * 1.8, 'none', { stroke: 'accent', width: 3, keys: pulse(p.motion.duration) }));
  }
  return elements;
}

export function expandKPIProps(input, frame) {
  if (input?.kpi == null) return input;
  const { kpi, ...rest } = structuredClone(input);
  check(rest.plot == null, 'cannot combine kpi with plot');
  check(rest.teaching == null && rest.chart == null && rest.sketch == null && rest.plates == null, 'cannot combine shorthand teaching, chart, sketch or plates in the same canvas');
  const p = kpiSpec(kpi, rest.source);
  if (frame.duration != null && ['reveal', 'stagger'].includes(p.motion.preset)) {
    const count = p.values?.length ?? 1, delay = p.form === 'stack' && p.motion.preset === 'stagger'
      ? (count - 1) * (p.motion.duration + p.motion.stagger) : (count - 1) * p.motion.stagger;
    check(frame.duration >= 0.15 + delay + p.motion.duration + 1.18, 'beat needs at least one second after the final reveal settles');
  }
  const drawn = kpiElements(p, frame);
  // A KPI reveal is self-contained. Shared ids would otherwise request implicit morphs
  // between different metrics/forms, including their unkeyed full-value geometry.
  if (frame.beatId) {
    const scope = list => list.forEach(el => { if (el.id) el.id = `${frame.beatId}-${el.id}`; if (el.children) scope(el.children); });
    scope(drawn);
  }
  return { ...rest, source: p.source, view: [0, 0, frame.width, frame.height], elements: [...drawn, ...(rest.elements ?? [])] };
}
