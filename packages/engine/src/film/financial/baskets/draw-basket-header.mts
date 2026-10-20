import type { fixedBasket } from '../../basket-data.mjs';
import { text } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';

export function drawBasketHeader({
  elements,
  id,
  model,
  margin,
  h,
  tall,
  w,
  span,
  view,
  money,
}: DrawBasketHeaderContext) {
  elements.push(
    text(
      id + '-title',
      model.title,
      margin,
      h * (tall ? 0.105 : 0.115),
      w * (tall ? 0.052 : 0.034),
      { font: 'display', width: span, height: h * 0.055 },
    ),
    text(
      id + '-principle',
      view === 'prices'
        ? 'Keep every quantity fixed. Reprice the same basket.'
        : `Budget stays ${money(model.budgetMinor)} at both dates.`,
      margin,
      h * (tall ? 0.175 : 0.18),
      w * (tall ? 0.038 : 0.024),
      { width: span, height: h * 0.05 },
    ),
  );
}

export interface DrawBasketHeaderContext {
  elements: CanvasElement[];
  id: string;
  model: ReturnType<typeof fixedBasket>;
  margin: number;
  h: number;
  tall: boolean;
  w: number;
  span: number;
  view: string;
  money: (v: number) => string;
}
