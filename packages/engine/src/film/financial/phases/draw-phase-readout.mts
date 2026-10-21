import type { PhaseDrawingPoint, Point } from '../scene-types.mjs';

import { show, text } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';
import { readoutTiming } from './readout-timing.mjs';

export function drawPhaseReadout({
  h,
  tall,
  left,
  margin,
  right,
  copyWidth,
  view,
  points,
  reveal,
  elements,
  id,
  small,
  located,
  r,
}: DrawPhaseReadoutContext) {
  const readoutY = h * (tall ? 0.735 : 0.59),
    readoutX = tall ? left : margin,
    readoutWidth = tall ? right - left : copyWidth;
  if (view === 'trail')
    for (const [i, p] of points.entries()) {
      const timing = readoutTiming(p.at, reveal, i, points);
      elements.push(
        text(
          `${id}-current-${i}`,
          `${p.valid ? 'Observation' : 'Missing pair'}: ${p.date}`,
          readoutX,
          readoutY,
          small,
          { font: 'figures', fit: readoutWidth, ...timing },
        ),
      );
      if (p.valid)
        elements.push({
          id: `${id}-current-ring-${i}`,
          type: 'circle',
          cx: located(p)[0],
          cy: located(p)[1],
          r: r * 1.65,
          fill: 'none',
          stroke: 'ink',
          width: 3,
          ...show,
          ...timing,
        });
    }
  else
    elements.push(
      text(
        id + '-selection-caption',
        'Outlined marks identify the selected date',
        readoutX,
        readoutY,
        small,
        {
          ...(tall
            ? { fit: readoutWidth }
            : { width: readoutWidth, height: h * 0.1 }),
        },
      ),
    );
}

export interface DrawPhaseReadoutContext {
  h: number;
  tall: boolean;
  left: number;
  margin: number;
  right: number;
  copyWidth: number;
  view: string;
  points: PhaseDrawingPoint[];
  reveal: boolean;
  elements: CanvasElement[];
  id: string;
  small: number;
  located: (p: PhaseDrawingPoint) => Point;
  r: number;
}
