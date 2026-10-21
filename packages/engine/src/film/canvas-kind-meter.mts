import type { CanvasElement, Fail } from './types.mjs';

export function checkMeter(el: CanvasElement, at: string, fail: Fail): void {
  if (
    el.style != null &&
    !['bars', 'mirror', 'ring', 'wave'].includes(el.style)
  )
    fail(`${at}.style must be bars, mirror, ring or wave`);

  if (
    el.bars != null &&
    (!Number.isInteger(el.bars) || el.bars < 3 || el.bars > 96)
  )
    fail(`${at}.bars must be 3–96`);
}
