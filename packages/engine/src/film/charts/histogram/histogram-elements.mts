import { plotLayout, titleText, titleShift } from '../../plots.mjs';

import type { CanvasElement, ElementFields, FrameSize } from '../../types.mjs';
import type { HistogramSpec } from './contracts.mjs';
import { show } from './primitives.mjs';
import { qualifiesThreshold } from './qualifies-threshold.mjs';
import { drawHistogramBins } from './draw-histogram-bins.mjs';
import { histogramEdgeLabels } from './histogram-edge-labels.mjs';
import { histogramMarker } from './histogram-marker.mjs';

export function histogramElements(
  p: HistogramSpec,
  frame: FrameSize,
): CanvasElement[] {
  const { width } = frame,
    L = plotLayout(frame),
    font = L.type,
    m = p.model;
  const fmt = (v: number): string =>
    `${v < 0 ? '−' : ''}${p.prefix}${Math.abs(v).toFixed(p.decimals)}${p.suffix}`;
  const arrive = (t: number): ElementFields =>
    t === 0 ? show : { at: t, enter: 'fade', dur: 0.3 };
  const shift = titleShift(p.title, L, width - 2 * L.margin);
  const title = titleText(p.title, L, width - 2 * L.margin);
  title.id = 'distribution-title';
  const left = L.margin + width * 0.01,
    right = width - L.margin - width * 0.01,
    top = L.top + shift + font * 2.6,
    bottom = L.bottom;
  const [lo, hi] = [m.edges[0], m.edges[m.edges.length - 1]],
    px = (v: number): number => left + ((v - lo) / (hi - lo)) * (right - left);
  const py = (c: number): number => bottom - (c / m.y.max) * (bottom - top);
  const motion = p.motion;
  const n = m.bins.length,
    end = motion === 'none' ? 0 : motion.at + motion.duration;
  const t = p.model.threshold,
    qualifies = (v: number): boolean =>
      qualifiesThreshold(t.relation, t.value, v);
  const elements: CanvasElement[] = [
    title,
    {
      id: 'distribution-unit',
      type: 'text',
      text: p.unit,
      x: L.margin,
      y: L.keyY + shift,
      size: L.keyType,
      fill: 'muted',
      font: 'semibold',
      fit: width - 2 * L.margin,
      ...show,
    },
  ];
  const gap = Math.max(2, ((right - left) / n) * 0.06);
  drawHistogramBins({
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
  });
  elements.push({
    id: 'distribution-base',
    type: 'line',
    x1: left,
    y1: bottom,
    x2: right,
    y2: bottom,
    stroke: 'muted',
    width: 2,
    ...show,
  });
  // Edge labels, thinned so neighbours never collide; the ends are kept.
  histogramEdgeLabels({ m, fmt, font, px, elements, bottom });
  const tx = px(t.value);
  elements.push({
    id: 'distribution-threshold',
    type: 'line',
    x1: tx,
    y1: top - font * 0.4,
    x2: tx,
    y2: bottom,
    stroke: 'ink',
    width: 2,
    dash: [10, 8],
    ...arrive(end),
  });
  // The threshold sentence sits in the header, keyed by a dashed swatch, so it never competes with the bars.
  const sentence = `${p.threshold.label}: ${t.count} of ${t.denominator}`,
    K = L.keyType,
    sy = L.keyY + shift + K * 1.7;
  elements.push(
    {
      id: 'distribution-threshold-key',
      type: 'line',
      x1: L.margin,
      y1: sy - K * 0.32,
      x2: L.margin + K * 1.2,
      y2: sy - K * 0.32,
      stroke: 'ink',
      width: 2,
      dash: [6, 5],
      ...arrive(end),
    },
    {
      id: 'distribution-threshold-label',
      type: 'text',
      text: sentence,
      x: L.margin + K * 1.6,
      y: sy,
      size: K,
      fill: 'ink',
      font: 'semibold',
      fit: width - 2 * L.margin - K * 1.6,
      ...arrive(end + 0.2),
    },
  );
  histogramMarker({ p, m, px, py, font, elements, arrive, end });
  return elements;
}
