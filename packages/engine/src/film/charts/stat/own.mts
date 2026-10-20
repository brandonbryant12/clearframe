import type { JsonRecord } from '../../types.mjs';
import { check } from './check.mjs';

/** Check an object and its keys; its fields are checked by the caller. */
export function own<T extends object = JsonRecord>(
  o: unknown,
  keys: readonly string[],
  name: string,
): asserts o is T {
  check(
    o && typeof o === 'object' && !Array.isArray(o),
    `${name} must be an object`,
  );
  for (const k of Object.keys(o))
    check(keys.includes(k), `unknown ${name}.${k}`);
}
