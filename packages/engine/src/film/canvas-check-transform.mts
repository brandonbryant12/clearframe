import { finite } from './guards.mjs';
import type { CanvasElement, Fail } from './types.mjs';

export function checkTransform(
  el: CanvasElement,
  at: string,
  fail: Fail,
): void {
  // A drawing reused at another size: scaled about its origin (its centre unless given), and
  // keyed scale multiplies it.
  if (
    el.scale != null &&
    (!finite(el.scale) || el.scale < 0.05 || el.scale > 20)
  )
    fail(`${at}.scale must be 0.05–20`);

  if (el.z != null && (!finite(el.z) || el.z <= -0.9 || el.z > 50))
    fail(
      `${at}.z must be above -0.9 and at most 50 (0 is the picture plane; larger is farther away)`,
    );

  if (el.blur != null && (!finite(el.blur) || el.blur < 0 || el.blur > 60))
    fail(`${at}.blur must be 0–60 px`);

  if (el.type === 'text' && el.fit != null && (!finite(el.fit) || el.fit <= 0))
    fail(`${at}.fit must be the widest the line may be, in canvas units`);
}
