import { type DistributionModel } from '../../distribution-data.mjs';

import type { CanvasElement, ElementFields } from '../../types.mjs';
import { check } from './check.mjs';
import type { HistogramSpec } from './contracts.mjs';

export function histogramMarker({
  p,
  m,
  px,
  py,
  font,
  elements,
  arrive,
  end,
}: HistogramMarkerContext) {
  if (p.marker) {
    const marker = p.marker;
    const b = m.bins.find(
      (b) =>
        marker.value >= b.low &&
        (marker.value < b.high || (b.rightClosed && marker.value <= b.high)),
    );
    check(b, 'marker.value must lie inside the bins');
    const x = px(marker.value),
      y = py(b.count) - font * 1.6;
    elements.push(
      {
        id: 'distribution-marker',
        type: 'poly',
        closed: true,
        points: [
          [x - font * 0.45, y - font * 0.7],
          [x + font * 0.45, y - font * 0.7],
          [x, y],
        ],
        fill: 'accent2',
        ...arrive(end + 0.5),
      },
      {
        id: 'distribution-marker-label',
        type: 'text',
        text: marker.label,
        x,
        y: y - font * 1.1,
        size: font,
        fill: 'accent2',
        font: 'semibold',
        anchor: 'middle',
        ...arrive(end + 0.5),
      },
    );
  }
}

export interface HistogramMarkerContext {
  p: HistogramSpec;
  m: DistributionModel;
  px: (v: number) => number;
  py: (c: number) => number;
  font: number;
  elements: CanvasElement[];
  arrive: (t: number) => ElementFields;
  end: number;
}
