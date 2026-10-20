import type {
  CanvasElement,
  ElementFields,
} from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { WEEK } from './common.mjs';

import type { weekAgendaLayout } from './agenda-layout.mjs';
export function weekAgendaGrid(context: ReturnType<typeof weekAgendaLayout>) {
  const {
    today,
    due,
    cued,
    text,
    byDay,
    weekend,
    els,
    X0,
    X1,
    labW,
    labX,
    labH,
    s,
    rowH,
    card,
    rowY,
    rowC,
  } = context;

  // The week, there from the first frame.
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
      x: X0 + 8,
      y: rowY[d] + 3,
      w: card.w - 16,
      h: rowH[d] - 6,
      r: 18,
      fill,
      opacity,
      ...extra,
    }) satisfies CanvasElement;

  byDay.forEach(
    (_, d) =>
      weekend(d) && els.push(tint(d, 'bg', 0.45, { enter: 'none', at: 0 })),
  );

  els.push(
    tint(today, 'ink', 0.07, { enter: 'fade', dur: 0.5, ...cued('TODAY') }),
  );

  if (due !== today)
    els.push(
      tint(due, 'wash', 0.6, { enter: 'fade', dur: 0.5, ...cued('DUE') }),
    );

  byDay.slice(1).forEach((_, i) =>
    els.push({
      type: 'line',
      x1: X0 + 24,
      y1: rowY[i + 1],
      x2: X1 - 24,
      y2: rowY[i + 1],
      stroke: 'line',
      width: 2,
      enter: 'none',
      at: 0,
    } satisfies CanvasElement),
  );

  els.push({
    type: 'line',
    x1: X0 + labW,
    y1: card.y + 20,
    x2: X0 + labW,
    y2: card.y + card.h - 20,
    stroke: 'line',
    width: 2,
    enter: 'none',
    at: 0,
  } satisfies CanvasElement);

  // Day names, centred in their cells; today's sits over its marker.
  const nameY = (d: number) =>
    round(
      d === today
        ? rowC(d) - labH(d, s) / 2 + s.day * 0.86
        : rowC(d) + s.day * 0.36,
    );

  byDay.forEach((_, d) =>
    els.push(
      text(
        WEEK[d],
        round(labX),
        nameY(d),
        round(s.day),
        'semibold',
        weekend(d) ? 'muted' : 'ink',
        {
          anchor: 'middle',
          fit: labW - 32,
          tracking: 0.06,
          enter: 'none',
          at: 0,
        },
      ),
    ),
  );
  return {
    ...context,
    today,
    due,
    cued,
    text,
    byDay,
    els,
    labW,
    labX,
    s,
    card,
    rowC,
    nameY,
  };
}
