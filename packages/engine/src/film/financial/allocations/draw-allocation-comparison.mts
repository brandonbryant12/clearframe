import type { AllocationComparisonLabel } from '../scene-types.mjs';
import { edgeAnchor, text, rect } from '../drawing.mjs';

import type { allocationPlan } from '../../allocation-data.mjs';

import type { CanvasElement } from '../../types.mjs';
import { drawAllocationBars } from './draw-allocation-bars.mjs';
import type { allocationLayout } from './allocation-layout.mjs';

export function drawAllocationComparison({
  margin,
  w,
  h,
  tall,
  model,
  elements,
  id,
  font,
  span,
  small,
  geometry,
}: DrawAllocationComparisonContext) {
  const left = margin,
    right = w * 0.82,
    barWidth = right - left,
    barHeight = h * (tall ? 0.021 : 0.032),
    start = h * (tall ? 0.32 : 0.33),
    stride = h * (tall ? 0.165 : 0.18),
    labels: AllocationComparisonLabel[] = [],
    ticks = [0, Math.floor(model.total / 2), model.total];
  drawAllocationBars({
    model,
    start,
    stride,
    elements,
    id,
    left,
    font,
    span,
    ticks,
    barWidth,
    barHeight,
    small,
    labels,
  });
  const tickY =
    start +
    (model.buckets.length - 1) * stride +
    font * 0.5 +
    barHeight * 2 +
    small * 1.45 +
    8;
  for (const [i, v] of ticks.entries())
    elements.push(
      text(
        `${id}-tick-${i}`,
        `${v}${i === ticks.length - 1 ? ' tiles' : ''}`,
        left + (barWidth * v) / model.total,
        tickY,
        small,
        {
          font: 'figures',
          anchor: edgeAnchor(i, ticks.length - 1 + 1),
        },
      ),
    );
  const legendY = h * (tall ? 0.285 : 0.29);
  elements.push(
    rect(
      id + '-before-key',
      margin,
      legendY - small * 0.8,
      small * 0.6,
      small * 0.6,
      { fill: 'muted' },
    ),
    text(id + '-before-legend', 'Before', margin + small * 0.9, legendY, small),
    rect(
      id + '-after-key',
      margin + small * 5,
      legendY - small * 0.8,
      small * 0.6,
      small * 0.6,
    ),
    text(id + '-after-legend', 'After', margin + small * 5.9, legendY, small),
  );
  elements.push(
    text(
      id + '-qualification',
      model.qualification,
      margin,
      h * (tall ? 0.865 : 0.885),
      small,
      { width: span, height: h * 0.04 },
    ),
  );
  Object.assign(geometry, {
    comparison: {
      left,
      right,
      barWidth,
      barHeight,
      labels,
      ticks,
      tickY,
      scale: [0, model.total],
      meaning:
        'Bar length encodes token count on the same zero-based total scale; colored keys label before and after, not performance.',
    },
  });
}

export interface DrawAllocationComparisonContext {
  margin: number;
  w: number;
  h: number;
  tall: boolean;
  model: ReturnType<typeof allocationPlan>;
  elements: CanvasElement[];
  id: string;
  font: number;
  span: number;
  small: number;
  geometry: ReturnType<typeof allocationLayout>;
}
