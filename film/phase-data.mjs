// Dated paired observations. Quadrants describe supplied variables; no cycle is fitted.
import {utcDay} from './plot-data.mjs';
export const PHASE_DATA_VERSION = 1;
const check = (ok, message) => { if (!ok) throw Error(`phase trail: ${message}`); };
const dense = a => Array.isArray(a) && Array.from({length:a.length}, (_,i) => Object.hasOwn(a,i)).every(Boolean);
const finite = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e9;
const own = (o, keys, label) => {
  check(o && typeof o === 'object' && !Array.isArray(o), `${label} must be an object`);
  for (const k of Object.keys(o)) check(keys.includes(k), `unknown ${label}.${k}`);
};
const words = (v, label, max) => check(typeof v === 'string' && v.trim() && v.length <= max, `${label} needs text up to ${max} characters`);
function axis(input, name) {
  own(input, ['label','definition','domain','ticks','reference','decimals'], name);
  words(input.label, `${name}.label including units`, 42);
  words(input.definition, `${name}.definition`, 180);
  check(dense(input.domain) && input.domain.length === 2 && input.domain.every(finite) && input.domain[0] < input.domain[1], `${name}.domain must increase within ±1e9`);
  const [lo, hi] = input.domain;
  check(finite(input.reference) && input.reference > lo && input.reference < hi, `${name}.reference must lie strictly inside the domain`);
  check(Number.isInteger(input.decimals) && input.decimals >= 0 && input.decimals <= 6, `${name}.decimals must be 0–6`);
  check(dense(input.ticks) && input.ticks.length >= 3 && input.ticks.length <= 6 && input.ticks[0] === lo && input.ticks.at(-1) === hi && input.ticks.includes(input.reference), `${name}.ticks must include both endpoints and the reference`);
  check(input.ticks.every((v,i) => finite(v) && v >= lo && v <= hi && (!i || v > input.ticks[i-1]) && Number(v.toFixed(input.decimals)) === v), `${name}.ticks must increase and match displayed precision`);
  return structuredClone(input);
}
export function phaseTrail(input) {
  own(input, ['title','source','asOf','x','y','quadrants','points','focusDate','smoothing'], 'input');
  words(input.title, 'title', 80); words(input.source, 'source', 110);
  const asOfDay = utcDay(input.asOf), x = axis(input.x,'x'), y = axis(input.y,'y');
  check(input.smoothing === 'none', 'smoothing must be explicitly none; do not invent intermediate observations');
  own(input.quadrants, ['NE','NW','SW','SE'], 'quadrants');
  for (const key of ['NE','NW','SW','SE']) words(input.quadrants[key], `quadrants.${key}`, 30);
  check(new Set(Object.values(input.quadrants).map(s=>s.split('/').map(row=>row.trim().replace(/\s+/g,' ')).join('/'))).size === 4, 'displayed quadrant labels must be distinct');
  check(dense(input.points) && input.points.length >= 2 && input.points.length <= 120, 'points must contain 2–120 explicit dated rows');
  let previous = -Infinity;
  const points = input.points.map((p,index) => {
    own(p, ['date','x','y'], 'point'); const day = utcDay(p.date);
    check(day > previous && day <= asOfDay, 'dates must strictly increase without duplicates and not exceed asOf'); previous = day;
    for (const [key,a] of [['x',x],['y',y]]) check(p[key] === null || (finite(p[key]) && p[key] >= a.domain[0] && p[key] <= a.domain[1]), `${key} must be explicit null or inside its domain; no clipping`);
    const valid = p.x !== null && p.y !== null, sx = valid ? Math.sign(p.x-x.reference) : null, sy = valid ? Math.sign(p.y-y.reference) : null;
    const quadrant = !valid || sx === 0 || sy === 0 ? null : sy > 0 ? (sx > 0 ? 'NE':'NW') : (sx > 0 ? 'SE':'SW');
    const boundary = !valid || quadrant ? null : sx === 0 && sy === 0 ? 'both-references' : sx === 0 ? 'x-reference' : 'y-reference';
    return {index,date:p.date,day,x:p.x,y:p.y,valid,quadrant,boundary,missing:valid ? [] : ['x','y'].filter(k=>p[k]===null)};
  });
  check(points.some(p=>p.valid), 'at least one complete paired observation is required');
  const focus = points.find(p=>p.date===input.focusDate); check(focus, 'focusDate must be a supplied date');
  const firstDay = points[0].day, lastDay = points.at(-1).day;
  for (const p of points) p.time = (p.day-firstDay)/(lastDay-firstDay);
  const segments = [];
  for (let i=1;i<points.length;i++) if (points[i-1].valid && points[i].valid) segments.push({from:i-1,to:i,fromDate:points[i-1].date,toDate:points[i].date,days:points[i].day-points[i-1].day});
  return {version:PHASE_DATA_VERSION,title:input.title,source:input.source,asOf:input.asOf,x,y,quadrants:{...input.quadrants},smoothing:'none',points,focus,segments,observed:points.filter(p=>p.valid).length,missing:points.filter(p=>!p.valid).length,dateSpan:[points[0].date,points.at(-1).date],connectionPolicy:'Straight guides between adjacent complete supplied rows; null breaks the trail. Unlisted dates have no observation.',interpretation:'Quadrants describe the chosen variables and references, not a repeating cycle, forecast or timing signal.'};
}
