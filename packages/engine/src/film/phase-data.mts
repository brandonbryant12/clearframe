// Dated paired observations. Quadrants describe supplied variables; no cycle is fitted.
import { utcDay } from './plot-data.mjs';
import { keys, dense, required } from './financial/validation.mjs';
import type {
  PhaseInput,
  PhaseAxis,
  PhasePoint,
  Quadrant,
  ReferenceBoundary,
} from './financial/phase-types.mjs';
export type * from './financial/phase-types.mjs';
export const PHASE_DATA_VERSION = 1;
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(`phase trail: ${message}`);
}
const finite = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e9;
const own = (o: unknown, allowed: readonly string[], label: string) =>
  keys(o, allowed, label, 'phase trail');
const words = (v: unknown, label: string, max: number) =>
  check(
    typeof v === 'string' && v.trim() && v.length <= max,
    `${label} needs text up to ${max} characters`,
  );
function axis(input: PhaseAxis, name: string) {
  own(
    input,
    ['label', 'definition', 'domain', 'ticks', 'reference', 'decimals'],
    name,
  );
  words(input.label, `${name}.label including units`, 42);
  words(input.definition, `${name}.definition`, 180);
  check(
    dense(input.domain) &&
      input.domain.length === 2 &&
      input.domain.every(finite) &&
      input.domain[0] < input.domain[1],
    `${name}.domain must increase within ±1e9`,
  );
  const [lo, hi] = input.domain;
  check(
    finite(input.reference) && input.reference > lo && input.reference < hi,
    `${name}.reference must lie strictly inside the domain`,
  );
  check(
    Number.isInteger(input.decimals) &&
      input.decimals >= 0 &&
      input.decimals <= 6,
    `${name}.decimals must be 0–6`,
  );
  check(
    dense(input.ticks) &&
      input.ticks.length >= 3 &&
      input.ticks.length <= 6 &&
      input.ticks[0] === lo &&
      input.ticks.at(-1) === hi &&
      input.ticks.includes(input.reference),
    `${name}.ticks must include both endpoints and the reference`,
  );
  check(
    input.ticks.every(
      (v, i) =>
        finite(v) &&
        v >= lo &&
        v <= hi &&
        (!i || v > input.ticks[i - 1]) &&
        Number(v.toFixed(input.decimals)) === v,
    ),
    `${name}.ticks must increase and match displayed precision`,
  );
  return structuredClone(input);
}
const quadrantKeys: Quadrant[] = ['NE', 'NW', 'SW', 'SE'];
const coordinateKeys: ('x' | 'y')[] = ['x', 'y'];
export function phaseTrail(input: PhaseInput) {
  own(
    input,
    [
      'title',
      'source',
      'asOf',
      'x',
      'y',
      'quadrants',
      'points',
      'focusDate',
      'smoothing',
    ],
    'input',
  );
  words(input.title, 'title', 80);
  words(input.source, 'source', 110);
  const asOfDay = utcDay(input.asOf),
    x = axis(input.x, 'x'),
    y = axis(input.y, 'y');
  check(
    input.smoothing === 'none',
    'smoothing must be explicitly none; do not invent intermediate observations',
  );
  own(input.quadrants, ['NE', 'NW', 'SW', 'SE'], 'quadrants');
  for (const key of quadrantKeys)
    words(input.quadrants[key], `quadrants.${key}`, 30);
  check(
    new Set(
      Object.values(input.quadrants).map((s) =>
        s
          .split('/')
          .map((row) => row.trim().replace(/\s+/g, ' '))
          .join('/'),
      ),
    ).size === 4,
    'displayed quadrant labels must be distinct',
  );
  check(
    dense(input.points) &&
      input.points.length >= 2 &&
      input.points.length <= 120,
    'points must contain 2–120 explicit dated rows',
  );
  let previous = -Infinity;
  const points: PhasePoint[] = input.points.map((p, index) => {
    own(p, ['date', 'x', 'y'], 'point');
    const day = utcDay(p.date);
    check(
      day > previous && day <= asOfDay,
      'dates must strictly increase without duplicates and not exceed asOf',
    );
    previous = day;
    for (const key of coordinateKeys) {
      const a = input[key],
        value = p[key];
      check(
        value === null ||
          (finite(value) && value >= a.domain[0] && value <= a.domain[1]),
        `${key} must be explicit null or inside its domain; no clipping`,
      );
    }
    const valid = p.x !== null && p.y !== null,
      sx = p.x !== null ? Math.sign(p.x - x.reference) : null,
      sy = p.y !== null ? Math.sign(p.y - y.reference) : null;
    const quadrant = quadrantAt(sx, sy);
    const boundary = boundaryAt(sx, sy, quadrant);
    return {
      index,
      date: p.date,
      day,
      x: p.x,
      y: p.y,
      valid,
      quadrant,
      boundary,
      time: 0,
      missing: valid ? [] : coordinateKeys.filter((k) => p[k] === null),
    };
  });
  check(
    points.some((p) => p.valid),
    'at least one complete paired observation is required',
  );
  const focus = points.find((p) => p.date === input.focusDate);
  check(focus, 'focusDate must be a supplied date');
  const firstDay = points[0].day,
    lastDay = required(
      points.at(-1),
      'phase trail: missing last observation',
    ).day;
  for (const p of points) p.time = (p.day - firstDay) / (lastDay - firstDay);
  const segments = [];
  for (let i = 1; i < points.length; i++)
    if (points[i - 1].valid && points[i].valid)
      segments.push({
        from: i - 1,
        to: i,
        fromDate: points[i - 1].date,
        toDate: points[i].date,
        days: points[i].day - points[i - 1].day,
      });
  return {
    version: PHASE_DATA_VERSION,
    title: input.title,
    source: input.source,
    asOf: input.asOf,
    x,
    y,
    quadrants: { ...input.quadrants },
    smoothing: 'none',
    points,
    focus,
    segments,
    observed: points.filter((p) => p.valid).length,
    missing: points.filter((p) => !p.valid).length,
    dateSpan: [
      points[0].date,
      required(points.at(-1), 'phase trail: missing last observation').date,
    ],
    connectionPolicy:
      'Straight guides between adjacent complete supplied rows; null breaks the trail. Unlisted dates have no observation.',
    interpretation:
      'Quadrants describe the chosen variables and references, not a repeating cycle, forecast or timing signal.',
  };
}

function quadrantAt(sx: number | null, sy: number | null): Quadrant | null {
  if (sx === null || sy === null || sx === 0 || sy === 0) return null;
  if (sy > 0) return sx > 0 ? 'NE' : 'NW';
  return sx > 0 ? 'SE' : 'SW';
}
function boundaryAt(
  sx: number | null,
  sy: number | null,
  quadrant: Quadrant | null,
): ReferenceBoundary | null {
  if (sx === null || sy === null || quadrant) return null;
  if (sx === 0 && sy === 0) return 'both-references';
  return sx === 0 ? 'x-reference' : 'y-reference';
}
