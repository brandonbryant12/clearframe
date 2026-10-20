import type { CanvasElement, Fail } from './types.mjs';

export function checkSpoken(el: CanvasElement, at: string, fail: Fail): void {
  for (const key of ['say', 'exitSay'] as const) {
    const v = el[key];
    if (v != null && (typeof v !== 'string' || !v.trim()))
      fail(`${at}.${key} must be a spoken word or phrase`);
  }
}
