import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { weekAgendaDue } from './agenda-due.mjs';
export function weekAgendaAfter(context: ReturnType<typeof weekAgendaDue>) {
  const {
    after,
    cued,
    text,
    LAND,
    slip,
    els,
    lane,
    k,
    s,
    card,
    inner,
    pill,
    pcx,
  } = context;

  // After: a muted card under the week, an arrow pushing down past its edge (through the
  // days after the due day, which hold no tasks).
  if (after) {
    const ab = {
      x: lane.x,
      y: round(card.y + card.h + s.afterGap),
      w: lane.w,
      h: round(s.afterH),
    };
    const acy = round(ab.y + ab.h / 2);
    els.push({
      type: 'line',
      x1: pcx,
      y1: pill.y + pill.h + 10,
      x2: pcx,
      y2: ab.y - 14,
      stroke: 'muted',
      width: 5,
      dash: [14, 10],
      cap: 'round',
      arrow: 'end',
      enter: 'draw',
      dur: 0.8,
      loop: { type: 'dash', period: 1.4 },
      ...cued('AFTER'),
    } satisfies CanvasElement);
    els.push(
      slip(pill, `M ${pcx} ${round(pill.y + pill.h / 2)} L ${pcx} ${acy}`),
    );
    els.push({
      type: 'group',
      enter: 'drop',
      dist: 40,
      dur: 0.5,
      ...cued('AFTER', LAND),
      children: [
        {
          type: 'rect',
          ...ab,
          r: round(20 * k),
          fill: 'surface',
          stroke: 'muted',
          width: 3,
          dash: [10, 8],
          enter: 'none',
        } satisfies CanvasElement,
        {
          type: 'icon',
          name: 'calendar-event',
          x: round(ab.x + inner + 22 * k),
          y: round(acy),
          size: round(44 * k),
          stroke: 'muted',
          enter: 'none',
        } satisfies CanvasElement,
        text(
          'AFTER',
          round(ab.x + inner + 64 * k),
          round(acy + s.afs * 0.36),
          round(s.afs),
          'semibold',
          'muted',
          {
            fit: round(ab.w - 2 * inner - 64 * k),
            enter: 'type',
            dur: 0.7,
            ...cued('AFTER', LAND + 0.2),
          },
        ),
      ],
    } satisfies CanvasElement);
  }
  return { ...context };
}
