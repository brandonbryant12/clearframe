import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import { round } from '../../../film/sketch-kit.mjs';
import type { BuildOptions } from './contracts.mjs';
import { calendarLayout } from './layout.mjs';
import { deadlineMetrics } from './metrics.mjs';
import { WEEK } from './constants.mjs';
import { drawOpenWindow } from './window.mjs';
import { drawCalendarLegend } from './legend.mjs';

export function buildSketch(
  w: number,
  h: number,
  { params = {} }: BuildOptions = {},
): SketchDrawing {
  const {
    days = 30,
    firstWeekday = 1,
    start = 4,
    end = 18,
    today = 0,
  } = params;
  if (end < start)
    throw new Error(
      `sketchParams.end for deadline must not come before start (got ${start}–${end})`,
    );
  if (end > days || today > days)
    throw new Error(
      `sketchParams for deadline: end and today must fall in a ${days}-day month`,
    );
  const {
    card,
    text,
    pad,
    stacked,
    small,
    cw,
    headH,
    cell,
    R,
    cued,
    num,
    ring,
    key,
    keyGap,
    keyW,
  } = calendarLayout({ firstWeekday, days, w, h, today });
  const metrics = deadlineMetrics(stacked, small);
  const els: CanvasElement[] = [];
  // The card: the month, the weekday row, a hairline under it.
  // The month is on screen from the first frame; only the window and its marks arrive.
  els.push({
    type: 'rect',
    x: card.x,
    y: card.y,
    w: card.w,
    h: card.h,
    r: 28,
    fill: 'surface',
    enter: 'none',
    at: 0,
    shadow: { blur: 40, dy: 18, opacity: 0.14 },
  } satisfies CanvasElement);
  els.push(
    text(
      'MONTH',
      card.x + pad + 10,
      card.y + metrics.monthBaseline,
      metrics.monthType,
      'bold',
      'ink',
      { fit: round(card.w - 2 * pad - 20), enter: 'none', at: 0 },
    ),
  );
  WEEK.forEach((d, i) =>
    els.push(
      text(
        d,
        round(card.x + pad + i * cw + cw / 2),
        card.y + headH - (stacked ? 34 : 26),
        stacked || small ? 28 : 30,
        'semibold',
        'muted',
        {
          anchor: 'middle',
          fit: cw - 6,
          tracking: 0.06,
          enter: 'none',
          at: 0,
        },
      ),
    ),
  );
  els.push({
    type: 'line',
    x1: card.x + pad,
    y1: card.y + headH - 8,
    x2: round(card.x + card.w - pad),
    y2: card.y + headH - 8,
    stroke: 'line',
    width: 2,
    enter: 'none',
    at: 0,
  } satisfies CanvasElement);
  // The open window: one band per week, sweeping on from the opening day to the last.
  drawOpenWindow({ end, start, firstWeekday, cell, els, R, cued });
  // Every day of the month; days outside the window fall back once it closes.
  for (let i = 1; i <= days; i++) {
    const outside = i < start || i > end;
    els.push(
      num(i, 'ink', {
        enter: 'none',
        at: 0,
        ...(outside && i !== today
          ? { keys: [cued('CLOSE', 0.3, { dur: 0.6, opacity: 0.38 })] }
          : {}),
      }),
    );
  }
  // The opening day, filled.
  const [sx, sy] = cell(start);
  // The opening and closing days carry ids (deadline-open, deadline-close): an `into` or a
  // pointer can find them.
  els.push({
    type: 'circle',
    id: 'deadline-open',
    cx: sx,
    cy: sy,
    r: R,
    fill: 'accent',
    enter: 'pop',
    dur: 0.4,
    ...cued('OPEN', 0),
  } satisfies CanvasElement);
  els.push(
    num(start, 'bg', { enter: 'fade', dur: 0.2, ...cued('OPEN', 0.05) }),
  );
  // The last day, filled and circled by hand.
  const [ex, ey] = cell(end);
  if (end !== start) {
    els.push({
      type: 'circle',
      id: 'deadline-close',
      cx: ex,
      cy: ey,
      r: R,
      fill: 'accent',
      enter: 'pop',
      dur: 0.4,
      ...cued('CLOSE', 0),
    } satisfies CanvasElement);
    els.push(
      num(end, 'bg', { enter: 'fade', dur: 0.2, ...cued('CLOSE', 0.05) }),
    );
  }
  els.push({
    type: 'path',
    d: ring(ex, ey, R + 9),
    fill: 'none',
    stroke: 'accent2',
    width: 5,
    cap: 'round',
    join: 'round',
    enter: 'draw',
    dur: 0.7,
    loop: { type: 'pulse', period: 2.6, amount: 0.05 },
    ...cued('CLOSE', 0.15),
  } satisfies CanvasElement);
  // Today: a ring in ink that breathes.
  if (today) {
    const [tx, ty] = cell(today);
    els.push({
      type: 'circle',
      cx: tx,
      cy: ty,
      r: R + 3,
      fill: 'none',
      stroke: 'ink',
      width: 3,
      enter: 'pop',
      dur: 0.4,
      origin: [tx, ty],
      loop: { type: 'pulse', period: 2.2, amount: 0.05 },
      ...cued('TODAY', 0),
    } satisfies CanvasElement);
  }
  // The key: each mark as it appears on the card, and what it means.
  drawCalendarLegend({
    stacked,
    small,
    key,
    keyGap,
    cued,
    text,
    keyW,
    els,
    start,
    end,
    ring,
    today,
  });
  return { elements: els };
}
