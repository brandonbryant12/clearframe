import { finite } from './guards.mjs';
import type { CanvasElement, Fail } from './types.mjs';

export function checkPoly(el: CanvasElement, at: string, fail: Fail): void {
  if (
    !Array.isArray(el.points) ||
    el.points.length < 2 ||
    el.points.length > 400 ||
    el.points.some(
      (p) => !Array.isArray(p) || p.length !== 2 || !p.every(finite),
    )
  )
    fail(`${at}.points must be 2–400 [x, y] pairs`);
}
