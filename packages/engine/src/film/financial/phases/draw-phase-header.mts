import type { phaseTrail } from '../../phase-data.mjs';
import { text } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';
import { phaseValue } from './phase-value.mjs';

export function drawPhaseHeader({
  elements,
  id,
  m,
  margin,
  h,
  tall,
  w,
  font,
  copyWidth,
  small,
}: DrawPhaseHeaderContext) {
  elements.push(
    text(
      id + '-title',
      m.title,
      margin,
      h * (tall ? 0.12 : 0.115),
      w * (tall ? 0.047 : 0.032),
      { font: 'display', width: w - 2 * margin, height: h * 0.075 },
    ),
    text(
      id + '-dates',
      `${m.dateSpan[0]} to ${m.dateSpan[1]}`,
      margin,
      h * (tall ? 0.19 : 0.265),
      font,
      {
        font: 'figures',
        ...(tall ? { fit: copyWidth } : { width: copyWidth, height: h * 0.12 }),
      },
    ),
    text(
      id + '-references',
      `References: x = ${phaseValue(m.x.reference, m.x.decimals)} · y = ${phaseValue(m.y.reference, m.y.decimals)}`,
      margin,
      h * (tall ? 0.235 : 0.43),
      small,
      {
        font: 'figures',
        ...(tall ? { fit: copyWidth } : { width: copyWidth, height: h * 0.11 }),
      },
    ),
  );
}

export interface DrawPhaseHeaderContext {
  elements: CanvasElement[];
  id: string;
  m: ReturnType<typeof phaseTrail>;
  margin: number;
  h: number;
  tall: boolean;
  w: number;
  font: number;
  copyWidth: number;
  small: number;
}
