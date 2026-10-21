import { finite } from './guards.mjs';
import type { CanvasElement, Fail } from './types.mjs';

export function checkStroke(el: CanvasElement, at: string, fail: Fail): void {
  if (
    el.dash != null &&
    (!Array.isArray(el.dash) ||
      el.dash.length < 1 ||
      el.dash.length > 6 ||
      el.dash.some((v) => !finite(v) || v < 0))
  )
    fail(`${at}.dash must be 1–6 nonnegative lengths`);

  if (
    el.origin != null &&
    (!Array.isArray(el.origin) ||
      el.origin.length !== 2 ||
      el.origin.some((v) => !finite(v)))
  )
    fail(`${at}.origin must be [x, y]`);

  if (el.cap != null && !['round', 'butt', 'square'].includes(el.cap))
    fail(`${at}.cap must be round, butt or square`);

  if (el.join != null && !['round', 'miter', 'bevel'].includes(el.join))
    fail(`${at}.join must be round, miter or bevel`);

  if (
    el.blend != null &&
    ![
      'normal',
      'multiply',
      'screen',
      'overlay',
      'darken',
      'lighten',
      'soft-light',
      'difference',
    ].includes(el.blend)
  )
    fail(`${at}.blend is not a supported blend mode`);

  if (el.arrow != null && !['start', 'end', 'both', 'none'].includes(el.arrow))
    fail(`${at}.arrow must be start, end, both or none`);
}
