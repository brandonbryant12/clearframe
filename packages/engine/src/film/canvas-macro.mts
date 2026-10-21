import { expandReceipt } from './receipt.mjs';
import { expandApp } from './app.mjs';
import { expandCrumbs } from './crumbs.mjs';

import type { CanvasElement, Fail, FrameSize } from './types.mjs';

/** Expand a receipt, an app or crumbs into the group it draws; other elements are returned as they are. */
export function expandMacro(
  el: CanvasElement,
  at: string,
  fail: Fail,
  frame?: FrameSize,
): CanvasElement {
  if (el.type === 'receipt') return expandReceipt(el, at, fail);
  if (el.type === 'app') return expandApp(el, at, fail, frame);
  if (el.type === 'crumbs') return expandCrumbs(el, at, fail);
  return el;
}
