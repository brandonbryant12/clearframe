import { utcDay } from '../../../film/plot-data.mjs';
import { isRecord } from '../errors.mjs';
import { CURVE_KINDS } from './contracts.mjs';
import type { CurveKind, DatedValue } from './contracts.mjs';

export function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(`expectations: ${message}`);
}

export function object(
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

export function list(
  v: unknown,
  min: number,
  max: number,
  name: string,
): asserts v is unknown[] {
  check(
    Array.isArray(v) && v.length >= min && v.length <= max,
    `${name} needs ${min}–${max} entries`,
  );
}

export const label = (v: unknown, name: string): string => {
  check(
    typeof v === 'string' && v.trim().length > 0 && v.length <= 100,
    `${name} needs a short label`,
  );
  return v;
};

/** A calendar date (utcDay refuses anything else) and its UTC day number. */
export function dated(v: unknown): { date: string; day: number } {
  const day = utcDay(v);
  check(typeof v === 'string', 'dates must be YYYY-MM-DD');
  return { date: v, day };
}

export const isCurveKind = (v: unknown): v is CurveKind =>
  CURVE_KINDS.some((k) => k === v);

/** Values at strictly increasing dates, each date read from `key`. */
export function datedValues(values: unknown, key = 'date'): DatedValue[] {
  list(values, 1, 1200, 'values');
  let last = -Infinity;
  return values.map((v) => {
    object(v, [key, 'value'], 'value');
    const { date, day } = dated(v[key]);
    check(day > last, 'value dates must strictly increase');
    last = day;
    return { date, value: nullable(v.value, 'value') };
  });
}
