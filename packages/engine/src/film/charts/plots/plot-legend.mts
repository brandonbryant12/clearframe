import { type PlotSpec } from '../../plot-data.mjs';
import type { CanvasElement } from '../../types.mjs';
import type { PlotLayout } from './contracts.mjs';
import { titleShift, line, colors, text } from './primitives.mjs';

export function plotLegend(
  L: PlotLayout,
  p: PlotSpec,
  contentWidth: number,
  elements: CanvasElement[],
) {
  const perRow =
    L.orientation === 'landscape'
      ? p.series.length
      : Math.min(2, p.series.length);
  const column = contentWidth / Math.max(perRow, 1),
    K = L.keyType;
  for (const [i, s] of p.series.entries()) {
    const x = L.margin + (i % perRow) * column,
      y =
        L.keyY +
        titleShift(p.title, L, contentWidth) +
        Math.floor(i / perRow) * K * 1.6;
    elements.push(
      line(`plot-${s.id}-key`, x, y - K * 0.32, x + K * 1.1, y - K * 0.32, {
        stroke: colors[i],
        width: K * 0.16,
        cap: 'round',
      }),
      text(`plot-${s.id}-label`, s.label, x + K * 1.45, y, K, {
        font: 'semibold',
        fill: colors[i],
        fit: column - K * 1.9,
      }),
    );
  }
}
