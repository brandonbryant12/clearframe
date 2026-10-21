import { edgeAnchor, labelStart } from '../labels.mjs';

import { type DistributionModel } from '../../distribution-data.mjs';

import type { CanvasElement } from '../../types.mjs';
import { textWidth, show } from './primitives.mjs';

export function histogramEdgeLabels({
  m,
  fmt,
  font,
  px,
  elements,
  bottom,
}: HistogramEdgeLabelsContext) {
  let lastEnd = -Infinity;
  for (const [i, e] of m.edges.entries()) {
    const text = fmt(e),
      w = textWidth(text, font),
      x = px(e),
      a = labelStart(i, m.edges.length - 1, x, w);
    const isEnd = i === m.edges.length - 1;
    if (a < lastEnd + font && !isEnd) continue;
    if (isEnd && a < lastEnd + font) elements.pop();
    elements.push({
      id: `distribution-edge-${i}`,
      type: 'text',
      text,
      x,
      y: bottom + font * 1.6,
      size: font,
      fill: 'muted',
      font: 'figures',
      anchor: edgeAnchor(i, m.edges.length - 1),
      ...show,
    });
    lastEnd = a + w;
  }
}

export interface HistogramEdgeLabelsContext {
  m: DistributionModel;
  fmt: (v: number) => string;
  font: number;
  px: (v: number) => number;
  elements: CanvasElement[];
  bottom: number;
}
