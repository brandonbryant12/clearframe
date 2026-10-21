import { edgeAnchor, show, text, rect } from '../drawing.mjs';

import type { BasketGeometry } from '../scene-types.mjs';
import type { fixedBasket } from '../../basket-data.mjs';

import type { CanvasElement } from '../../types.mjs';
import { basketRowStride } from './basket-row-stride.mjs';
import { drawBasketItems } from './draw-basket-items.mjs';
import { colors } from './colors.mjs';

export function drawBasketPrices({
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
}: DrawBasketPricesContext) {
  elements.push(
    text(
      id + '-basis',
      `${model.currency.unit} · ${model.priceBasis}`,
      margin,
      h * (tall ? 0.235 : 0.23),
      w * (tall ? 0.029 : 0.019),
      { width: span, height: h * 0.05 },
    ),
  );
  const xs = tall ? [w * 0.515, w * 0.775] : [w * 0.49, w * 0.79],
    rowStart = h * (tall ? 0.35 : 0.36),
    rowStride = h * basketRowStride(tall, n),
    rowFont = w * (tall ? 0.036 : 0.024);
  elements.push(
    text(id + '-fixed', 'FIXED BASKET', margin, h * 0.285, small, {
      font: 'bold',
    }),
  );
  model.periods.forEach((p, j) =>
    elements.push(
      text(`${id}-date-${j}`, p.date, xs[j], h * 0.285, small, {
        anchor: 'middle',
        font: 'figures',
      }),
      text(`${id}-column-${j}`, 'unit → cost', xs[j], h * 0.318, small * 0.9, {
        anchor: 'middle',
      }),
    ),
  );
  drawBasketItems({
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
  });
  const max = Math.max(
      ...model.periods.filter((p) => p.complete).map((p) => p.costMinor),
    ),
    unit = 10 ** model.currency.decimals,
    step = 10 ** Math.floor(Math.log10(max)),
    domain = Math.ceil(max / step) * step,
    left = margin,
    right = w * 0.86,
    width = right - left,
    barHeight = h * (tall ? 0.02 : 0.027),
    ys = tall ? [h * 0.62, h * 0.715] : [h * 0.65, h * 0.755];
  geometry.domainMinor = [0, domain];
  geometry.axis = { left, right };
  model.periods.forEach((p, j) => {
    const y = ys[j],
      timing = common(j);
    elements.push(
      text(
        `${id}-total-${j}`,
        `${p.date} · ${p.complete ? money(p.costMinor) : 'INCOMPLETE — no basket total'}`,
        left,
        y - barHeight * 0.65,
        small,
        { font: 'figures', fit: span, ...timing },
      ),
    );
    if (!p.complete) return;
    let accumulated = 0;
    p.rows.forEach((row, i) => {
      const x = left + (width * accumulated) / domain,
        len = (width * row.lineCostMinor) / domain;
      if (len > 0)
        elements.push(
          rect(`${id}-cost-${j}-${i}`, x, y, len, barHeight, {
            fill: colors[i],
            ...timing,
          }),
        );
      geometry.rectangles.push({
        id: `${id}-cost-${j}-${i}`,
        date: p.date,
        item: row.id,
        x,
        y,
        w: len,
        h: barHeight,
        valueMinor: row.lineCostMinor,
        denominator: domain,
        scaleWidth: width,
        at: timing.at,
        fullAt: timing.at + timing.dur,
      });
      accumulated += row.lineCostMinor;
    });
  });
  const axisTop = ys[0] - barHeight * 0.4,
    axisBottom = ys[1] + barHeight;
  for (const [i, value] of [0, domain / 2, domain].entries()) {
    // Tick labels may use fractional minor units, so divide in major units here.
    const x = left + (width * value) / domain;
    elements.unshift({
      id: `${id}-grid-${i}`,
      type: 'line',
      x1: x,
      y1: axisTop,
      x2: x,
      y2: axisBottom,
      stroke: 'line',
      width: i ? 1 : 2,
      ...show,
    });
    elements.push(
      text(
        `${id}-tick-${i}`,
        `${value / unit} ${i === 2 ? model.currency.unit : ''}`.trim(),
        x,
        axisBottom + small * 1.3,
        small,
        {
          anchor: edgeAnchor(i, 2 + 1),
          font: 'figures',
        },
      ),
    );
  }
  elements.push(
    text(
      id + '-qualification',
      model.qualification,
      margin,
      h * (tall ? 0.79 : 0.87),
      small,
      { width: span, height: h * 0.035 },
    ),
  );
}

export interface DrawBasketPricesContext {
  elements: CanvasElement[];
  id: string;
  model: ReturnType<typeof fixedBasket>;
  margin: number;
  h: number;
  tall: boolean;
  w: number;
  span: number;
  n: number;
  small: number;
  bare: (v: number) => string;
  common: (i: number) => { at: number; enter: string; dur: number };
  geometry: BasketGeometry;
  money: (v: number) => string;
}
