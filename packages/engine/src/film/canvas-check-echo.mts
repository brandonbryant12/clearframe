import { finite } from './guards.mjs';
import type { CanvasElement, Fail, EchoSpec } from './types.mjs';

import { isColor } from './canvas-material.mjs';

export function checkEcho(el: CanvasElement, at: string, fail: Fail): void {
  if (el.echo == null) return;
  const e = el.echo;
  if (!e || typeof e !== 'object' || Array.isArray(e))
    fail(`${at}.echo must be {count, lag, step, fade, to}`);
  for (const key of Object.keys(e))
    if (!['count', 'lag', 'step', 'fade', 'to'].includes(key))
      fail(`${at}.echo: unsupported field ${key}`);
  e.count ??= 6;
  if (!Number.isInteger(e.count) || e.count < 1 || e.count > 24)
    fail(`${at}.echo.count must be 1–24`);
  if (e.lag != null && (!finite(e.lag) || e.lag < 0 || e.lag > 2))
    fail(`${at}.echo.lag must be 0–2 seconds`);
  if (e.fade != null && (!finite(e.fade) || e.fade < 0 || e.fade > 1))
    fail(`${at}.echo.fade must be 0–1`);
  if (e.to != null && (!isColor(e.to) || e.to === 'none'))
    fail(`${at}.echo.to must be a palette colour`);
  checkEchoStep(e, at, fail);
  if (!e.lag && !e.step)
    fail(`${at}.echo needs lag (a motion trail) or step (stacked copies)`);
}

function checkEchoStep(e: EchoSpec, at: string, fail: Fail): void {
  if (
    e.step != null &&
    (typeof e.step !== 'object' ||
      Object.entries(e.step).some(
        ([k, v]) => !['x', 'y', 'rotate', 'scale'].includes(k) || !finite(v),
      ))
  )
    fail(`${at}.echo.step takes numeric x, y, rotate, scale`);
}
