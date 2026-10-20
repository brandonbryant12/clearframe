import { titleText, type PlotLayout } from '../../plots.mjs';

import type { CanvasElement, ElementFields } from '../../types.mjs';
import type { StatSpec } from './contracts.mjs';

export function drawStatKicker({
  p,
  L,
  W,
  valueY,
  valueSize,
  arrive,
  at,
  elements,
}: DrawStatKickerContext) {
  if (p.kicker) {
    const k = titleText(p.kicker, { ...L, titleType: L.keyType * 1.05 }, W);
    Object.assign(k, {
      id: 'stat-kicker',
      y: valueY - valueSize * 1.05,
      font: 'semibold',
      fill: 'muted',
      upper: true,
      tracking: 0.08,
      ...arrive(at * 0.5),
    });
    elements.push(k);
  }
}

export interface DrawStatKickerContext {
  p: StatSpec;
  L: PlotLayout;
  W: number;
  valueY: number;
  valueSize: number;
  arrive: (t: number) => ElementFields;
  at: number;
  elements: CanvasElement[];
}
