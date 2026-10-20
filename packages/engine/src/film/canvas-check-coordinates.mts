import { fields, finite } from './guards.mjs';
import type { CanvasElement, Fail } from './types.mjs';

export function checkCoordinates(
  el: CanvasElement,
  at: string,
  fail: Fail,
): void {
  // Positions are frame pixels: a word such as "center" was read as 0 and pushed type off the frame.
  for (const key of ['x', 'y', 'cx', 'cy', 'w', 'h'] as const) {
    const v = el[key];
    if (v != null && typeof v !== 'number')
      fail(
        `${at}.${key} must be a number of frame pixels (got ${JSON.stringify(v)})${key === 'x' ? '; to centre type, set x to half the frame width (960, or 540 in a vertical frame) with anchor: "middle"' : ''}`,
      );
  }

  checkFiniteFields(el, at, fail);
  for (const key of [
    'w',
    'h',
    'r',
    'rx',
    'ry',
    'size',
    'width',
    'head',
    'dur',
    'exitDur',
    'at',
    'exitAt',
  ] as const) {
    const v = el[key];
    if (v != null && (!finite(v) || v < 0))
      fail(`${at}.${key} must be a nonnegative number`);
  }
}

function checkFiniteFields(el: CanvasElement, at: string, fail: Fail): void {
  for (const [key, value] of fields(el)) {
    if (
      [
        'children',
        'keys',
        'loop',
        'along',
        'count',
        'fill',
        'stroke',
        'points',
        'origin',
        'dash',
        'echo',
        'rough',
        'marks',
        'sections',
        'scroll',
        'steps',
        'from',
        'point',
        'to',
      ].includes(key)
    )
      continue;
    if (typeof value === 'number' && !Number.isFinite(value))
      fail(`${at}.${key} must be finite`);
  }
}
