import { isRecord } from '../errors.mjs';

export function fail(message: string): never {
  throw new Error(`finance: ${message}`);
}

export function check(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

export function object(
  value: unknown,
  fields: readonly string[],
  name: string,
): asserts value is Record<string, unknown> {
  check(isRecord(value), `${name} must be an object`);
  for (const key of Object.keys(value))
    check(fields.includes(key), `unknown ${name}.${key}`);
}

/** An array of `1..max` entries, or the refusal `message`. */
export function entries(
  value: unknown,
  max: number,
  message: string,
): unknown[] {
  check(
    Array.isArray(value) && value.length > 0 && value.length <= max,
    message,
  );
  return value;
}

export function number(
  value: unknown,
  name: string,
  min = -Infinity,
  max = Infinity,
): number {
  check(
    typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= min &&
      value <= max,
    `${name} must be finite and in [${min}, ${max}]`,
  );
  return value;
}

// Above this range cent-scale presentation loses useful precision with binary floating point.
export const money = (value: unknown, name: string): number =>
  number(value, name, 0, 1e12);

export const computed = (value: unknown, name: string): number =>
  number(value, name, -1e12, 1e12);

export const fraction = (value: unknown, name: string): number =>
  number(value, name, 0, 1);
