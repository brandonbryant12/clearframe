import type { allocationPlan } from '../../allocation-data.mjs';
import { allocationAmount } from '../../allocation-data.mjs';
import { text } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';
import type { allocationLayout } from './allocation-layout.mjs';

export function drawAllocationCounts({
  states,
  geometry,
  elements,
  id,
  model,
  font,
  small,
  margin,
  h,
  tall,
  span,
}: DrawAllocationCountsContext) {
  for (const [i, s] of states.entries()) {
    const timing = {
      at: s.at,
      ...(i < states.length - 1
        ? { exit: 'none', exitAt: states[i + 1].at }
        : {}),
    };
    for (const c of geometry.cards)
      elements.push(
        text(
          `${id}-amount-${i}-${c.id}`,
          `${s.counts[c.index]} tiles · ${allocationAmount(s.counts[c.index] * model.quantum.minorUnits, model.quantum)}`,
          c.x + c.width / 2,
          c.y + font * 2.18,
          small,
          { anchor: 'middle', font: 'figures', fit: c.width - 24, ...timing },
        ),
      );
    elements.push(
      text(
        `${id}-conservation-${i}`,
        `${model.total - s.inTransit} parked + ${s.inTransit} in transit = ${model.total} tiles`,
        margin,
        h * (tall ? 0.865 : 0.885),
        small,
        { font: 'figures', fit: span, ...timing },
      ),
    );
  }
}

export interface DrawAllocationCountsContext {
  states: { at: number; counts: number[]; inTransit: number }[];
  geometry: ReturnType<typeof allocationLayout>;
  elements: CanvasElement[];
  id: string;
  model: ReturnType<typeof allocationPlan>;
  font: number;
  small: number;
  margin: number;
  h: number;
  tall: boolean;
  span: number;
}
