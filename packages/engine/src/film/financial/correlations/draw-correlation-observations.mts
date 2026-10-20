import type {
  CorrelationCell,
  correlationMatrix,
} from '../../correlation-data.mjs';
import type { AxisValue, PlotSeries } from '../../plot-data.mjs';
import type {
  CorrelationGeometry,
  PreviousCorrelationPoint,
} from '../scene-types.mjs';
import { axisPosition } from '../../plot-data.mjs';
import { show, line } from '../drawing.mjs';
import { required } from '../validation.mjs';
import type { CanvasElement } from '../../types.mjs';

export function drawCorrelationObservations({
  model,
  s,
  reveal,
  xAxis,
  cell,
  prev,
  geometry,
  sid,
  id,
  px,
  py,
  color,
  w,
  children,
  x,
  y,
  markers,
}: DrawCorrelationObservationsContext) {
  for (const [j, d] of model.months.entries()) {
    const value = required(
        s.values.find((v) => v.x === d),
        'correlation scene: missing series observation',
      ).y,
      at = reveal ? 0.6 + 3.4 * axisPosition(d, xAxis) : 0,
      paired = cell.dates.includes(d);
    if (value === null) {
      prev = null;
      geometry.points.push({
        seriesId: sid,
        index: j,
        date: d,
        value,
        paired,
        point: null,
      });
      continue;
    }
    if (prev) {
      const segment = line(
        `${id}-${sid}-segment-${j}`,
        px(prev.date),
        py(prev.value),
        px(d),
        py(value),
        {
          stroke: color,
          width: w * 0.0025,
          ...(reveal
            ? {
                at: prev.at,
                enter: 'draw',
                dur: at - prev.at,
                drawEase: 'linear',
              }
            : {}),
        },
      );
      children.push(segment);
      geometry.segments.push({
        seriesId: sid,
        from: prev.date,
        to: d,
        p1: [x + px(prev.date), y + py(prev.value)],
        p2: [x + px(d), y + py(value)],
        at: prev.at,
        end: at,
      });
    }
    markers.push({
      id: `${id}-${sid}-point-${j}`,
      type: 'circle',
      cx: px(d),
      cy: py(value),
      r: w * 0.006,
      fill: paired ? color : 'bg',
      stroke: color,
      width: 2,
      ...show,
      at,
    });
    geometry.points.push({
      seriesId: sid,
      index: j,
      date: d,
      value,
      paired,
      point: [x + px(d), y + py(value)],
      at,
    });
    prev = { date: d, value, at };
  }
  return prev;
}

export interface DrawCorrelationObservationsContext {
  model: ReturnType<typeof correlationMatrix>;
  s: PlotSeries;
  reveal: boolean;
  xAxis: {
    domain: string[];
    ticks: string[];
    type: 'linear' | 'date' | 'log';
    label: string;
    decimals?: number;
    prefix?: string;
    suffix?: string;
    dateFormat?: string;
  };
  cell: CorrelationCell;
  prev: PreviousCorrelationPoint | null;
  geometry: CorrelationGeometry;
  sid: string;
  id: string;
  px: (d: AxisValue) => number;
  py: (v: AxisValue) => number;
  color: string;
  w: number;
  children: CanvasElement[];
  x: number;
  y: number;
  markers: CanvasElement[];
}
