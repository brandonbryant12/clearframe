import type { CanvasElement, Fail } from './types.mjs';

import { pathData } from './canvas-path.mjs';

export function checkPath(el: CanvasElement, at: string, fail: Fail): void {
  pathData(el.d, `${at}.d`, fail);
}
