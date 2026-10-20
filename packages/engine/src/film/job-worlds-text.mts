import type { Timing } from '../engine/domain.mjs';
import type { JobBeat, CanvasElement } from './types.mjs';

import { elementsExtent } from './canvas.mjs';

export function worldText(
  el: CanvasElement,
  b: JobBeat,
  v: number[],
  timing: Timing,
  warnings: string[],
): void {
  const e = elementsExtent([el]);
  // Cut by the edge of the shot. (Wholly outside it is off-shot on purpose: a close-up on one
  // bar of a chart the beat draws whole.)
  const inside =
    e &&
    e.left < v[0] + v[2] &&
    e.left + e.w > v[0] &&
    e.top < v[1] + v[3] &&
    e.bottom > v[1];
  if (
    inside &&
    (e.left < v[0] ||
      e.top < v[1] ||
      e.left + e.w > v[0] + v[2] ||
      e.bottom > v[1] + v[3])
  )
    warnings.push(
      `${b.id}: text "${String(el.text).slice(0, 30)}" reaches outside this beat's camera view.`,
    );
  // Through the camera, a label's size on screen is its size times the zoom.
  const zoom =
    Math.min(timing.width / v[2], timing.height / v[3]) *
    (1080 / Math.min(timing.width, timing.height));
  const px = (el.size ?? 48) * zoom;
  if (px < 22)
    warnings.push(
      `${b.id}: text "${String(el.text).slice(0, 30)}" renders at about ${Math.round(px)} px; make it at least ${Math.ceil(22 / zoom)} in world units.`,
    );
}
