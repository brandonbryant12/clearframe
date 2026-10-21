import type { AllocationInput } from '../../allocation-data.mjs';
import type { AllocationOptions } from '../scene-types.mjs';
import {
  allocationPlan,
  allocationClock,
  allocationAmount,
} from '../../allocation-data.mjs';
import { text } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';
import { check } from './check.mjs';
import { allocationLayout } from './allocation-layout.mjs';
import { drawAllocationTrays } from './draw-allocation-trays.mjs';
import { drawAllocationComparison } from './draw-allocation-comparison.mjs';

export function allocationScene(
  input: AllocationInput,
  { width: w, height: h, id, view = 'trays', timing }: AllocationOptions,
) {
  check(
    typeof id === 'string' && /^[a-z][a-z0-9-]*$/.test(id),
    'scene id required',
  );
  check(
    ['trays', 'comparison'].includes(view),
    'view must be trays or comparison',
  );
  const model = allocationPlan(input),
    clock = allocationClock(model, timing),
    geometry = allocationLayout(model, clock, w, h),
    { tall, font, small, size } = geometry,
    margin = w * (tall ? 0.105 : 0.09),
    sourceId = id + '-source',
    elements: CanvasElement[] = [];
  const span = w - 2 * margin;
  elements.push(
    text(
      id + '-title',
      model.title,
      margin,
      h * 0.12,
      w * (tall ? 0.047 : 0.032),
      { font: 'display', width: span, height: h * 0.075 },
    ),
    text(
      id + '-unit',
      `${geometry.tokenMeaning} · total ${allocationAmount(model.totalMinorUnits, model.quantum)}`,
      margin,
      h * (tall ? 0.205 : 0.19),
      font,
      { font: 'figures', fit: span },
    ),
    text(
      id + '-period',
      `${model.period} · fixed total; no inflows or losses`,
      margin,
      h * (tall ? 0.25 : 0.245),
      small,
      { fit: span },
    ),
  );
  if (view === 'trays') {
    drawAllocationTrays({
      geometry,
      elements,
      id,
      model,
      font,
      clock,
      small,
      margin,
      h,
      tall,
      span,
      size,
    });
  } else {
    drawAllocationComparison({
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
    });
  }
  elements.push(
    text(
      sourceId,
      `${model.source} · as of ${model.asOf}`,
      margin,
      h * (tall ? 0.925 : 0.935),
      Math.max(28, small),
      { width: span, height: h * 0.04 },
    ),
  );
  return {
    model,
    clock,
    geometry,
    duration: view === 'trays' ? clock.duration : 24,
    props: { view: [0, 0, w, h], sourceElement: sourceId, elements },
  };
}
