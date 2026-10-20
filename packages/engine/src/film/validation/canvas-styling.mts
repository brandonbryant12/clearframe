import type { BlockProps, PropHelpers, CanvasElement } from '../types.mjs';

import {
  roughSpec,
  applyRough,
  mosaicSpec,
  applyMosaic,
  printSpec,
  applyPrint,
  depthKeys,
} from '../canvas.mjs';

export function validateDepth(p: BlockProps, h: PropHelpers): void {
  if (p.dolly != null) p.dolly = depthKeys(p.dolly, 'dolly', h.fail);
  if (p.focus == null) return;

  const f = p.focus;
  if (!f || typeof f !== 'object' || Array.isArray(f))
    h.fail('focus must be {z, aperture, keys}');
  for (const k of Object.keys(f))
    if (!['z', 'aperture', 'keys'].includes(k))
      h.fail(`focus: unsupported field ${k}`);
  if (f.z != null && (!Number.isFinite(f.z) || f.z <= -0.9 || f.z > 50))
    h.fail('focus.z must be above -0.9 and at most 50');
  if (
    f.aperture != null &&
    !(Number.isFinite(f.aperture) && f.aperture >= 0 && f.aperture <= 3)
  )
    h.fail('focus.aperture must be 0–3 (1 is a natural depth of field)');
  if (f.keys != null) f.keys = depthKeys(f.keys, 'focus.keys', h.fail);
}

export function applyTreatments(
  p: BlockProps,
  h: PropHelpers,
  elements: CanvasElement[],
): void {
  if (p.rough != null && p.rough !== false)
    applyRough(elements, roughSpec(p.rough, 'rough', h.fail));
  delete p.rough;
  if (p.mosaic != null && p.mosaic !== false)
    applyMosaic(elements, mosaicSpec(p.mosaic, 'mosaic', h.fail));
  delete p.mosaic;
  applyPrint(
    elements,
    p.print != null && p.print !== false
      ? printSpec(p.print, 'print', h.fail)
      : null,
  );
  delete p.print;
}
