import { finite } from './guards.mjs';
import type { CanvasElement, Fail } from './types.mjs';

export function checkVisibility(
  el: CanvasElement,
  at: string,
  fail: Fail,
): void {
  for (const key of ['shadow', 'glow'] as const) {
    const v = el[key];
    if (
      v != null &&
      typeof v !== 'boolean' &&
      (typeof v !== 'object' || Array.isArray(v))
    )
      fail(`${at}.${key} must be true or {blur, opacity, dx, dy, color}`);
  }

  if (el.depth != null && (!finite(el.depth) || el.depth <= 0 || el.depth > 1))
    fail(
      `${at}.depth must be above 0 and at most 1 (1 moves with the world; smaller is farther away)`,
    );

  if (
    el.opacity != null &&
    (!finite(el.opacity) || el.opacity < 0 || el.opacity > 1)
  )
    fail(`${at}.opacity must be 0–1`);
}
