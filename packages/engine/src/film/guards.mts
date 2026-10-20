// Narrowing helpers for values read from JSON, library modules and caught errors.
import type { ElementMark, JsonRecord, TextMark } from './types.mjs';

/** A mark on words (a globe's [lat, lon] marks are arrays). */
export const isTextMark = (mark: ElementMark): mark is TextMark =>
  !Array.isArray(mark);

/** A plain object (not null, not an array). */
export const isRecord = (value: unknown): value is JsonRecord =>
  value != null && typeof value === 'object' && !Array.isArray(value);

/** An object or array, read by key (an array's keys are its indexes). */
export const isObject = (value: unknown): value is JsonRecord =>
  value != null && typeof value === 'object';

/** An array whose items are still to be checked (Array.isArray would type them as any). */
export const isList = (value: unknown): value is unknown[] =>
  Array.isArray(value);

/** A finite number. */
export const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** One of a list of names. */
export const oneOf = <T extends string>(
  list: readonly T[],
  value: unknown,
): value is T => {
  const names: readonly string[] = list;
  return typeof value === 'string' && names.includes(value);
};

/** A field read by name from an object whose type does not list it (`obj[key]`). */
export const field = (value: unknown, key: string): unknown =>
  isObject(value) ? value[key] : undefined;

/** The message of a caught value: an Error's own, anything else as text. */
export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The fields of an object with their values still to be checked. */
export function fields(value: unknown): [string, unknown][] {
  if (!isObject(value))
    throw new Error('Expected an object to read its fields.');
  return Object.entries(value);
}
