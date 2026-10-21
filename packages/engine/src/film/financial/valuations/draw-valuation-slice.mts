import type { ValuationGeometry, PreviousPoint } from '../scene-types.mjs';
import type { valuationGrid } from '../../valuation-data.mjs';
import { text, line } from '../drawing.mjs';
import { required } from '../validation.mjs';
import type { CanvasElement } from '../../types.mjs';
import { check } from './check.mjs';
import { drawValuationPoints } from './draw-valuation-points.mjs';

export function drawValuationSlice({
  w,
  h,
  tall,
  m,
  elements,
  id,
  margin,
  size,
  rate,
  reveal,
  geometry,
}: DrawValuationSliceContext) {
  const left = w * 0.2,
    right = w * 0.89,
    top = h * (tall ? 0.36 : 0.405),
    bottom = h * (tall ? 0.72 : 0.745),
    points = m.slice.points,
    xmin = points[0].x,
    xmax = required(points.at(-1), 'valuation scene: missing grid endpoint').x,
    px = (v: number) => left + ((v - xmin) / (xmax - xmin)) * (right - left),
    py = (v: number) =>
      bottom -
      ((v - m.scale.min) / (m.scale.max - m.scale.min)) * (bottom - top),
    markers: CanvasElement[] = [];
  let prev: PreviousPoint | null = null;
  elements.push(
    text(
      id + '-y-name',
      `${m.unit} net present value`,
      margin,
      top - size * 0.6,
      size,
      { fit: w - 2 * margin },
    ),
  );
  check(
    m.scale.ticks.every(
      (v, i) => !i || py(m.scale.ticks[i - 1]) - py(v) >= size * 1.4,
    ),
    'value ticks too close at this frame size',
  );
  for (const [i, v] of m.scale.ticks.entries())
    elements.push(
      line(`${id}-grid-${i}`, left, py(v), right, py(v), {
        stroke: v === 0 ? 'muted' : 'line',
        width: v === 0 ? 2 : 1,
      }),
      text(
        `${id}-y-${i}`,
        String(v),
        left - size * 0.4,
        py(v) + size * 0.3,
        size,
        { anchor: 'end', font: 'figures', fit: left - margin - size * 0.6 },
      ),
    );
  check(
    points.every(
      (c, i) =>
        !i ||
        px(c.x) - px(points[i - 1].x) >=
          size * 0.65 * (rate(c.x).length + rate(points[i - 1].x).length),
    ),
    'slice rate labels too close at this frame size',
  );
  prev = drawValuationPoints({
    points,
    reveal,
    xmin,
    xmax,
    elements,
    id,
    rate,
    px,
    bottom,
    size,
    right,
    left,
    prev,
    geometry,
    py,
    m,
    w,
    markers,
  });
  elements.push(
    ...markers,
    text(
      id + '-x-name',
      `${m.slice.vary === 'discount' ? 'Discount' : 'Growth'} rate`,
      right,
      bottom + size * 2.7,
      size,
      { anchor: 'end' },
    ),
    text(
      id + '-limit',
      'Evaluated points · connecting lines are guides',
      margin,
      h * (tall ? 0.82 : 0.86),
      w * (tall ? 0.028 : 0.021),
      { fit: w - 2 * margin },
    ),
    text(
      id + '-invalid',
      m.terminal.kind === 'growing-perpetuity'
        ? 'Perpetuity requires discount > growth'
        : 'Finite horizon; no perpetual-growth restriction',
      margin,
      h * (tall ? 0.86 : 0.9),
      w * (tall ? 0.027 : 0.02),
      { fit: w - 2 * margin },
    ),
  );
}

export interface DrawValuationSliceContext {
  w: number;
  h: number;
  tall: boolean;
  m: ReturnType<typeof valuationGrid>;
  elements: CanvasElement[];
  id: string;
  margin: number;
  size: number;
  rate: (v: number) => string;
  reveal: boolean;
  geometry: ValuationGeometry;
}
