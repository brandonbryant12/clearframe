import { field } from './guards.mjs';
import type { CanvasElement, Fail } from './types.mjs';

import { ELEMENT_TYPES, COMMON, fieldHint } from './canvas-catalog.mjs';
import { checkSound } from './canvas-sound.mjs';

export function checkFields(el: CanvasElement, at: string, fail: Fail): void {
  const spec = Object.hasOwn(ELEMENT_TYPES, el.type)
    ? ELEMENT_TYPES[el.type]
    : null;

  if (!spec)
    fail(`${at}.type must be one of ${Object.keys(ELEMENT_TYPES).join(', ')}`);

  for (const key of Object.keys(el))
    if (!COMMON.includes(key) && !spec.geometry.includes(key))
      fail(
        `${at}: unsupported ${el.type} field ${key}${fieldHint(key) ? `: ${fieldHint(key)}` : ''} (a ${el.type} takes ${spec.geometry.join(', ')}, plus the timing and style fields every element takes)`,
      );

  for (const key of spec.required)
    if (field(el, key) == null) fail(`${at}: ${el.type} needs ${key}`);

  if (el.sound != null && !(el.type === 'pointer' && el.sound === false))
    checkSound(el.sound, `${at}.sound`, fail);
}
