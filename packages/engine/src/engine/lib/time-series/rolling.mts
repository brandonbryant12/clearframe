import type { Rolling, RollingObservation } from './contracts.mjs';
import {
  own,
  values,
  frequencyOf,
  cadence,
  integer,
  basis,
  num,
} from './inputs.mjs';

/** Complete-window mean and sample SD. Nulls never shrink the denominator. */
export function rollingStatistics(input: unknown): Rolling {
  own(input, ['observations', 'frequency', 'window'], 'rolling');
  const observations = values(input.observations),
    frequency = frequencyOf(input.frequency);
  cadence(observations, frequency);
  const window = integer(input.window, 2, 1200, 'window');
  return {
    ...basis(frequency),
    method: 'complete-window-sample-statistics',
    window,
    ddof: 1,
    annualized: false,
    observations: observations.map((p, i): RollingObservation => {
      const rows = observations.slice(Math.max(0, i - window + 1), i + 1),
        seen = rows.flatMap((r) => (r.value === null ? [] : [r.value])),
        count = seen.length,
        complete = rows.length === window && count === window;
      let mean: number | null = null,
        standardDeviation: number | null = null;
      if (complete) {
        let m = 0,
          m2 = 0,
          n = 0;
        for (const v of seen) {
          const delta = v - m;
          m += delta / ++n;
          m2 += delta * (v - m);
        }
        mean = num(m, 'rolling mean');
        standardDeviation = num(
          Math.sqrt(Math.max(0, m2 / (window - 1))),
          'sample standard deviation',
        );
      }
      return {
        date: p.date,
        value: p.value,
        windowStart: rows[0].date,
        count,
        complete,
        missing: rollingMissing(rows.length, count, window),
        mean,
        standardDeviation,
      };
    }),
  };
}

export function rollingMissing(
  rows: number,
  count: number,
  window: number,
): RollingObservation['missing'] {
  if (rows < window) return 'warmup';
  return count < window ? 'missing-window-value' : null;
}
