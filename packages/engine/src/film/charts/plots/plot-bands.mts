import { type AxisValue, type PlotSpec } from '../../plot-data.mjs';
import type { CanvasElement, ElementFields } from '../../types.mjs';
import { textWidth, text } from './primitives.mjs';

export function plotBands({
  p,
  px,
  elements,
  top,
  bottom,
  arrive,
  begin,
  right,
  font,
}: PlotBandsContext) {
  const bands = p.bands ?? [];
  for (const [i, b] of bands.entries()) {
    const x1 = px(b.from),
      x2 = px(b.to);
    elements.push({
      id: `plot-band-${i}`,
      type: 'rect',
      x: x1,
      y: top,
      w: x2 - x1,
      h: bottom - top,
      fill: 'surface',
      opacity: 0.85,
      ...arrive(begin * 0.6),
    });
    // A label shows only where it clears the next band; narrow neighbouring bands stay unlabelled.
    const room =
      (i + 1 < bands.length ? px(bands[i + 1].from) : right) - x1 - font * 0.7;
    if (b.label && textWidth(b.label, font * 1.2) <= room)
      elements.push(
        text(
          `plot-band-${i}-label`,
          b.label,
          x1 + font * 0.35,
          top + font * 1.4,
          font * 1.2,
          {
            fill: 'muted',
            font: 'semibold',
            fit: Math.max(x2 - x1 - font * 0.5, font * 4),
            ...arrive(begin * 0.6),
          },
        ),
      );
  }
}

export interface PlotBandsContext {
  p: PlotSpec;
  px: (x: AxisValue) => number;
  elements: CanvasElement[];
  top: number;
  bottom: number;
  arrive: (at: number) => ElementFields;
  begin: number;
  right: number;
  font: number;
}
