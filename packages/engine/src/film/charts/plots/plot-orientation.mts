import type { PlotOrientation } from './contracts.mjs';

export function plotOrientation(aspect: number): PlotOrientation {
  if (aspect > 1.2) return 'landscape';
  return aspect < 0.8 ? 'vertical' : 'square';
}
