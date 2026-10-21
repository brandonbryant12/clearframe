// Reading authored stage fields: a stage spec is unchecked JSON until a recipe reads it. Absent
// values (null or missing) take the recipe's default; a value of the wrong kind is refused with
// the place it was authored, instead of reaching the renderer as a wrong number.
import { isRecord } from '../engine/lib/errors.mjs';

/** An authored object whose fields are read one at a time. */
export type Fields = Record<string, unknown>;

/** Refuse with the authored place: `fail(where, message)` never returns. */
export function fail(where: string, message: string): never {
  throw new Error(`${where}: ${message}`);
}

export const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
export const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);
/** A number, or undefined for anything else (for measuring specs that are refused later). */
export const numeric = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined;

export function optNumber(
  value: unknown,
  where: string,
  key: string,
): number | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'number') return fail(where, `${key} is a number`);
  return value;
}
export const numberOr = (
  value: unknown,
  fallback: number,
  where: string,
  key: string,
): number => optNumber(value, where, key) ?? fallback;

export function optString(
  value: unknown,
  where: string,
  key: string,
): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string') return fail(where, `${key} is text`);
  return value;
}

/** An authored list; absent is empty. */
export function items(
  value: unknown,
  where: string,
  key: string,
): readonly unknown[] {
  if (value == null) return [];
  if (!Array.isArray(value)) return fail(where, `${key} is a list`);
  const list: readonly unknown[] = value;
  return list;
}

/** The objects of a list that may hold anything (measuring before validation). */
export function records(value: unknown): Fields[] {
  const list: readonly unknown[] = Array.isArray(value) ? value : [];
  return list.filter(isRecord);
}

/** An authored object, or an empty one for a value that is not (reads then find no fields). */
export const fieldsOf = (value: unknown): Fields =>
  isRecord(value) ? value : {};

export function own<V>(
  table: Readonly<Record<string, V>>,
  key: unknown,
): V | undefined {
  return typeof key === 'string' && Object.hasOwn(table, key)
    ? table[key]
    : undefined;
}
