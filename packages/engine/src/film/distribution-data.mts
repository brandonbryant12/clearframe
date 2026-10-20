// Explicit finite samples and bins. No fitted curve or inferred tail probability.
import { utcDay } from './plot-data.mjs';
import { isRecord } from './guards.mjs';
import { decodeDistribution } from './distribution-input.mjs';
export const DISTRIBUTION_DATA_VERSION = 1;
function check(ok: unknown, m: string): asserts ok {
  if (!ok) throw Error(`distribution: ${m}`);
}
/** Check an object and its keys; its fields are checked by the caller. */
function own(o: unknown, keys: readonly string[], name: string): void {
  check(isRecord(o), `${name} must be an object`);
  for (const k of Object.keys(o))
    check(keys.includes(k), `unknown ${name}.${k}`);
}
const finite = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e9;
export type Relation = 'gte' | 'gt' | 'lte' | 'lt';
export interface DistributionInput {
  title: string;
  source: string;
  asOf: string;
  unit: string;
  observations: Array<number | null>;
  edges: number[];
  mode: 'count' | 'density';
  threshold: { value: number; relation: Relation };
  y: { max: number; ticks: number[]; decimals?: number };
}
export interface DistributionBin {
  index: number;
  low: number;
  high: number;
  width: number;
  rightClosed: boolean;
  members: number[];
  count: number;
  height: number;
}
export interface DistributionObservation {
  index: number;
  value: number | null;
  bin: number | null;
  qualifies: boolean | null;
}
export interface DistributionModel {
  version: number;
  title: string;
  source: string;
  asOf: string;
  unit: string;
  mode: 'count' | 'density';
  edges: number[];
  bins: DistributionBin[];
  observations: DistributionObservation[];
  n: number;
  missing: number;
  threshold: {
    value: number;
    relation: Relation;
    count: number;
    denominator: number;
    fraction: number;
    members: number[];
  };
  y: { max: number; ticks: number[]; decimals: number };
  edgePolicy: string;
  missingPolicy: string;
}
export function distribution(raw: unknown): DistributionModel {
  const input = decodeDistribution(raw);
  // Its fields are checked below.
  own(
    input,
    [
      'title',
      'source',
      'asOf',
      'unit',
      'observations',
      'edges',
      'mode',
      'threshold',
      'y',
    ],
    'input',
  );
  for (const k of ['title', 'source', 'unit'] as const)
    check(
      typeof input[k] === 'string' &&
        input[k].trim().length > 0 &&
        input[k].length <= 160,
      `${k} required, at most 160 characters`,
    );
  utcDay(input.asOf);
  check(
    ['count', 'density'].includes(input.mode),
    'mode must be count or density',
  );
  check(
    Array.isArray(input.observations) &&
      input.observations.length >= 1 &&
      input.observations.length <= 240,
    '1–240 explicit observations required',
  );
  for (let i = 0; i < input.observations.length; i++)
    check(
      Object.hasOwn(input.observations, i),
      'retain missing observations as explicit null, not sparse slots',
    );
  check(
    Array.isArray(input.edges) &&
      input.edges.length >= 3 &&
      input.edges.length <= 13,
    '2–12 explicit bins required',
  );
  const edges = [...input.edges];
  check(
    edges.every(finite) && edges.every((v, i) => !i || v > edges[i - 1]),
    'edges must be finite, strictly increasing, and bounded by 1e9',
  );
  const first = edges[0],
    last = edges[edges.length - 1];
  const widths = edges.slice(1).map((v, i) => v - edges[i]);
  check(
    widths.every((v) => v >= 1e-9),
    'bin widths must be at least 1e-9',
  );
  if (input.mode === 'count')
    check(
      widths.every((v) => Math.abs(v - widths[0]) <= widths[0] * 1e-12),
      'count mode requires equal-width bins; use density for unequal widths',
    );
  own(input.threshold, ['value', 'relation'], 'threshold');
  const { value, relation } = input.threshold;
  check(
    finite(value) && value >= first && value <= last,
    'threshold must lie inside supplied bin range',
  );
  check(
    ['gte', 'gt', 'lte', 'lt'].includes(relation),
    'threshold relation must be gte, gt, lte or lt',
  );
  const qualifies = (v: number): boolean =>
    qualifiesThreshold(v, value, relation);
  const observations = input.observations.map(
    (v, index): DistributionObservation => {
      check(
        v === null || finite(v),
        'observations must be finite numbers or null',
      );
      check(
        v === null || (v >= first && v <= last),
        'observation outside bins; no silent exclusion',
      );
      const bin = observationBin(v, edges, last);
      return {
        index,
        value: v,
        bin,
        qualifies: v === null ? null : qualifies(v),
      };
    },
  );
  const n = observations.filter((v) => v.value !== null).length;
  check(n > 0, 'at least one observed value required');
  const bins = widths.map((width, index): DistributionBin => {
    const members = observations
        .filter((v) => v.bin === index)
        .map((v) => v.index),
      count = members.length,
      height = input.mode === 'count' ? count : count / n / width;
    return {
      index,
      low: edges[index],
      high: edges[index + 1],
      width,
      rightClosed: index === widths.length - 1,
      members,
      count,
      height,
    };
  });
  own(input.y, ['max', 'ticks', 'decimals'], 'y');
  const { max, ticks, decimals = 0 } = input.y;
  check(
    Number.isFinite(max) && max > 0 && bins.every((b) => b.height <= max),
    'explicit y maximum must contain every bar',
  );
  check(
    Number.isInteger(decimals) && decimals >= 0 && decimals <= 9,
    'y decimals must be 0–9',
  );
  check(
    Array.isArray(ticks) &&
      ticks.length >= 2 &&
      ticks.length <= 6 &&
      ticks[0] === 0 &&
      ticks[ticks.length - 1] === max &&
      ticks.every(
        (v, i) =>
          Number.isFinite(v) && v >= 0 && v <= max && (!i || v > ticks[i - 1]),
      ),
    'y ticks must increase from zero through maximum',
  );
  check(
    ticks.every((v) => Number(v.toFixed(decimals)) === v),
    'y ticks must be exactly representable at declared precision',
  );
  const tail = observations
    .filter((v) => v.qualifies === true)
    .map((v) => v.index);
  return {
    version: DISTRIBUTION_DATA_VERSION,
    title: input.title,
    source: input.source,
    asOf: input.asOf,
    unit: input.unit,
    mode: input.mode,
    edges,
    bins,
    observations,
    n,
    missing: observations.length - n,
    threshold: {
      value,
      relation,
      count: tail.length,
      denominator: n,
      fraction: tail.length / n,
      members: tail,
    },
    y: { max, ticks: [...ticks], decimals },
    edgePolicy: 'left-closed right-open; final bin right-closed',
    missingPolicy:
      'null excluded from observed denominator; counted explicitly',
  };
}

function qualifiesThreshold(
  v: number,
  value: number,
  relation: Relation,
): boolean {
  if (relation === 'gte') return v >= value;
  if (relation === 'gt') return v > value;
  if (relation === 'lte') return v <= value;
  return v < value;
}
function observationBin(
  v: number | null,
  edges: number[],
  last: number,
): number | null {
  if (v === null) return null;
  if (v === last) return edges.length - 2;
  return edges.findIndex(
    (e, i) => i < edges.length - 1 && v >= e && v < edges[i + 1],
  );
}
