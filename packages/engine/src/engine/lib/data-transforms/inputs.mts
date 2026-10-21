import { utcDay } from '../../../film/plot-data.mjs';
import { isRecord } from '../errors.mjs';
import { OPERATORS } from './contracts.mjs';
import type { Operator, Component } from './contracts.mjs';

export function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(`data transform: ${message}`);
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

export function number(v: unknown, name: string): number {
  check(
    typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e12,
    `${name} must be finite within ±10^12`,
  );
  return v;
}

export function label(v: unknown, name: string): string {
  check(
    typeof v === 'string' && v.trim() && v.length <= 60,
    `${name} needs 1–60 characters`,
  );
  return v;
}

export function id(v: unknown, name: string): string {
  check(
    typeof v === 'string' && /^[a-z][a-z0-9-]{0,39}$/.test(v),
    `${name} needs a lowercase identifier`,
  );
  return v;
}

/** A calendar date (utcDay refuses anything else) and its UTC day number. */
export function dated(v: unknown): { date: string; day: number } {
  const day = utcDay(v);
  check(typeof v === 'string', 'dates must be YYYY-MM-DD');
  return { date: v, day };
}

export const isOperator = (v: unknown): v is Operator =>
  OPERATORS.some((o) => o === v);

export function sum(values: readonly number[]): number {
  // Neumaier summation retains small signed components beside larger values.
  let total = 0,
    correction = 0;
  for (const v of values) {
    const next = total + v;
    correction +=
      Math.abs(total) >= Math.abs(v) ? total - next + v : v - next + total;
    total = next;
  }
  return number(total + correction, 'sum');
}

export function components(input: unknown, name: string): Component[] {
  check(
    Array.isArray(input) && input.length <= 12,
    `${name} needs at most 12 components`,
  );
  const ids = new Set<string>();
  return input.map((p: unknown, i: number) => {
    object(p, ['id', 'label', 'amount'], `${name}[${i}]`);
    const pid = id(p.id, `${name}[${i}].id`);
    check(
      !ids.has(pid) && pid !== 'residual' && pid !== 'interaction',
      'component identifiers must be unique and not reserved',
    );
    ids.add(pid);
    return {
      id: pid,
      label: label(p.label, `${name}[${i}].label`),
      amount: number(p.amount, `${name}[${i}].amount`),
    };
  });
}
