import { edgeAnchor, labelStart } from '../labels.mjs';

import type { CanvasElement } from '../../types.mjs';
import { textWidth, show } from './primitives.mjs';
import type { BarsSpec } from './contracts.mjs';

export function horizontalBarTicks({
  p,
  fmt,
  font,
  px,
  elements,
  top,
  bottom,
}: HorizontalBarTicksContext) {
  const kept = (i: number): number =>
    i === 0 || i === p.ticks.length - 1 ? 1 : 0;
  const order = p.ticks
    .map((t, i) => i)
    .sort(
      (a, b) =>
        Number(p.ticks[b] === 0) - Number(p.ticks[a] === 0) ||
        kept(b) - kept(a) ||
        a - b,
    );
  const spans: number[][] = [],
    labelled = new Set<number>();
  for (const i of order) {
    const t = p.ticks[i],
      w = textWidth(fmt(t), font),
      x = px(t);
    const a = labelStart(i, p.ticks.length - 1, x, w);
    if (
      spans.every(([s, e]) => a + w + font * 0.6 <= s || a >= e + font * 0.6)
    ) {
      spans.push([a, a + w]);
      labelled.add(i);
    }
  }
  for (const [i, t] of p.ticks.entries()) {
    elements.push({
      id: `bars-grid-${i}`,
      type: 'line',
      x1: px(t),
      y1: top,
      x2: px(t),
      y2: bottom,
      stroke: t === 0 ? 'muted' : 'line',
      width: t === 0 ? 2 : 1.25,
      ...show,
    });
    if (labelled.has(i))
      elements.push({
        id: `bars-tick-${i}`,
        type: 'text',
        text: fmt(t),
        x: px(t),
        y: bottom + font * 1.6,
        size: font,
        fill: 'muted',
        font: 'figures',
        anchor: edgeAnchor(i, p.ticks.length - 1),
        ...show,
      });
  }
}

export interface HorizontalBarTicksContext {
  p: BarsSpec;
  fmt: (v: number) => string;
  font: number;
  px: (v: number) => number;
  elements: CanvasElement[];
  top: number;
  bottom: number;
}
