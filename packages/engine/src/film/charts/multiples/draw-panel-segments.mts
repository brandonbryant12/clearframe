import {
  type AxisValue,
  type ObservedPoint,
  type PlotMotion,
  type PlotSeries,
} from '../../plot-data.mjs';

import type { CanvasElement } from '../../types.mjs';
import { show } from './primitives.mjs';

export function drawPanelSegments({
  s,
  last,
  elements,
  id,
  px,
  py,
  dim,
  color,
  stroke,
  motion,
  time,
}: DrawPanelSegmentsContext) {
  for (const [i, v] of s.values.entries()) {
    if (v.y === null) {
      last = null;
      continue;
    }
    if (last)
      elements.push({
        id: `${id}-segment-${i}`,
        type: 'line',
        x1: px(last.x),
        y1: py(last.y),
        x2: px(v.x),
        y2: py(v.y),
        stroke: dim ? 'muted' : color,
        width: stroke,
        cap: 'round',
        ...(motion === 'none'
          ? show
          : {
              at: time(last.x),
              dur: time(v.x) - time(last.x),
              enter: 'draw',
              drawEase: 'linear',
            }),
      });
    last = v;
  }
  return last;
}

export interface DrawPanelSegmentsContext {
  s: PlotSeries;
  last: ObservedPoint | null;
  elements: CanvasElement[];
  id: string;
  px: (x: AxisValue) => number;
  py: (y: AxisValue) => number;
  dim: boolean;
  color: string;
  stroke: number;
  motion: 'none' | PlotMotion;
  time: (x: AxisValue) => number;
}
