import {
  type AxisValue,
  type ObservedPoint,
  type PlotSeries,
  type PlotSpec,
} from '../../plot-data.mjs';
import type { CanvasElement, ElementFields } from '../../types.mjs';

export function plotArea({
  p,
  seriesIndex,
  elements,
  s,
  px,
  bottom,
  py,
  color,
  arrive,
  end,
}: PlotAreaContext) {
  if (p.area && seriesIndex === 0) {
    let run: ObservedPoint[] = [];
    const flush = (k: number | string): void => {
      if (run.length > 1)
        elements.push({
          id: `plot-${s.id}-area-${k}`,
          type: 'poly',
          closed: true,
          points: [
            [px(run[0].x), bottom],
            ...run.map((v) => [px(v.x), py(v.y)]),
            [px(run[run.length - 1].x), bottom],
          ],
          fill: { gradient: [color, 'bg'], angle: 90, fade: true },
          opacity: 0.35,
          ...arrive(end),
        });
      run = [];
    };
    s.values.forEach((v, k) => {
      if (v.y === null) flush(k);
      else run.push(v);
    });
    flush('end');
  }
}

export interface PlotAreaContext {
  p: PlotSpec;
  seriesIndex: number;
  elements: CanvasElement[];
  s: PlotSeries;
  px: (x: AxisValue) => number;
  bottom: number;
  py: (y: AxisValue) => number;
  color: string;
  arrive: (at: number) => ElementFields;
  end: number;
}
