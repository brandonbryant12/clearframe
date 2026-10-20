import { type DistributionModel } from '../../distribution-data.mjs';

import type { PlotMotion } from '../../plot-data.mjs';
import type { CanvasElement, ElementFields } from '../../types.mjs';
import { binColor } from './bin-color.mjs';
import { show } from './primitives.mjs';
import type { HistogramSpec } from './contracts.mjs';

export function drawHistogramBins({
  m,
  px,
  gap,
  py,
  motion,
  n,
  qualifies,
  p,
  elements,
  bottom,
  font,
  arrive,
}: DrawHistogramBinsContext) {
  for (const [i, b] of m.bins.entries()) {
    const x1 = px(b.low) + gap / 2,
      x2 = px(b.high) - gap / 2,
      y = py(b.count),
      at =
        motion === 'none'
          ? 0
          : motion.at + (motion.duration * 0.7 * i) / Math.max(n - 1, 1);
    // A bin wholly on the qualifying side takes the tone; a bin the threshold splits stays neutral.
    const side = binColor(qualifies(b.low) && qualifies(b.high - 1e-9), p.tone);
    if (b.count > 0) {
      elements.push(
        {
          id: `distribution-bar-${i}`,
          type: 'rect',
          x: x1,
          y,
          w: x2 - x1,
          h: bottom - y,
          r: Math.min(4, (x2 - x1) * 0.06),
          fill: side,
          ...(motion === 'none'
            ? show
            : {
                at,
                enter: 'grow-y',
                origin: [(x1 + x2) / 2, bottom],
                dur: motion.duration * 0.35,
              }),
        },
        {
          id: `distribution-count-${i}`,
          type: 'text',
          text: String(b.count),
          x: (x1 + x2) / 2,
          y: y - font * 0.5,
          size: font,
          fill: 'ink',
          font: 'figures',
          anchor: 'middle',
          ...arrive(at + (motion === 'none' ? 0 : motion.duration * 0.35)),
        },
      );
    }
  }
}

export interface DrawHistogramBinsContext {
  m: DistributionModel;
  px: (v: number) => number;
  gap: number;
  py: (c: number) => number;
  motion: 'none' | PlotMotion;
  n: number;
  qualifies: (v: number) => boolean;
  p: HistogramSpec;
  elements: CanvasElement[];
  bottom: number;
  font: number;
  arrive: (t: number) => ElementFields;
}
