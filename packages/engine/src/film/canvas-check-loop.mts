import { finite } from './guards.mjs';
import type { CanvasElement, Fail } from './types.mjs';

import { LOOPS } from './canvas-catalog.mjs';

export function checkLoop(el: CanvasElement, at: string, fail: Fail): void {
  if (el.loop == null) return;
  const l = el.loop;
  if (!l || typeof l !== 'object' || !LOOPS.includes(l.type))
    fail(`${at}.loop.type must be one of ${LOOPS.join(', ')}`);
  for (const key of Object.keys(l))
    if (!['type', 'period', 'amount'].includes(key))
      fail(`${at}.loop: unsupported field ${key}`);
  if (
    l.period != null &&
    (!finite(l.period) || l.period < 0.1 || l.period > 120)
  )
    fail(`${at}.loop.period must be 0.1–120 seconds`);
  if (l.amount != null && !finite(l.amount))
    fail(`${at}.loop.amount must be a number`);
  if (l.type === 'dash' && !el.dash)
    fail(`${at}: a dash loop needs a dash pattern`);
}
