import type { CanvasElement } from './types.mjs';
import type { Indexed, PlacedStep } from './pointer-contracts.mjs';

import { box } from './pointer-targets.mjs';
export function placeSteps(
  p: CanvasElement,
  ids: Map<string, Indexed>,
): PlacedStep[] {
  return (
    p.steps ?? [
      { to: p.to, say: p.say, at: p.at, press: p.press, point: p.point },
    ]
  ).map((s): PlacedStep => {
    const target = typeof s.to === 'string' ? ids.get(s.to) : null;
    if (typeof s.to === 'string' && !target)
      throw new Error(
        `pointer: no element has id "${s.to}" (give the button or field an id)`,
      );
    const b = target ? box(target) : null;
    // The tip rests at the lower right of the target's middle, so the arrow never covers its label.
    const [fx, fy] = s.point ?? [0.66, 0.68];
    let spot = Array.isArray(s.to) ? s.to : null;
    if (b) spot = [b.x + b.w * fx, b.y + b.h * fy];
    if (!spot)
      throw new Error(
        `pointer: "${String(s.to)}" has no box to point at (point at a rect, a card or a group)`,
      );
    return { ...s, target, spot, press: s.press ?? true };
  });
}
