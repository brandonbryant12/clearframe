import { type PlotLayout } from '../../plots.mjs';

import type { CanvasElement, ElementFields } from '../../types.mjs';
import type { BarsSpec } from './contracts.mjs';

export function verticalBarReference({
  p,
  py,
  elements,
  left,
  right,
  arrive,
  end,
  fmt,
  font,
  width,
  L,
}: VerticalBarReferenceContext) {
  if (p.reference) {
    const y = py(p.reference.value);
    elements.push(
      {
        id: 'bars-reference',
        type: 'line',
        x1: left,
        y1: y,
        x2: right,
        y2: y,
        stroke: 'ink',
        width: 2,
        dash: [10, 8],
        ...arrive(end),
      },
      {
        id: 'bars-reference-label',
        type: 'text',
        text: `${p.reference.label} ${fmt(p.reference.value)}`,
        x: right + font * 0.6,
        y: y + font * 0.35,
        size: font,
        fill: 'ink',
        font: 'semibold',
        fit: width - L.margin - right - font * 0.6,
        ...arrive(end),
      },
    );
  }
}

export interface VerticalBarReferenceContext {
  p: BarsSpec;
  py: (v: number) => number;
  elements: CanvasElement[];
  left: number;
  right: number;
  arrive: (at: number) => ElementFields;
  end: number;
  fmt: (v: number) => string;
  font: number;
  width: number;
  L: PlotLayout;
}
