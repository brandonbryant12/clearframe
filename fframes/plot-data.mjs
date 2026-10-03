// Quantitative input and scale contract, independent of drawing/layout.
const check = (ok, message) => { if (!ok) throw new Error(`plot: ${message}`); };
const finite = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e12;
const own = (o, keys, name) => {
  check(o && typeof o === 'object' && !Array.isArray(o), `${name} must be an object`);
  for (const k of Object.keys(o)) check(keys.includes(k), `unknown ${name}.${k}`);
};
const text = (v, name, max) => { check(typeof v === 'string' && v.trim() && v.length <= max, `${name} needs text up to ${max} characters`); return v; };

export function utcDay(value) {
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'dates must be YYYY-MM-DD');
  const time = Date.parse(`${value}T00:00:00.000Z`);
  check(Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value, `invalid calendar date ${value}`);
  return time / 86400000;
}

export function axisValue(value, type) {
  if (type === 'date') return utcDay(value);
  check(finite(value), 'axis values must be finite numbers within ±10^12');
  if (type === 'log') check(value > 0, 'log values must be positive');
  return value;
}

/** Pure mapping; no clamping: out-of-domain values must fail at the input boundary. */
export function axisPosition(value, axis) {
  const x = axisValue(value, axis.type), [lo, hi] = axis.domain.map(v => axisValue(v, axis.type));
  check(lo < hi && x >= lo && x <= hi, 'value lies outside an increasing explicit domain');
  return axis.type === 'log' ? (Math.log(x) - Math.log(lo)) / (Math.log(hi) - Math.log(lo)) : (x - lo) / (hi - lo);
}

export function axisLabel(value, axis) {
  if (axis.type === 'date') {
    utcDay(value);
    if (axis.dateFormat === 'year') return value.slice(0, 4);
    if (axis.dateFormat === 'month') return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(value.slice(5, 7)) - 1]} ${value.slice(0, 4)}`;
    return value;
  }
  const amount = Number(value).toFixed(axis.decimals ?? 0).replace(/^-0(?=\.0+$|$)/, '0');
  return `${axis.prefix ?? ''}${amount}${axis.suffix ?? ''}`;
}

function axisSpec(input, name) {
  own(input, ['type', 'label', 'domain', 'ticks', 'decimals', 'prefix', 'suffix', 'dateFormat'], name);
  const a = structuredClone(input);
  check((name === 'x' ? ['linear', 'date'] : ['linear', 'log']).includes(a.type), `${name}.type is unsupported`);
  text(a.label, `${name}.label (including units)`, 45);
  check(Array.isArray(a.domain) && a.domain.length === 2, `${name}.domain needs [min,max]`);
  const domain = a.domain.map(v => axisValue(v, a.type));
  check(domain[0] < domain[1], `${name}.domain must increase`);
  check(Array.isArray(a.ticks) && a.ticks.length >= 2 && a.ticks.length <= 6, `${name}.ticks needs 2–6 explicit values`);
  if (a.type === 'date') {
    check(a.decimals == null && a.prefix == null && a.suffix == null, 'date axes cannot format numeric amounts');
    a.dateFormat ??= 'date';
    check(['date','month','year'].includes(a.dateFormat), 'dateFormat must be date, month or year');
  } else {
    check(a.dateFormat == null, 'numeric axes cannot use dateFormat');
    a.decimals ??= 0;
    check(Number.isInteger(a.decimals) && a.decimals >= 0 && a.decimals <= 6, 'decimals must be 0–6');
    for (const k of ['prefix','suffix']) {
      a[k] ??= '';
      check(typeof a[k] === 'string' && a[k].length <= 8, `${k} must be text up to 8 characters`);
    }
  }
  let prev = -Infinity;
  const labels = new Set();
  for (const tick of a.ticks) {
    const v = axisValue(tick, a.type);
    axisPosition(tick, a);
    check(v > prev, `${name}.ticks must strictly increase`); prev = v;
    if (a.type !== 'date') check(Math.abs(Number(v.toFixed(a.decimals)) - v) <= Number.EPSILON * Math.max(1, Math.abs(v)) * 8,
      `${name}.decimals would mislabel a tick value`);
    const label = axisLabel(tick, a);
    check(!labels.has(label), `${name}.tick labels must remain distinct`); labels.add(label);
  }
  check(axisValue(a.ticks[0], a.type) === domain[0] && axisValue(a.ticks.at(-1), a.type) === domain[1], `${name}.ticks must include both domain endpoints`);
  return a;
}

export function plotSpec(input, source) {
  own(input, ['title','x','y','series','asOf','source','motion','annotation'], 'plot');
  const p = structuredClone(input);
  text(p.title, 'title', 70); utcDay(p.asOf);
  check(p.source == null || source == null || p.source === source, 'source conflicts with props.source');
  p.source = text(p.source ?? source, 'source', 110);
  p.x = axisSpec(p.x, 'x'); p.y = axisSpec(p.y, 'y');
  check(Array.isArray(p.series) && p.series.length >= 1 && p.series.length <= 4, 'series needs 1–4 comparable series');
  const ids = new Set(), labels = new Set(); let total = 0;
  for (const [i, s] of p.series.entries()) {
    own(s, ['id','label','values'], `series[${i}]`);
    check(typeof s.id === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(s.id) && !ids.has(s.id), 'series ids must be unique slugs');
    ids.add(s.id); text(s.label, 'series label', 30);
    check(!labels.has(s.label), 'series labels must be unique'); labels.add(s.label);
    check(Array.isArray(s.values) && s.values.length >= 1, 'each series needs explicit observations');
    total += s.values.length; check(total <= 240, 'at most 240 observations per picture; aggregate explicitly for a film');
    let previous = -Infinity, observed = 0;
    for (const point of s.values) {
      own(point, ['x','y'], 'observation');
      const x = axisValue(point.x, p.x.type); axisPosition(point.x, p.x);
      check(x > previous, 'observations must be strictly ordered without duplicate x values'); previous = x;
      if (point.y !== null) { axisPosition(point.y, p.y); observed++; }
    }
    check(observed > 0, 'an all-missing series has no drawable evidence');
  }
  if (p.motion === undefined) p.motion = { at: 0.5, duration: 3 };
  if (p.motion !== 'none') {
    own(p.motion, ['at','duration'], 'motion');
    check(finite(p.motion.at) && p.motion.at >= 0 && p.motion.at <= 10, 'motion.at must be 0–10 seconds');
    check(finite(p.motion.duration) && p.motion.duration >= 0.2 && p.motion.duration <= 20, 'motion.duration must be 0.2–20 seconds');
  }
  if (p.annotation != null) {
    own(p.annotation, ['seriesId','x','label','dx','dy'], 'annotation');
    text(p.annotation.label, 'annotation.label', 45);
    const s = p.series.find(s => s.id === p.annotation.seriesId);
    check(s?.values.some(v => v.x === p.annotation.x && v.y !== null), 'annotation must point to an actual nonmissing observation');
    for (const k of ['dx','dy']) check(finite(p.annotation[k]) && Math.abs(p.annotation[k]) <= 0.5, `annotation.${k} must be a plot-relative offset in [-0.5,0.5]`);
  }
  return p;
}
