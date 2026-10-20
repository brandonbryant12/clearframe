import type { BasketGeometry } from '../scene-types.mjs';
import type { fixedBasket } from '../../basket-data.mjs';
import { text, rect } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';
import { check } from './check.mjs';
import { drawBasketTokens } from './draw-basket-tokens.mjs';

export function drawBasketBudget({
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
}: DrawBasketBudgetContext) {
  elements.push(
    text(
      id + '-meaning',
      '1 outlined tile = 1 complete basket. No partial baskets.',
      margin,
      h * (tall ? 0.23 : 0.235),
      small,
      { width: span, height: h * 0.04 },
    ),
  );
  const maxCount = Math.max(
    ...model.periods.filter((p) => p.complete).map((p) => p.wholeBaskets),
  );
  check(
    maxCount <= 12,
    'budget scene supports at most 12 whole baskets per date',
  );
  const cards = model.periods.map((p, i) => ({
    x: tall ? margin : margin + i * w * 0.435,
    y: tall ? h * (0.27 + i * 0.27) : h * 0.3,
    w: tall ? span : w * 0.365,
    h: tall ? h * 0.23 : h * 0.45,
  }));
  model.periods.forEach((p, j) => {
    const c = cards[j],
      timing = common(j);
    elements.push(
      rect(`${id}-card-${j}`, c.x, c.y, c.w, c.h, {
        fill: 'none',
        stroke: 'line',
        width: 2,
      }),
      text(
        `${id}-date-${j}`,
        p.date,
        c.x + small * 0.5,
        c.y + font * 1.2,
        font,
        { font: 'figures' },
      ),
    );
    if (!p.complete) {
      elements.push(
        text(
          `${id}-missing-${j}`,
          'Prices incomplete.\nNo purchase count.',
          c.x + small * 0.5,
          c.y + font * 3,
          font,
          { width: c.w - small, height: font * 3, ...timing },
        ),
      );
      return;
    }
    const start = drawBasketTokens({
      c,
      h,
      tall,
      font,
      small,
      p,
      elements,
      id,
      j,
      timing,
      geometry,
    });
    const amountY = c.y + c.h * (tall ? 0.54 : 0.59),
      barY = c.y + c.h * (tall ? 0.65 : 0.71),
      barH = h * (tall ? 0.015 : 0.024),
      barX = start,
      barW = c.w - small;
    elements.push(
      text(
        `${id}-purchase-${j}`,
        `${p.wholeBaskets} baskets × ${money(p.costMinor)}`,
        start,
        amountY,
        small,
        { font: 'figures', fit: c.w - small, ...timing },
      ),
    );
    const components: [string, number, string][] = [
      ['spent', p.spentMinor, 'accent'],
      ['left', p.remainderMinor, '#D9D1C4'],
    ];
    for (const [k, value, fill] of components) {
      const x =
          barX +
          (k === 'left' && model.budgetMinor > 0
            ? (barW * p.spentMinor) / model.budgetMinor
            : 0),
        len = model.budgetMinor ? (barW * value) / model.budgetMinor : 0;
      if (len > 0)
        elements.push(
          rect(`${id}-${k}-${j}`, x, barY, len, barH, { fill, ...timing }),
        );
      geometry.rectangles.push({
        id: `${id}-${k}-${j}`,
        date: p.date,
        x,
        y: barY,
        w: len,
        h: barH,
        valueMinor: value,
        denominator: model.budgetMinor,
        scaleWidth: barW,
        at: timing.at,
        fullAt: timing.at + timing.dur,
      });
    }
    elements.push(
      text(
        `${id}-spent-label-${j}`,
        `Bought: ${money(p.spentMinor)}`,
        start,
        c.y + c.h * (tall ? 0.82 : 0.86),
        small,
        { font: 'figures', fit: c.w - small, ...timing },
      ),
      text(
        `${id}-remainder-${j}`,
        `Left: ${money(p.remainderMinor)}`,
        start,
        c.y + c.h * (tall ? 0.94 : 0.965),
        small,
        { font: 'figures', fit: c.w - small, ...timing },
      ),
    );
  });
  elements.push(
    text(
      id + '-no-substitution',
      tall
        ? 'Same composition · no substitution\nCash remainder retained'
        : 'Same composition · no substitution · cash remainder retained',
      margin,
      tall ? h * 0.81 : h * 0.79,
      small,
      { width: span, height: h * 0.04 },
    ),
  );
  // Text labels identify both money components, including a zero-width remainder.
  geometry.cards = cards;
  geometry.maximumWholeBaskets = maxCount;
}

export interface DrawBasketBudgetContext {
  elements: CanvasElement[];
  id: string;
  margin: number;
  h: number;
  tall: boolean;
  small: number;
  span: number;
  model: ReturnType<typeof fixedBasket>;
  w: number;
  common: (i: number) => { at: number; enter: string; dur: number };
  font: number;
  geometry: BasketGeometry;
  money: (v: number) => string;
}
