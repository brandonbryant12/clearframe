import { utcDay } from '../../../film/plot-data.mjs';
import { isRecord } from '../errors.mjs';
import { MONTHS, TIME_SERIES_VERSION } from './contracts.mjs';
import type { ValueObservation, Frequency, SeriesBasis } from './contracts.mjs';

export function check(ok: unknown, m: string): asserts ok {
  if (!ok) throw Error(`time series: ${m}`);
}

export function own(
  v: unknown,
  keys: readonly string[],
  name: string,
): asserts v is Record<string, unknown> {
  check(isRecord(v), `${name} must be an object`);
  for (const k of Object.keys(v))
    check(keys.includes(k), `unknown ${name}.${k}`);
}

export const num = (v: unknown, name: string): number => {
  check(
    typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e12,
    `${name} must be finite within ±10^12`,
  );
  return v;
};

export const nullable = (v: unknown, name: string): number | null =>
  v === null ? null : num(v, name);

export const integer = (
  v: unknown,
  lo: number,
  hi: number,
  name: string,
): number => {
  check(
    typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi,
    `${name} must be an integer in ${lo}–${hi}`,
  );
  return v;
};

/** A calendar date (utcDay refuses anything else) and its UTC day number. */
export function dated(v: unknown): { date: string; day: number } {
  const day = utcDay(v);
  check(typeof v === 'string', 'dates must be YYYY-MM-DD');
  return { date: v, day };
}

export const monthEnd = (y: number, m: number): number =>
  [
    31,
    y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][m];

/** Dated observations with these nullable fields, in strictly increasing date order. */
export function records<T>(
  input: unknown,
  fields: readonly string[],
  build: (date: string, field: (k: string) => number | null) => T,
): T[] {
  check(
    Array.isArray(input) && input.length >= 2 && input.length <= 1200,
    'observations needs 2–1200 records',
  );
  let last = -Infinity;
  return input.map((p: unknown, i: number) => {
    own(p, ['date', ...fields], `observations[${i}]`);
    const { date, day } = dated(p.date);
    check(day > last, 'dates must strictly increase');
    last = day;
    return build(date, (k) => nullable(p[k], `observations[${i}].${k}`));
  });
}

export const values = (input: unknown): ValueObservation[] =>
  records(input, ['value'], (date, f) => ({ date, value: f('value') }));

export const isFrequency = (v: unknown): v is Frequency =>
  typeof v === 'string' && Object.hasOwn(MONTHS, v);

export function frequencyOf(v: unknown): Frequency {
  check(isFrequency(v), 'frequency must be monthly, quarterly or annual');
  return v;
}

export function cadence(
  observations: readonly { date: string }[],
  frequency: Frequency,
): number {
  const [y, m, d] = observations[0].date.split('-').map(Number),
    anchor = m - 1,
    ends = d === monthEnd(y, anchor);
  observations.forEach((p, i) => {
    const ordinal = y * 12 + anchor + i * MONTHS[frequency],
      year = Math.floor(ordinal / 12),
      month = ordinal % 12;
    const day = ends
      ? monthEnd(year, month)
      : Math.min(d, monthEnd(year, month));
    const expected = `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    check(
      p.date === expected,
      `missing or irregular ${frequency} observation at ${p.date}; use an explicit null at ${expected}`,
    );
  });
  return 12 / MONTHS[frequency];
}

export function basis(frequency: Frequency): SeriesBasis {
  return {
    modelVersion: TIME_SERIES_VERSION,
    frequency,
    interpolation: 'none',
  };
}
