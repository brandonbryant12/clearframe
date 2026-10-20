import type { Quadrant } from '../../phase-data.mjs';
import type { PhaseDrawingPoint } from '../scene-types.mjs';

export function phaseState(
  focus: PhaseDrawingPoint,
  quadrants: Record<Quadrant, string>,
): string {
  if (!focus.valid) return 'Incomplete pair; no plotted point';
  if (focus.quadrant) return quadrants[focus.quadrant];
  if (focus.boundary === 'both-references') return 'On both references';
  return focus.boundary === 'x-reference'
    ? 'On the x reference'
    : 'On the y reference';
}
