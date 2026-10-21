import type {
  PhaseGeometry,
  PhaseDrawingPoint,
  Point,
} from '../scene-types.mjs';
import type { phaseTrail } from '../../phase-data.mjs';
import { line } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';

export function drawPhaseSegments({
  m,
  points,
  elements,
  id,
  located,
  view,
  w,
  reveal,
  geometry,
}: DrawPhaseSegmentsContext) {
  for (const s of m.segments) {
    const a = points[s.from],
      b = points[s.to];
    elements.push(
      line(`${id}-segment-${s.to}`, ...located(a), ...located(b), {
        stroke: view === 'focus' ? 'muted' : 'accent',
        width: w * 0.0025,
        ...(reveal && view === 'trail'
          ? { at: a.at, enter: 'draw', dur: b.at - a.at, drawEase: 'linear' }
          : {}),
      }),
    );
    geometry.segments.push({
      ...s,
      p1: located(a),
      p2: located(b),
      at: a.at,
      end: b.at,
    });
  }
}

export interface DrawPhaseSegmentsContext {
  m: ReturnType<typeof phaseTrail>;
  points: PhaseDrawingPoint[];
  elements: CanvasElement[];
  id: string;
  located: (p: PhaseDrawingPoint) => Point;
  view: string;
  w: number;
  reveal: boolean;
  geometry: PhaseGeometry;
}
