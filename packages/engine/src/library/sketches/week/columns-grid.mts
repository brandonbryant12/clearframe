import type {
  CanvasElement,
  ElementFields,
} from '../../../film/contracts/canvas.mjs';

import { WEEK } from './common.mjs';

import type { weekColumnsLayout } from './columns-layout.mjs';
export function weekColumnsGrid(context: ReturnType<typeof weekColumnsLayout>) {
  const { today, due, cued, text, weekend, els, card, headH, cols } = context;

  // The week, there from the first frame: the card, weekend shading, day names and rules.
  els.push({
    type: 'rect',
    ...card,
    r: 28,
    fill: 'surface',
    enter: 'none',
    at: 0,
    shadow: { blur: 40, dy: 18, opacity: 0.14 },
  } satisfies CanvasElement);

  const tint = (
    d: number,
    fill: string,
    opacity: number,
    extra: ElementFields,
  ) =>
    ({
      type: 'rect',
      x: cols[d].x + 4,
      y: card.y + 10,
      w: cols[d].w - 8,
      h: card.h - 20,
      r: 18,
      fill,
      opacity,
      ...extra,
    }) satisfies CanvasElement;

  cols.forEach(
    (c, d) =>
      weekend(d) && els.push(tint(d, 'bg', 0.45, { enter: 'none', at: 0 })),
  );

  els.push(
    tint(today, 'ink', 0.07, { enter: 'fade', dur: 0.5, ...cued('TODAY') }),
  );

  if (due !== today)
    els.push(
      tint(due, 'wash', 0.6, { enter: 'fade', dur: 0.5, ...cued('DUE') }),
    );

  cols.forEach((c, d) =>
    els.push(
      text(
        WEEK[d],
        c.cx,
        card.y + 64,
        36,
        'semibold',
        weekend(d) ? 'muted' : 'ink',
        {
          anchor: 'middle',
          fit: c.w - 24,
          tracking: 0.06,
          enter: 'none',
          at: 0,
        },
      ),
    ),
  );

  els.push({
    type: 'line',
    x1: card.x + 24,
    y1: card.y + headH,
    x2: card.x + card.w - 24,
    y2: card.y + headH,
    stroke: 'line',
    width: 2,
    enter: 'none',
    at: 0,
  } satisfies CanvasElement);

  cols.slice(1).forEach((c) =>
    els.push({
      type: 'line',
      x1: c.x,
      y1: card.y + 24,
      x2: c.x,
      y2: card.y + card.h - 24,
      stroke: 'line',
      width: 2,
      enter: 'none',
      at: 0,
    } satisfies CanvasElement),
  );
  return { ...context, today, due, cued, text, els, card, cols };
}
