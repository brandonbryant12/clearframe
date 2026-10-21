import { CANVAS_TIMING as T } from './constants.mjs';
import { finite } from './guards.mjs';
import type { CanvasElement, Fail } from './types.mjs';

import { FONTS } from './canvas-catalog.mjs';

import { textMarks } from './canvas-marks.mjs';

export function checkText(el: CanvasElement, at: string, fail: Fail): void {
  if (el.count == null && (typeof el.text !== 'string' || !el.text.trim()))
    fail(`${at}: text needs text or count`);

  if (el.text != null && (typeof el.text !== 'string' || el.text.length > 240))
    fail(`${at}.text must be up to 240 characters`);

  if (el.font != null && !FONTS.includes(el.font))
    fail(`${at}.font must be one of ${FONTS.join(', ')}`);

  if (el.anchor != null && !['start', 'middle', 'end'].includes(el.anchor))
    fail(`${at}.anchor must be start, middle or end`);

  checkCount(el, at, fail);
  if (el.marks != null) el.marks = textMarks(el, at, fail);
}

function checkCount(el: CanvasElement, at: string, fail: Fail): void {
  if (el.count != null) {
    const c = el.count;
    if (!c || typeof c !== 'object' || !finite(c.to))
      fail(`${at}.count needs a numeric to`);
    for (const key of Object.keys(c))
      if (!['from', 'to', 'decimals', 'prefix', 'suffix', 'dur'].includes(key))
        fail(`${at}.count: unsupported field ${key}`);
    c.from ??= 0;
    c.decimals ??= 0;
    c.dur ??= T.count;
    if (
      !finite(c.from) ||
      !Number.isInteger(c.decimals) ||
      c.decimals < 0 ||
      c.decimals > 8 ||
      !finite(c.dur) ||
      c.dur <= 0
    )
      fail(`${at}.count needs finite from, decimals 0–8 and a positive dur`);
  }
}
