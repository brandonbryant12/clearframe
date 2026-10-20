import {
  type AxisValue,
  type ObservedPoint,
  type PlotSpec,
} from '../../plot-data.mjs';
import type { CanvasElement, ElementFields } from '../../types.mjs';
import { check } from './check.mjs';
import { line, text } from './primitives.mjs';

export function plotAnnotation({
  p,
  px,
  py,
  right,
  left,
  bottom,
  top,
  u,
  arrive,
  time,
  begin,
  elements,
  font,
  strokeWidth,
}: PlotAnnotationContext) {
  if (p.annotation) {
    const a = p.annotation,
      point = p.series
        .find((s) => s.id === a.seriesId)
        ?.values.find((v): v is ObservedPoint => v.x === a.x && v.y !== null);
    check(point, 'annotation must point to an actual nonmissing observation');
    const x = px(point.x),
      y = py(point.y),
      tx = x + a.dx * (right - left),
      ty = y + a.dy * (bottom - top);
    check(
      tx >= left && tx <= right && ty >= top && ty <= bottom,
      'annotation offsets must keep the label anchor inside the plot',
    );
    const anchor = a.dx < 0 ? 'end' : 'start',
      fit = a.dx < 0 ? tx - left : right - tx;
    check(fit >= u * 0.14, 'annotation needs a wider clear text region');
    const at = arrive(Math.max(time(point.x), begin) + 0.2);
    elements.push(
      line('plot-annotation-leader', x, y, tx, ty - font * 0.45, {
        stroke: 'muted',
        width: 1.5,
        ...at,
      }),
      {
        id: 'plot-annotation-point',
        type: 'circle',
        cx: x,
        cy: y,
        r: strokeWidth * 2.6,
        fill: 'none',
        stroke: 'ink',
        width: 2,
        ...at,
      },
      text('plot-annotation-text', a.label, tx, ty, font * 1.1, {
        anchor,
        fit,
        font: 'semibold',
        ...at,
      }),
    );
  }
}

export interface PlotAnnotationContext {
  p: PlotSpec;
  px: (x: AxisValue) => number;
  py: (y: AxisValue) => number;
  right: number;
  left: number;
  bottom: number;
  top: number;
  u: number;
  arrive: (at: number) => ElementFields;
  time: (x: AxisValue) => number;
  begin: number;
  elements: CanvasElement[];
  font: number;
  strokeWidth: number;
}
