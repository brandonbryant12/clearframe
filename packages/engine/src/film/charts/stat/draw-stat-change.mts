import type { CanvasElement, ElementFields } from '../../types.mjs';
import { changePresentation } from './change-presentation.mjs';
import { number } from './primitives.mjs';
import type { StatSpec } from './contracts.mjs';

export function drawStatChange({
  p,
  elements,
  x,
  valueY,
  labelSize,
  tall,
  W,
  arrive,
  at,
  dur,
}: DrawStatChangeContext) {
  if (p.change) {
    const c = p.change,
      { tone, sign, marker } = changePresentation(c);
    elements.push({
      id: 'stat-change',
      type: 'text',
      text: `${marker}  ${sign}${number(c.value, c.decimals)}${c.suffix} ${c.context}`,
      x,
      y: valueY + labelSize * (tall ? 5.2 : 4.4),
      size: labelSize * 0.9,
      fill: tone,
      font: 'figures',
      fit: W,
      ...arrive(at + dur + 0.2),
    });
  }
}

export interface DrawStatChangeContext {
  p: StatSpec;
  elements: CanvasElement[];
  x: number;
  valueY: number;
  labelSize: number;
  tall: boolean;
  W: number;
  arrive: (t: number) => ElementFields;
  at: number;
  dur: number;
}
