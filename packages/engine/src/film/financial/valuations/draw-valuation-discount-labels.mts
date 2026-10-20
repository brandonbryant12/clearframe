import type { valuationGrid } from '../../valuation-data.mjs';
import { text } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';
import { check } from './check.mjs';

export function drawValuationDiscountLabels({
  m,
  px,
  xEdges,
  rate,
  elements,
  id,
  top,
  size,
}: DrawValuationDiscountLabelsContext) {
  for (const [i, v] of m.discountRates.entries()) {
    const fit =
      2 * Math.min(px(v) - px(xEdges[i]), px(xEdges[i + 1]) - px(v)) * 0.9;
    check(
      fit >= rate(v).length * 28 * 0.65,
      'discount labels too close at this frame size',
    );
    elements.push(
      text(`${id}-x-${i}`, rate(v), px(v), top - size * 0.8, size, {
        anchor: 'middle',
        font: 'figures',
        fit,
      }),
    );
  }
}

export interface DrawValuationDiscountLabelsContext {
  m: ReturnType<typeof valuationGrid>;
  px: (v: number) => number;
  xEdges: number[];
  rate: (v: number) => string;
  elements: CanvasElement[];
  id: string;
  top: number;
  size: number;
}
