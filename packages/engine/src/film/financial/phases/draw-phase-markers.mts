import type {
  PhaseGeometry,
  PhaseDrawingPoint,
  Point,
} from '../scene-types.mjs';
import type { phaseTrail } from '../../phase-data.mjs';
import { show } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';

export function drawPhaseMarkers({
  points,
  geometry,
  elements,
  id,
  located,
  r,
  view,
  m,
}: DrawPhaseMarkersContext) {
  for (const p of points) {
    geometry.points.push(p);
    if (p.valid)
      elements.push({
        id: `${id}-point-${p.index}`,
        type: 'circle',
        cx: located(p)[0],
        cy: located(p)[1],
        r,
        fill: view === 'focus' && p.date !== m.focus.date ? 'muted' : 'accent',
        stroke: 'bg',
        width: 2,
        ...show,
        at: p.at,
      });
  }
}

export interface DrawPhaseMarkersContext {
  points: PhaseDrawingPoint[];
  geometry: PhaseGeometry;
  elements: CanvasElement[];
  id: string;
  located: (p: PhaseDrawingPoint) => Point;
  r: number;
  view: string;
  m: ReturnType<typeof phaseTrail>;
}
