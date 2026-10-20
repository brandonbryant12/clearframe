import type { PhaseDrawingPoint } from '../scene-types.mjs';

import type { CanvasElement } from '../../types.mjs';

export function readoutTiming(
  at: number,
  reveal: boolean,
  index: number,
  points: PhaseDrawingPoint[],
): Partial<CanvasElement> {
  if (index >= points.length - 1) return { at };
  return { at, exit: 'none', exitAt: reveal ? points[index + 1].at : 0 };
}
