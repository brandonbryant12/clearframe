import type { CanvasElement } from '../../types.mjs';
import type { PlotLayout } from './contracts.mjs';
import { titleLines } from './title-lines.mjs';
import { text } from './primitives.mjs';

export function titleText(
  title: string,
  L: PlotLayout,
  width: number,
): CanvasElement {
  if (titleLines(title, L, width) === 1)
    return text('plot-title', title, L.margin, L.titleY, L.titleType, {
      fit: width,
      font: 'display',
    });
  return text('plot-title', title, L.margin, L.titleY, L.titleType, {
    width,
    height: L.titleType * 2.5,
    font: 'display',
  });
}
