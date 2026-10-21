import type { CanvasElement, Fail } from './types.mjs';

import { TREATMENTS } from './canvas-catalog.mjs';

export function checkImage(el: CanvasElement, at: string, fail: Fail): void {
  if (!el.asset && !el.file) fail(`${at}: image needs asset or file`);

  if (
    el.fit != null &&
    !(typeof el.fit === 'string' && ['cover', 'contain'].includes(el.fit))
  )
    fail(`${at}.fit must be cover or contain`);

  if (el.treatment != null && !TREATMENTS.includes(el.treatment))
    fail(`${at}.treatment must be one of ${TREATMENTS.join(', ')}`);
}
