import type { fixedBasket } from '../../basket-data.mjs';
import { text, rect } from '../drawing.mjs';
import { required } from '../validation.mjs';
import type { CanvasElement } from '../../types.mjs';
import { colors } from './colors.mjs';

export function drawBasketItems({
  model,
  rowStart,
  rowStride,
  elements,
  id,
  margin,
  rowFont,
  tall,
  n,
  w,
  small,
  bare,
  xs,
  common,
}: DrawBasketItemsContext) {
  for (const [i, item] of model.items.entries()) {
    const y = rowStart + i * rowStride;
    elements.push(
      rect(
        `${id}-key-${i}`,
        margin,
        y - rowFont * 0.76,
        rowFont * 0.18,
        rowFont * 0.8,
        { fill: colors[i] },
      ),
      text(
        `${id}-item-${i}`,
        !tall && n === 4
          ? `${item.label} · ${item.quantity} × ${item.unit}`
          : item.label,
        margin + rowFont * 0.4,
        y,
        rowFont,
        { fit: w * (tall ? 0.29 : 0.29), height: rowStride * 0.56 },
      ),
      text(
        `${id}-quantity-${i}`,
        !tall && n === 4 ? '' : `${item.quantity} × ${item.unit}`,
        margin + rowFont * 0.4,
        y + rowFont * (tall ? 1.25 : 0.95),
        small,
        { fit: w * (tall ? 0.29 : 0.25) },
      ),
    );
    model.periods.forEach((p, j) => {
      const row = p.rows[i],
        label =
          row.unitPriceMinor === null
            ? 'missing'
            : `${bare(row.unitPriceMinor)} → ${bare(required(row.lineCostMinor, 'basket scene: missing line cost'))}`;
      elements.push(
        text(
          `${id}-prices-${j}-${i}`,
          label,
          xs[j],
          y + rowFont * 0.45,
          rowFont,
          { anchor: 'middle', font: 'figures', fit: w * 0.25, ...common(j) },
        ),
      );
    });
  }
}

export interface DrawBasketItemsContext {
  model: ReturnType<typeof fixedBasket>;
  rowStart: number;
  rowStride: number;
  elements: CanvasElement[];
  id: string;
  margin: number;
  rowFont: number;
  tall: boolean;
  n: number;
  w: number;
  small: number;
  bare: (v: number) => string;
  xs: number[];
  common: (i: number) => { at: number; enter: string; dur: number };
}
