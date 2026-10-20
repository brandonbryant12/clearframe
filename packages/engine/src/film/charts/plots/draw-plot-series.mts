import {
  axisPosition,
  type AxisValue,
  type ObservedPoint,
  type PlotSeries,
  type PlotSpec,
  type PlotMotion,
} from '../../plot-data.mjs';
import type { CanvasElement, ElementFields } from '../../types.mjs';
import { colors, DOT_LIMIT } from './primitives.mjs';
import { plotArea } from './plot-area.mjs';
import { plotSegments } from './plot-segments.mjs';
import { check } from './check.mjs';

export function drawPlotSeries({
  seriesIndex,
  s,
  p,
  elements,
  px,
  bottom,
  py,
  arrive,
  end,
  time,
  strokeWidth,
  motion,
  terminals,
}: DrawPlotSeriesContext) {
  const color = colors[seriesIndex],
    dots = s.values.filter((v) => v.y !== null).length <= DOT_LIMIT;
  // Optional soft area under the first series: one closed polygon per unbroken run.
  plotArea({ p, seriesIndex, elements, s, px, bottom, py, color, arrive, end });
  plotSegments({ s, px, py, time, elements, color, strokeWidth, motion, dots });
  const terminal = s.values.findLast((v): v is ObservedPoint => v.y !== null);
  check(terminal, 'an all-missing series has no drawable evidence');
  terminals.push({
    s,
    color,
    terminal,
    x: px(terminal.x),
    y: py(terminal.y),
    labelled: axisPosition(terminal.x, p.x) > 0.999,
  });
}

export interface DrawPlotSeriesContext {
  seriesIndex: number;
  s: PlotSeries;
  p: PlotSpec;
  elements: CanvasElement[];
  px: (x: AxisValue) => number;
  bottom: number;
  py: (y: AxisValue) => number;
  arrive: (at: number) => ElementFields;
  end: number;
  time: (x: AxisValue) => number;
  strokeWidth: number;
  motion: 'none' | PlotMotion;
  terminals: {
    s: PlotSeries;
    color: string;
    terminal: ObservedPoint;
    x: number;
    y: number;
    labelled: boolean;
  }[];
}
