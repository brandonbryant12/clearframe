import type { BasketInput } from '../../basket-data.mjs';
import type { BasketOptions, BasketGeometry } from '../scene-types.mjs';
import { fixedBasket, basketAmount } from '../../basket-data.mjs';
import { text } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';
import { check } from './check.mjs';
import { drawBasketHeader } from './draw-basket-header.mjs';
import { drawBasketPrices } from './draw-basket-prices.mjs';
import { drawBasketBudget } from './draw-basket-budget.mjs';

export function basketScene(
  input: BasketInput,
  { width: w, height: h, id, view = 'prices' }: BasketOptions,
) {
  check(
    typeof id === 'string' && /^[a-z][a-z0-9-]*$/.test(id),
    'scene id required',
  );
  check(['prices', 'budget'].includes(view), 'view must be prices or budget');
  check(
    Number.isFinite(w) &&
      Number.isFinite(h) &&
      w >= 960 &&
      h >= 960 &&
      w <= 4096 &&
      h <= 4096,
    'frame dimensions must be 960–4096',
  );
  const model = fixedBasket(input),
    tall = h > w,
    n = model.items.length;
  check(
    n >= 2 && n <= 4 && model.periods.length === 2,
    'native scene supports 2–4 items and exactly two snapshots',
  );
  const margin = w * 0.1,
    span = w * 0.8,
    font = w * (tall ? 0.038 : 0.027),
    small = w * (tall ? 0.0315 : 0.0225),
    sourceSize = Math.max(28, small),
    elements: CanvasElement[] = [],
    geometry: BasketGeometry = {
      width: w,
      height: h,
      view,
      rectangles: [],
      tokens: [],
    };
  const sourceId = id + '-source',
    money = (v: number) => basketAmount(v, model.currency),
    bare = (v: number) => money(v).slice(0, -model.currency.unit.length - 1);
  const common = (i: number) => ({ at: i ? 6 : 1, enter: 'fade', dur: 0.45 });
  drawBasketHeader({
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
  });
  if (view === 'prices') {
    drawBasketPrices({
      elements,
      id,
      model,
      margin,
      h,
      tall,
      w,
      span,
      n,
      small,
      bare,
      common,
      geometry,
      money,
    });
  } else {
    drawBasketBudget({
      elements,
      id,
      margin,
      h,
      tall,
      small,
      span,
      model,
      w,
      common,
      font,
      geometry,
      money,
    });
  }
  const sourceY = h * (tall ? 0.86 : 0.93);
  elements.push(
    text(
      sourceId,
      tall
        ? `${model.source}\nAs of ${model.asOf}`
        : `${model.source} · as of ${model.asOf}`,
      margin,
      sourceY,
      sourceSize,
      { width: span, height: h * (tall ? 0.06 : 0.05) },
    ),
  );
  const duration = view === 'prices' ? 38 : 26;
  return {
    model,
    geometry,
    duration,
    props: {
      view: [0, 0, w, h],
      sourceElement: sourceId,
      elements: elements.filter((e) => e.type !== 'text' || e.text !== ''),
    },
    clock: {
      beforeAt: 1,
      afterAt: 6,
      fadeSeconds: 0.45,
      settledAt: 6.45,
      finalHold: duration - 6.45,
    },
  };
}
