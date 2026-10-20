import type { CanvasElement, ElementKey } from './types.mjs';
import type { Indexed } from './pointer-contracts.mjs';

import { placeSteps } from './pointer-place.mjs';
export function pointerContext(
  p: CanvasElement,
  ids: Map<string, Indexed>,
  width: number,
  height: number,
) {
  const steps = placeSteps(p, ids);
  const touch = (p.style ?? (height > width ? 'touch' : 'arrow')) === 'touch';
  const size = p.size ?? (touch ? 64 : 46) * (Math.min(width, height) / 1080);
  // It comes in from below and to the right of where it is going, as a hand does, inside the frame.
  const first = steps[0].spot;
  const from = p.from ?? [
    Math.min(width - size * 1.5, first[0] + width * 0.12),
    Math.min(height - size * 1.6, first[1] + height * 0.16),
  ];
  // The outer group's keys carry x and the inner group's y, with different easing, so the
  // cursor travels on a gentle curve rather than a ruler line.
  const xs: ElementKey[] = [],
    ys: ElementKey[] = [],
    press: ElementKey[] = [],
    ripple: ElementKey[] = [];
  return { p, steps, touch, size, from, width, height, xs, ys, press, ripple };
}
