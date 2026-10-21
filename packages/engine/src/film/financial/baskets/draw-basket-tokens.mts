import type { PricedBasketRow } from '../../basket-data.mjs';
import type { BasketGeometry } from '../scene-types.mjs';

import { show, rect } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';

export function drawBasketTokens({
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
}: DrawBasketTokensContext) {
  const size = Math.min(c.w / 7.4, h * (tall ? 0.029 : 0.061)),
    gap = size * 0.18,
    top = c.y + font * 1.8,
    start = c.x + small * 0.5;
  for (let i = 0; i < p.wholeBaskets; i++) {
    const x = start + (i % 6) * (size + gap),
      y = top + Math.floor(i / 6) * (size + gap);
    elements.push(
      rect(`${id}-basket-${j}-${i}`, x, y, size, size, {
        fill: 'none',
        stroke: 'accent',
        width: 3,
        ...timing,
      }),
      {
        id: `${id}-handle-${j}-${i}`,
        type: 'line',
        x1: x + size * 0.22,
        y1: y + size * 0.27,
        x2: x + size * 0.78,
        y2: y + size * 0.27,
        stroke: 'accent',
        width: 2,
        ...show,
        ...timing,
      },
    );
    geometry.tokens.push({
      date: p.date,
      index: i,
      x,
      y,
      w: size,
      h: size,
      at: timing.at,
      fullAt: timing.at + timing.dur,
    });
  }
  return start;
}

export interface DrawBasketTokensContext {
  c: { x: number; y: number; w: number; h: number };
  h: number;
  tall: boolean;
  font: number;
  small: number;
  p: {
    rows: (PricedBasketRow & {
      baseCostWeight: { numerator: number; denominator: number };
      unitChangeMinor: number | null;
      lineChangeMinor: number | null;
    })[];
    costIndex: {
      numerator: number;
      denominator: number;
      base: number;
      value: number;
    };
    changeMinor: number;
    changeFraction: { numerator: number; denominator: number };
    complete: true;
    costMinor: number;
    wholeBaskets: number;
    spentMinor: number;
    remainderMinor: number;
    date: string;
    missingItemIds: string[];
    coveredItems: number;
    knownSubtotalMinor: number;
  };
  elements: CanvasElement[];
  id: string;
  j: number;
  timing: { at: number; enter: string; dur: number };
  geometry: BasketGeometry;
}
