import type { valuationGrid } from '../../valuation-data.mjs';
import { text } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';

export function drawValuationHeader({
  elements,
  id,
  m,
  margin,
  h,
  tall,
  w,
  terminal,
  fixed,
  value,
}: DrawValuationHeaderContext) {
  elements.push(
    text(
      id + '-title',
      m.title,
      margin,
      h * (tall ? 0.09 : 0.115),
      w * (tall ? 0.047 : 0.034),
      { font: 'display', width: w - 2 * margin, height: h * 0.08 },
    ),
    text(
      id + '-basis',
      `Base annual flow ${m.cashFlowNow} · outlay ${m.initialOutlay} ${m.unit}`,
      margin,
      h * (tall ? 0.16 : 0.205),
      w * (tall ? 0.03 : 0.024),
      { font: 'figures', fit: w - 2 * margin },
    ),
    text(
      id + '-terminal',
      terminal,
      margin,
      h * (tall ? 0.21 : 0.27),
      w * (tall ? 0.028 : 0.021),
      { fit: w - 2 * margin },
    ),
    text(
      id + '-fixed',
      `${fixed} · selected ${value(m.selected.value)} ${m.unit}`,
      margin,
      h * (tall ? 0.265 : 0.33),
      w * (tall ? 0.031 : 0.024),
      { font: 'figures', fit: w - 2 * margin },
    ),
  );
}

export interface DrawValuationHeaderContext {
  elements: CanvasElement[];
  id: string;
  m: ReturnType<typeof valuationGrid>;
  margin: number;
  h: number;
  tall: boolean;
  w: number;
  terminal: string;
  fixed: string;
  value: (v: number | null) => string;
}
