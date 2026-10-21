import { finite } from './guards.mjs';
import type { CanvasElement, Fail } from './types.mjs';

import { normalizeElements, type ElementCount } from './canvas-normalize.mjs';
export function checkGroup(
  el: CanvasElement,
  at: string,
  fail: Fail,
  state: ElementCount,
  depth: number,
): void {
  if (
    el.stagger != null &&
    (!finite(el.stagger) || el.stagger < 0 || el.stagger > 3)
  )
    fail(`${at}.stagger must be 0–3 seconds`);

  el.children = normalizeElements(
    el.children,
    `${at}.children`,
    fail,
    state,
    depth + 1,
  );
}
