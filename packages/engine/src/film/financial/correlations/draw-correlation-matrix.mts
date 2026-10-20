import type { PlotSpec } from '../../plot-data.mjs';
import type { CorrelationGeometry } from '../scene-types.mjs';
import type { correlationMatrix } from '../../correlation-data.mjs';

import { show, text } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';
import { drawCorrelationCells } from './draw-correlation-cells.mjs';
import { correlationColor } from './correlation-color.mjs';

export function drawCorrelationMatrix({
  w,
  tall,
  n,
  h,
  p,
  elements,
  id,
  size,
  margin,
  model,
  reveal,
  selectedPair,
  geometry,
}: DrawCorrelationMatrixContext) {
  const step = Math.min(
      (w * (tall ? 0.59 : 0.48)) / n,
      (h * (tall ? 0.36 : 0.44)) / n,
    ),
    stepX = tall ? step : (w * 0.48) / n,
    left = tall ? w * 0.305 : (w - stepX * n) / 2 + w * 0.055,
    top = h * (tall ? 0.315 : 0.34),
    inset = 4;
  for (const [i, s] of p.series.entries()) {
    elements.push(
      text(
        `${id}-column-${s.id}`,
        s.label,
        left + (i + 0.5) * stepX,
        top - size * 0.65,
        size,
        { anchor: 'middle', font: 'semibold', fit: stepX * 0.94 },
      ),
      text(
        `${id}-row-${s.id}`,
        s.label,
        left - size * 0.4,
        top + (i + 0.5) * step + size * 0.35,
        size,
        { anchor: 'end', font: 'semibold', fit: left - margin - size * 0.6 },
      ),
    );
  }
  drawCorrelationCells({
    model,
    left,
    stepX,
    top,
    step,
    reveal,
    selectedPair,
    id,
    inset,
    elements,
    tall,
    geometry,
  });
  const legendY = top + n * step + size * 1.2,
    legendWidth = stepX * n;
  for (const [i, r] of [-1, 0, 1].entries()) {
    const x = left + (i * legendWidth) / 3;
    elements.push(
      {
        id: `${id}-legend-${i}`,
        type: 'rect',
        x,
        y: legendY - size * 0.65,
        w: size * 0.7,
        h: size * 0.7,
        fill: correlationColor(r),
        ...show,
      },
      text(
        `${id}-legend-label-${i}`,
        r > 0 ? '+1' : String(r),
        x + size,
        size * 0.1 + legendY,
        size,
        { font: 'figures' },
      ),
    );
  }
  elements.push(
    text(
      id + '-limit',
      'Pairwise complete · — undefined · no causality',
      margin,
      h * (tall ? 0.8 : 0.87),
      w * (tall ? 0.03 : 0.022),
      { fit: w - 2 * margin },
    ),
  );
}

export interface DrawCorrelationMatrixContext {
  w: number;
  tall: boolean;
  n: number;
  h: number;
  p: PlotSpec;
  elements: CanvasElement[];
  id: string;
  size: number;
  margin: number;
  model: ReturnType<typeof correlationMatrix>;
  reveal: boolean;
  selectedPair: [string, string];
  geometry: CorrelationGeometry;
}
