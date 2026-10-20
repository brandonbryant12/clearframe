import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { weekAgendaTasks } from './agenda-tasks.mjs';
export function weekAgendaDue(context: ReturnType<typeof weekAgendaTasks>) {
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
    labW,
    labX,
    lane,
    s,
    nameY,
    itemY,
  } = context;

  // The due day: its name circled by hand, its label after the tasks of that day.
  const pill = {
    x: lane.x,
    y: itemY(due, byDay[due].length),
    w: round(lane.w * 0.62),
    h: round(s.pillH),
  };

  const pcx = round(pill.x + pill.w / 2);

  marks.push({
    type: 'path',
    d: ring(
      round(labX),
      round(nameY(due) - s.day * 0.36),
      round(labW / 2 - 26),
      round(s.day * 0.82),
    ),
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
    origin: [pcx, round(pill.y + pill.h / 2)],
    ...cued('DUE', 0.25),
    ...(after
      ? {
          keys: [
            {
              cue: 'AFTER',
              at: AT.AFTER,
              dur: 0.7,
              ease: 'thereAndBack',
              y: 12,
            },
          ],
        }
      : {}),
    children: [
      {
        type: 'rect',
        ...pill,
        r: round(pill.h / 2),
        fill: 'accent',
        enter: 'none',
      } satisfies CanvasElement,
      text(
        'DUE',
        pcx,
        round(pill.y + pill.h / 2 + s.pfs * 0.36),
        round(s.pfs),
        'bold',
        'bg',
        { anchor: 'middle', fit: pill.w - 40, enter: 'none' },
      ),
    ],
  } satisfies CanvasElement);
  return { ...context, after, cued, text, els, lane, s, pill, pcx };
}
