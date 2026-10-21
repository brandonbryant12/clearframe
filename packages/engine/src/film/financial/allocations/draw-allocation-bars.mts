import type { AllocationComparisonLabel } from '../scene-types.mjs';
import type { allocationPlan } from '../../allocation-data.mjs';
import { show, text, rect } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';

export function drawAllocationBars({
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
}: DrawAllocationBarsContext) {
  for (const [i, b] of model.before.entries()) {
    const a = model.after[i],
      y = start + i * stride;
    elements.push(
      text(
        `${id}-name-${i}`,
        `${b.label} · ${b.count} → ${a.count} tiles`,
        left,
        y,
        font,
        { fit: span },
      ),
    );
    for (const [j, v] of ticks.entries()) {
      const x = left + (barWidth * v) / model.total;
      elements.push({
        id: `${id}-grid-${i}-${j}`,
        type: 'line',
        x1: x,
        y1: y + font * 0.4,
        x2: x,
        y2: y + font * 0.5 + barHeight * 2 + 12,
        stroke: 'line',
        width: v === 0 ? 2 : 1,
        ...show,
      });
    }
    if (b.count)
      elements.push(
        rect(
          `${id}-before-${i}`,
          left,
          y + font * 0.5,
          (barWidth * b.count) / model.total,
          barHeight,
          { fill: 'muted' },
        ),
      );
    if (a.count)
      elements.push(
        rect(
          `${id}-after-${i}`,
          left,
          y + font * 0.5 + barHeight + 8,
          (barWidth * a.count) / model.total,
          barHeight,
        ),
      );
    const tx = left + (barWidth * a.count) / model.total + small * 0.35,
      ty = y + font * 0.5 + barHeight * 1.85 + 8;
    elements.push(
      text(`${id}-share-${i}`, a.shareLabel, tx, ty, small, {
        font: 'figures',
      }),
    );
    labels.push({
      id: b.id,
      y,
      beforeWidth: (barWidth * b.count) / model.total,
      afterWidth: (barWidth * a.count) / model.total,
      share: a.shareLabel,
    });
  }
}

export interface DrawAllocationBarsContext {
  model: ReturnType<typeof allocationPlan>;
  start: number;
  stride: number;
  elements: CanvasElement[];
  id: string;
  left: number;
  font: number;
  span: number;
  ticks: number[];
  barWidth: number;
  barHeight: number;
  small: number;
  labels: AllocationComparisonLabel[];
}
