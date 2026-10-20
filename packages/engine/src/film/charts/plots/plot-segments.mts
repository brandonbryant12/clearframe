import {
  type AxisValue,
  type ObservedPoint,
  type PlotSeries,
  type PlotMotion,
} from '../../plot-data.mjs';
import type { CanvasElement } from '../../types.mjs';
import { line, show } from './primitives.mjs';

export function plotSegments({
  s,
  px,
  py,
  time,
  elements,
  color,
  strokeWidth,
  motion,
  dots,
}: PlotSegmentsContext) {
  let last: ObservedPoint | null = null;
  for (const [i, v] of s.values.entries()) {
    if (v.y === null) {
      last = null;
      continue;
    }
    const x = px(v.x),
      y = py(v.y),
      at = time(v.x);
    if (last) {
      const start = time(last.x),
        duration = at - start;
      elements.push(
        line(`plot-${s.id}-segment-${i}`, px(last.x), py(last.y), x, y, {
          stroke: color,
          width: strokeWidth,
          cap: 'round',
          ...(motion === 'none'
            ? show
            : { at: start, dur: duration, enter: 'draw', drawEase: 'linear' }),
        }),
      );
    }
    // Dots mark observations on short series, including isolated points on either side of a gap.
    if (dots || (!last && s.values[i + 1]?.y == null))
      elements.push({
        id: `plot-${s.id}-point-${i}`,
        type: 'circle',
        cx: x,
        cy: y,
        r: strokeWidth * 1.15,
        fill: color,
        ...(motion === 'none' ? show : { at, enter: 'none' }),
      });
    last = v;
  }
}

export interface PlotSegmentsContext {
  s: PlotSeries;
  px: (x: AxisValue) => number;
  py: (y: AxisValue) => number;
  time: (x: AxisValue) => number;
  elements: CanvasElement[];
  color: string;
  strokeWidth: number;
  motion: 'none' | PlotMotion;
  dots: boolean;
}
