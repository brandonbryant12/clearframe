import { finite } from './guards.mjs';
import type { CanvasElement, Fail } from './types.mjs';

export function checkSpotlight(
  el: CanvasElement,
  at: string,
  fail: Fail,
): void {
  if (
    !(el.cx != null && el.cy != null && el.r != null) &&
    !(el.x != null && el.y != null && el.w != null && el.h != null)
  )
    fail(`${at}: spotlight needs cx, cy, r (circle) or x, y, w, h (box)`);

  if (el.dim != null && (!finite(el.dim) || el.dim < 0 || el.dim > 1))
    fail(`${at}.dim must be 0–1`);
}
