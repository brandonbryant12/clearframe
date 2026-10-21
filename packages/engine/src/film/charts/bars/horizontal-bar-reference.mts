import type { CanvasElement, ElementFields } from '../../types.mjs';
import type { BarsSpec } from './contracts.mjs';

export function horizontalBarReference({
  p,
  px,
  elements,
  top,
  font,
  bottom,
  arrive,
  end,
  fmt,
}: HorizontalBarReferenceContext) {
  if (p.reference) {
    const x = px(p.reference.value);
    elements.push(
      {
        id: 'bars-reference',
        type: 'line',
        x1: x,
        y1: top - font * 0.6,
        x2: x,
        y2: bottom,
        stroke: 'ink',
        width: 2,
        dash: [10, 8],
        ...arrive(end),
      },
      {
        id: 'bars-reference-label',
        type: 'text',
        text: `${p.reference.label} ${fmt(p.reference.value)}`,
        x,
        y: top - font * 1.0,
        size: font,
        fill: 'ink',
        font: 'semibold',
        anchor: 'middle',
        ...arrive(end),
      },
    );
  }
}

export interface HorizontalBarReferenceContext {
  p: BarsSpec;
  px: (v: number) => number;
  elements: CanvasElement[];
  top: number;
  font: number;
  bottom: number;
  arrive: (at: number) => ElementFields;
  end: number;
  fmt: (v: number) => string;
}
