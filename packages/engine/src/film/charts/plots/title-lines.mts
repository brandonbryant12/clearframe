import type { PlotLayout } from './contracts.mjs';
import { textWidth } from './primitives.mjs';

/** Landscape titles stay on one line; tall frames wrap to two lines and move the key down to make room. */
export function titleLines(
  title: string,
  L: PlotLayout,
  width: number,
): number {
  if (L.orientation === 'landscape') return 1;
  return textWidth(title, L.titleType * 0.93) > width ? 2 : 1;
}
