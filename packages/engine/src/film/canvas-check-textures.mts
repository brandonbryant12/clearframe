import type { CanvasElement, Fail } from './types.mjs';

import { roughSpec } from './canvas-rough.mjs';
import { MOSAIC_TYPES, mosaicSpec } from './canvas-mosaic.mjs';
import { PRINT_TYPES, printSpec } from './canvas-print.mjs';

export function checkTextures(el: CanvasElement, at: string, fail: Fail): void {
  // An element's own opt-out outlives the beat's rough, which is applied after validation.
  if (el.rough === false) el.rough = null;
  else if (el.rough != null)
    el.rough = roughSpec(el.rough, `${at}.rough`, fail);

  if (el.mosaic === false) delete el.mosaic;
  else if (el.mosaic != null) {
    if (!MOSAIC_TYPES.has(el.type))
      fail(`${at}.mosaic works on rect, circle, ellipse, path, poly and line`);
    el.mosaic = mosaicSpec(el.mosaic, `${at}.mosaic`, fail);
  }

  // `print: false` opts out of a canvas-wide print; `applyPrint` removes the marker.
  if (el.print != null && el.print !== false) {
    if (!PRINT_TYPES.has(el.type))
      fail(
        `${at}.print works on rect, circle, ellipse, path, poly, image and text`,
      );
    const print = printSpec(el.print, `${at}.print`, fail);
    el.print = print;
    if (
      el.type === 'text' &&
      (typeof print !== 'object' || print.screen || print.register)
    )
      fail(
        `${at}.print on text takes only wear, as {wear} (screens and register need a shape or picture)`,
      );
  }
}
