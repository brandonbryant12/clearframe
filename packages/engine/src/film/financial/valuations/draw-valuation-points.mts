import { edgeAnchor, show, text, line } from '../drawing.mjs';
import type { CashFlowTerm, valuationGrid } from '../../valuation-data.mjs';
import type { ValuationGeometry, PreviousPoint } from '../scene-types.mjs';
import { required } from '../validation.mjs';
import type { CanvasElement } from '../../types.mjs';

export function drawValuationPoints({
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
}: DrawValuationPointsContext) {
  for (const [i, c] of points.entries()) {
    const at = reveal ? 0.6 + (3.4 * (c.x - xmin)) / (xmax - xmin) : 0;
    elements.push(
      text(`${id}-x-${i}`, rate(c.x), px(c.x), bottom + size * 1.3, size, {
        anchor: edgeAnchor(i, points.length - 1 + 1),
        font: 'figures',
        fit: ((right - left) / (points.length - 1)) * 0.85,
      }),
    );
    if (!c.valid) {
      prev = null;
      geometry.points.push({ ...c, point: null, at });
      continue;
    }
    const x = px(c.x),
      y = py(required(c.value, 'valuation scene: valid point has no value')),
      selected =
        c.growth === m.selected.growth && c.discount === m.selected.discount;
    if (prev) {
      elements.push(
        line(`${id}-segment-${i}`, prev.x, prev.y, x, y, {
          stroke: 'accent',
          width: w * 0.0025,
          ...(reveal
            ? {
                at: prev.at,
                enter: 'draw',
                dur: at - prev.at,
                drawEase: 'linear',
              }
            : {}),
        }),
      );
      geometry.segments.push({
        p1: [prev.x, prev.y],
        p2: [x, y],
        at: prev.at,
        end: at,
      });
    }
    markers.push({
      id: `${id}-point-${i}`,
      type: 'circle',
      cx: x,
      cy: y,
      r: w * 0.006,
      fill: 'accent',
      stroke: selected ? 'ink' : 'accent',
      width: selected ? 3 : 1,
      ...show,
      at,
    });
    geometry.points.push({ ...c, point: [x, y], selected, at });
    prev = { x, y, at };
  }
  return prev;
}

export interface DrawValuationPointsContext {
  points: {
    x: number;
    row: number;
    column: number;
    growth: number;
    discount: number;
    valid: boolean;
    reason: 'discount-not-above-growth' | null;
    presentValue: number | null;
    initialOutlay: number;
    value: number | null;
    terms: CashFlowTerm[];
  }[];
  reveal: boolean;
  xmin: number;
  xmax: number;
  elements: CanvasElement[];
  id: string;
  rate: (v: number) => string;
  px: (v: number) => number;
  bottom: number;
  size: number;
  right: number;
  left: number;
  prev: PreviousPoint | null;
  geometry: ValuationGeometry;
  py: (v: number) => number;
  m: ReturnType<typeof valuationGrid>;
  w: number;
  markers: CanvasElement[];
}
