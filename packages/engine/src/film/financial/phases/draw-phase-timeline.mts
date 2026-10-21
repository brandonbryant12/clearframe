import type { PhaseGeometry, PhaseDrawingPoint } from '../scene-types.mjs';
import type { phaseTrail } from '../../phase-data.mjs';
import { show, text, line } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';
import { check } from './check.mjs';

export function drawPhaseTimeline({
  h,
  tall,
  left,
  right,
  small,
  points,
  r,
  elements,
  id,
  m,
  view,
  geometry,
}: DrawPhaseTimelineContext) {
  const ty = h * (tall ? 0.765 : 0.86),
    tl = left,
    tr = right,
    datesize = Math.max(28, small * 0.8);
  check(
    points.every(
      (p, i) => !i || (p.time - points[i - 1].time) * (tr - tl) >= r * 1.8 + 3,
    ),
    'dated strip marks overlap; use a shorter declared window',
  );
  elements.push(line(id + '-time-axis', tl, ty, tr, ty));
  if (tall)
    elements.push(
      text(id + '-time-start', m.dateSpan[0], tl, ty + small * 1.15, datesize, {
        font: 'figures',
      }),
      text(id + '-time-end', m.dateSpan[1], tr, ty + small * 1.15, datesize, {
        anchor: 'end',
        font: 'figures',
      }),
    );
  else
    elements.push(
      text(id + '-time-label', 'Dates →', left, ty + small * 0.9, datesize, {
        fit: small * 4,
      }),
    );
  for (const p of points) {
    const x = tl + p.time * (tr - tl),
      selected = view === 'focus' && p.date === m.focus.date;
    elements.push({
      id: `${id}-time-${p.index}`,
      type: 'circle',
      cx: x,
      cy: ty,
      r: r * 0.7,
      fill: p.valid ? 'accent' : 'bg',
      stroke: selected ? 'ink' : 'muted',
      width: selected ? 3 : 2,
      ...show,
      at: p.at,
    });
    geometry.timeline.push({
      index: p.index,
      point: [x, ty],
      valid: p.valid,
      selected,
      at: p.at,
    });
  }
}

export interface DrawPhaseTimelineContext {
  h: number;
  tall: boolean;
  left: number;
  right: number;
  small: number;
  points: PhaseDrawingPoint[];
  r: number;
  elements: CanvasElement[];
  id: string;
  m: ReturnType<typeof phaseTrail>;
  view: string;
  geometry: PhaseGeometry;
}
