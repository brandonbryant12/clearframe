import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { weekAgendaGrid } from './agenda-grid.mjs';
export function weekAgendaToday(context: ReturnType<typeof weekAgendaGrid>) {
  const { today, cued, text, els, labW, labX, s, nameY } = context;

  // Today: a marker under its day's name.
  const tw = labW - 40,
    ty = round(nameY(today) + s.day * 0.24 + s.tgap);

  els.push({
    type: 'group',
    enter: 'pop',
    dur: 0.4,
    ...cued('TODAY'),
    children: [
      {
        type: 'rect',
        x: round(labX - tw / 2),
        y: ty,
        w: tw,
        h: round(s.todayH),
        r: round(s.todayH / 2),
        fill: 'ink',
        enter: 'none',
      } satisfies CanvasElement,
      text(
        'TODAY',
        round(labX),
        round(ty + s.todayH / 2 + s.tfs * 0.36),
        round(s.tfs),
        'bold',
        'bg',
        { anchor: 'middle', fit: tw - 26, enter: 'none' },
      ),
    ],
  } satisfies CanvasElement);
  return { ...context, cued, text, els, labW, labX, s, nameY };
}
