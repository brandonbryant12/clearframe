import { finite } from './guards.mjs';
import type { CanvasElement, Fail } from './types.mjs';

export function checkMorph(el: CanvasElement, at: string, fail: Fail): void {
  if (el.morphFrom != null) {
    const m = el.morphFrom;
    const ok =
      m &&
      typeof m === 'object' &&
      !Array.isArray(m) &&
      typeof m.id === 'string' &&
      m.id.trim() &&
      Array.isArray(m.slice) &&
      m.slice.length === 2 &&
      m.slice.every(finite) &&
      m.slice[0] >= 0 &&
      m.slice[1] <= 1 + 1e-9 &&
      m.slice[1] > m.slice[0] &&
      (m.axis == null || ['x', 'y'].includes(m.axis)) &&
      Object.keys(m).every((k) => ['id', 'slice', 'axis'].includes(k));
    if (!ok)
      fail(
        `${at}.morphFrom must be {id, slice: [from, to] (fractions 0–1 of that element), axis: x|y}: the slice of an element of the beat before that this one comes out of`,
      );
    if (el.type !== 'rect')
      fail(`${at}.morphFrom: only a rect comes out of a slice of another`);
    if (el.id == null)
      fail(`${at}.morphFrom needs the element to have its own id`);
  }
}
