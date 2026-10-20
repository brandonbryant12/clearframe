import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { weekColumnsTasks } from './columns-tasks.mjs';
export function weekColumnsDue(context: ReturnType<typeof weekColumnsTasks>) {
  const {
    due,
    after,
    AT,
    cued,
    text,
    byDay,
    ring,
    els,
    marks,
    card,
    inset,
    pillH,
    cols,
    cardW,
    slotY,
  } = context;

  // The due day: circled by hand, its label under the tasks of that day.
  const pill = {
    x: cols[due].x + inset,
    y: slotY(byDay[due].length),
    w: cardW(due),
    h: pillH,
  };

  const pcy = pill.y + pillH / 2;

  marks.push({
    type: 'path',
    d: ring(cols[due].cx, card.y + 51, Math.min(cols[due].w / 2 - 16, 80), 33),
    fill: 'none',
    stroke: 'accent',
    width: 5,
    cap: 'round',
    join: 'round',
    enter: 'draw',
    dur: 0.7,
    loop: { type: 'pulse', period: 2.6, amount: 0.04 },
    ...cued('DUE'),
  } satisfies CanvasElement);

  els.push({
    type: 'group',
    enter: 'pop',
    dur: 0.4,
    origin: [cols[due].cx, round(pcy)],
    ...cued('DUE', 0.25),
    // When the day is missed, it gives a little shove toward what comes after.
    ...(after
      ? {
          keys: [
            {
              cue: 'AFTER',
              at: AT.AFTER,
              dur: 0.7,
              ease: 'thereAndBack',
              x: 14,
            },
          ],
        }
      : {}),
    children: [
      {
        type: 'rect',
        ...pill,
        r: pillH / 2,
        fill: 'accent',
        enter: 'none',
      } satisfies CanvasElement,
      text('DUE', cols[due].cx, round(pcy + 30 * 0.36), 30, 'bold', 'bg', {
        anchor: 'middle',
        fit: pill.w - 36,
        enter: 'none',
      }),
    ],
  } satisfies CanvasElement);
  return { ...context, due, after, cued, text, els, card, cols, pill, pcy };
}
