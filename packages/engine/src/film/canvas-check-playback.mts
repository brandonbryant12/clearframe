import { finite } from './guards.mjs';
import type { CanvasElement, Fail } from './types.mjs';

export function checkPlayback(el: CanvasElement, at: string, fail: Fail): void {
  if (el.fps != null && (!finite(el.fps) || el.fps < 2 || el.fps > 60))
    fail(`${at}.fps must be 2–60 (stepped motion, e.g. 12 for "on twos")`);

  if (
    el.morphDur != null &&
    (!finite(el.morphDur) || el.morphDur < 0.1 || el.morphDur > 4)
  )
    fail(`${at}.morphDur must be 0.1–4 seconds`);
}
