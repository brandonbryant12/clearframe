import { num, object, check, datedValues, list, label } from './inputs.mjs';
import { EXPECTATIONS_VERSION } from './contracts.mjs';
import type {
  BandSpec,
  ScenarioEnvelope,
  Scenario,
  EnvelopeObservation,
} from './contracts.mjs';

/** Empirical type-7 quantile: h=(n-1)p, linear interpolation between adjacent ranks.
 * The caller supplies equal-weight scenarios; these are not probability forecasts.
 */
export function quantile(sorted: readonly number[], p: number): number {
  const h = (sorted.length - 1) * p,
    lo = Math.floor(h),
    hi = Math.ceil(h),
    a = sorted[lo],
    b = sorted[hi];
  return num(
    Math.max(a, Math.min(b, a + (b - a) * (h - lo))),
    'empirical quantile',
  );
}

export function bandSpec(band: unknown): BandSpec {
  object(band, ['kind', 'lower', 'upper'], 'band');
  const { kind, lower, upper } = band;
  check(
    kind === 'range' || kind === 'quantile',
    'band kind must be range or quantile',
  );
  if (kind === 'range') {
    check(
      lower === undefined && upper === undefined,
      'range has no percentile parameters',
    );
    return { kind };
  }
  check(
    typeof lower === 'number' &&
      typeof upper === 'number' &&
      lower >= 0 &&
      upper <= 1 &&
      lower < upper,
    'quantile bounds must satisfy 0 ≤ lower < upper ≤ 1',
  );
  return { kind, lower, upper };
}

export function scenarioEnvelope(input: unknown): ScenarioEnvelope {
  object(input, ['history', 'scenarios', 'band'], 'scenario envelope');
  const history = datedValues(input.history),
    origin = history[history.length - 1];
  check(origin.value !== null, 'scenario origin needs an observed value');
  const rows = input.scenarios;
  list(rows, 2, 100, 'scenarios');
  const band = bandSpec(input.band);
  const ids = new Set<string>(),
    grids: string[][] = [];
  const scenarios = rows.map((s): Scenario => {
    object(s, ['id', 'label', 'values'], 'scenario');
    const id = label(s.id, 'scenario id'),
      name = label(s.label, 'scenario label');
    check(!ids.has(id), 'duplicate scenario id');
    ids.add(id);
    const values = datedValues(s.values);
    check(
      values.length >= 2 &&
        values[0].date === origin.date &&
        values[0].value === origin.value,
      'every scenario must begin at the observed origin',
    );
    const grid = values.map((v) => v.date);
    if (grids.length)
      check(
        JSON.stringify(grid) === JSON.stringify(grids[0]),
        'scenarios need the same explicit date grid; use null for missing',
      );
    else grids.push(grid);
    return { id, label: name, values, weight: 1 / rows.length };
  });
  const observations = grids[0].map((date, i): EnvelopeObservation => {
    const values = scenarios.map((s) => s.values[i].value),
      observed = values.flatMap((v) => (v === null ? [] : [v])),
      complete = observed.length === values.length,
      sorted = complete ? observed.sort((a, b) => a - b) : null;
    return {
      date,
      count: observed.length,
      complete,
      lower: bandLimit(sorted, band, 'lower'),
      upper: bandLimit(sorted, band, 'upper'),
      median: sorted === null ? null : quantile(sorted, 0.5),
      missing: complete ? null : 'incomplete-scenario-set',
    };
  });
  return {
    modelVersion: EXPECTATIONS_VERSION,
    origin,
    history,
    scenarios,
    band: {
      ...band,
      method:
        band.kind === 'range'
          ? 'supplied-scenario-min-max'
          : 'equal-weight-empirical-type-7',
    },
    observations,
    weighting: 'equal scenario weights',
    interpretation:
      'descriptive range or quantiles of supplied scenarios; no likelihood, confidence or coverage claim',
    missingPolicy:
      'all supplied scenarios required at each date; no changing denominator',
  };
}

export function bandLimit(
  sorted: readonly number[] | null,
  band: BandSpec,
  edge: 'lower' | 'upper',
): number | null {
  if (!sorted) return null;
  if (band.kind === 'range')
    return sorted[edge === 'lower' ? 0 : sorted.length - 1];
  return quantile(sorted, band[edge]);
}
