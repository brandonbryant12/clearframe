import { finite } from './guards.mjs';
import type { CanvasElement, Fail } from './types.mjs';

import { COLOR_TOKENS } from './canvas-catalog.mjs';

import { shineSpec, materialSpec, isColor } from './canvas-material.mjs';

export function checkSurface(el: CanvasElement, at: string, fail: Fail): void {
  if (el.shine != null) el.shine = shineSpec(el.shine, `${at}.shine`, fail);

  if (
    el.tilt != null &&
    (!Array.isArray(el.tilt) ||
      el.tilt.length !== 2 ||
      el.tilt.some((v) => !finite(v)))
  )
    fail(
      `${at}.tilt must be [x, y] degrees: the plane turned about its horizontal and vertical axes`,
    );

  if (el.material != null) materialSpec(el.material, `${at}.material`, fail);

  for (const key of ['fill', 'stroke'] as const) {
    const v = el[key];
    if (v == null || isColor(v)) continue;
    if (
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Array.isArray(v.gradient) &&
      v.gradient.length >= 2 &&
      v.gradient.length <= 4 &&
      v.gradient.every((c) => isColor(c) && c !== 'none') &&
      Object.keys(v).every((k) =>
        ['gradient', 'angle', 'radial', 'fade'].includes(k),
      )
    )
      continue;
    fail(
      `${at}.${key} must be a palette token (${COLOR_TOKENS.join(', ')}), #rrggbb, or {gradient:[2–4 colors], angle, radial, fade}`,
    );
  }
}
