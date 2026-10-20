import type { ValuationGeometry } from '../scene-types.mjs';
import type { valuationGrid } from '../../valuation-data.mjs';
import { show, text } from '../drawing.mjs';
import { required } from '../validation.mjs';
import type { CanvasElement } from '../../types.mjs';
import { gridEdges } from './grid-edges.mjs';
import { drawValuationDiscountLabels } from './draw-valuation-discount-labels.mjs';
import { check } from './check.mjs';
import { drawValuationCells } from './draw-valuation-cells.mjs';
import { valuationColor } from './valuation-color.mjs';

export function drawValuationGrid({
  m,
  w,
  tall,
  h,
  elements,
  id,
  size,
  margin,
  rate,
  reveal,
  value,
  geometry,
}: DrawValuationGridContext) {
  const xEdges = gridEdges(m.discountRates),
    yEdges = gridEdges(m.growthRates),
    left = w * (tall ? 0.25 : 0.26),
    right = w * (tall ? 0.89 : 0.84),
    top = h * (tall ? 0.375 : 0.44),
    bottom = h * (tall ? 0.66 : 0.72),
    px = (v: number) =>
      left +
      ((v - xEdges[0]) /
        (required(xEdges.at(-1), 'valuation scene: missing grid endpoint') -
          xEdges[0])) *
        (right - left),
    py = (v: number) =>
      top +
      ((v - yEdges[0]) /
        (required(yEdges.at(-1), 'valuation scene: missing grid endpoint') -
          yEdges[0])) *
        (bottom - top);
  elements.push(
    text(
      id + '-x-name',
      'Discount rate',
      right,
      h * (tall ? 0.31 : 0.37),
      size,
      { anchor: 'end' },
    ),
    text(id + '-y-name', 'Growth', margin, top - size * 0.8, size, {
      fit: left - margin - size * 0.6,
    }),
  );
  drawValuationDiscountLabels({ m, px, xEdges, rate, elements, id, top, size });
  check(
    m.growthRates.every(
      (v, i) => !i || py(v) - py(m.growthRates[i - 1]) >= size * 1.4,
    ),
    'growth labels too close at this frame size',
  );
  for (const [i, v] of m.growthRates.entries())
    elements.push(
      text(
        `${id}-y-${i}`,
        rate(v),
        left - size * 0.4,
        py(v) + size * 0.3,
        size,
        { anchor: 'end', font: 'figures', fit: left - margin - size * 0.6 },
      ),
    );
  drawValuationCells({
    m,
    px,
    xEdges,
    py,
    yEdges,
    reveal,
    elements,
    id,
    value,
    geometry,
  });
  const legend =
      m.scale.min < 0 && m.scale.max > 0
        ? [m.scale.min, 0, m.scale.max]
        : [m.scale.min, (m.scale.min + m.scale.max) / 2, m.scale.max],
    ly = h * (tall ? 0.72 : 0.8),
    lx = margin,
    step = (w - 2 * margin) / 3;
  for (const [i, v] of legend.entries()) {
    const x = lx + i * step;
    elements.push(
      {
        id: `${id}-legend-${i}`,
        type: 'rect',
        x,
        y: ly - size * 0.7,
        w: size * 0.65,
        h: size * 0.65,
        fill: valuationColor(v, m.scale),
        ...show,
      },
      text(`${id}-legend-value-${i}`, value(v), x + size, ly, size, {
        font: 'figures',
        fit: step - size,
      }),
    );
  }
  elements.push(
    text(
      id + '-unit',
      `${m.unit} net present value · ${m.scale.decimals} decimals`,
      margin,
      h * (tall ? 0.765 : 0.855),
      w * (tall ? 0.028 : 0.021),
      { fit: w - 2 * margin },
    ),
    text(
      id + '-limit',
      m.terminal.kind === 'growing-perpetuity'
        ? 'Sampled cases · — means discount ≤ growth'
        : 'Sampled cases · finite horizon, no terminal value',
      margin,
      h * (tall ? 0.825 : 0.9),
      w * (tall ? 0.027 : 0.02),
      { fit: w - 2 * margin },
    ),
  );
}

export interface DrawValuationGridContext {
  m: ReturnType<typeof valuationGrid>;
  w: number;
  tall: boolean;
  h: number;
  elements: CanvasElement[];
  id: string;
  size: number;
  margin: number;
  rate: (v: number) => string;
  reveal: boolean;
  value: (v: number | null) => string;
  geometry: ValuationGeometry;
}
