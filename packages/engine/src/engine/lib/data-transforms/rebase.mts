import { DATA_MODEL_VERSION } from './contracts.mjs';
import type { RebaseResult } from './contracts.mjs';
import { object, dated, number, check } from './inputs.mjs';

/** An exact observed anchor is required; nulls stay missing and no dates are interpolated. */
export function rebaseSeries(input: unknown): RebaseResult {
  object(input, ['observations', 'baseDate', 'baseIndex'], 'rebase');
  const { date: baseDate, day: anchor } = dated(input.baseDate),
    baseIndex = number(input.baseIndex, 'baseIndex');
  check(baseIndex > 0, 'baseIndex must be positive');
  const rows = input.observations;
  check(
    Array.isArray(rows) && rows.length >= 1 && rows.length <= 1200,
    'observations needs 1–1200 records',
  );
  let previous = -Infinity;
  const observations = rows.map((p: unknown, i: number) => {
    object(p, ['date', 'value'], `observations[${i}]`);
    const { date, day } = dated(p.date);
    check(day > previous, 'observation dates must strictly increase');
    previous = day;
    return {
      date,
      day,
      value:
        p.value === null ? null : number(p.value, `observations[${i}].value`),
    };
  });
  const base = observations.find((p) => p.day === anchor);
  check(
    base && base.value !== null && base.value > 0,
    'baseDate must name an observed positive value',
  );
  const baseValue = base.value;
  return {
    modelVersion: DATA_MODEL_VERSION,
    method: 'observed-anchor-ratio',
    baseDate,
    baseIndex,
    baseValue,
    observations: observations.map((p) => ({
      date: p.date,
      elapsedDays: p.day - anchor,
      value: p.value,
      index:
        p.value === null
          ? null
          : number((p.value / baseValue) * baseIndex, 'rebased value'),
    })),
  };
}
