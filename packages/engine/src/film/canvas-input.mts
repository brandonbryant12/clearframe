import { decodeCanvasElement } from './canvas-schema.mjs';
import { ELEMENT_TYPES } from './canvas-catalog.mjs';
import { isRecord, finite, messageOf } from './guards.mjs';
import type { CanvasElement, Fail } from './types.mjs';
export function canvasInput(
  input: unknown,
  at: string,
  fail: Fail,
): CanvasElement {
  if (!isRecord(input)) fail(`${at} must be an object`);
  if (
    typeof input.type !== 'string' ||
    !Object.hasOwn(ELEMENT_TYPES, input.type)
  )
    fail(`${at}.type must be one of ${Object.keys(ELEMENT_TYPES).join(', ')}`);
  if (
    input.type === 'text' &&
    input.count != null &&
    (!isRecord(input.count) || !finite(input.count.to))
  )
    fail(`${at}.count needs a numeric to`);
  try {
    return decodeCanvasElement(input);
  } catch (error) {
    return fail(`${at}: ${messageOf(error)}`);
  }
}
