import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { weekColumnsDue } from './columns-due.mjs';
export function weekColumnsAfter(context: ReturnType<typeof weekColumnsDue>) {
  const {
    due,
    after,
    cued,
    text,
    LAND,
    slip,
    els,
    aw,
    ag,
    card,
    fs,
    cols,
    pill,
    pcy,
  } = context;

  // After: a muted card past the week's right edge, an arrow pushing out to it.
  if (after) {
    const ah = 132;
    const ab = { y: 0, x: card.x + card.w + ag, w: aw, h: ah };
    ab.y = round(
      Math.min(Math.max(pcy - ah / 2, card.y), card.y + card.h - ah),
    );
    const acy = round(ab.y + ah / 2),
      y0 = round(pcy),
      edge = card.x + card.w + 4,
      mid = round((edge + ab.x) / 2);
    // Out along the due day's row, past the week's edge, bending to the card if it sits lower.
    const route = (from: number, to: number) =>
      Math.abs(acy - y0) < 1
        ? `M ${from} ${y0} L ${to} ${y0}`
        : `M ${from} ${y0} L ${edge} ${y0} C ${mid} ${y0} ${mid} ${acy} ${to} ${acy}`;
    els.push({
      type: 'path',
      d: route(pill.x + pill.w + 10, ab.x - 14),
      fill: 'none',
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
    els.push(slip(pill, route(cols[due].cx, ab.x + 40)));
    els.push({
      type: 'group',
      enter: 'left',
      dist: 40,
      dur: 0.5,
      ...cued('AFTER', LAND),
      children: [
        {
          type: 'rect',
          ...ab,
          r: 20,
          fill: 'surface',
          stroke: 'muted',
          width: 3,
          dash: [10, 8],
          enter: 'none',
        } satisfies CanvasElement,
        {
          type: 'icon',
          name: 'calendar-event',
          x: ab.x + 40,
          y: ab.y + 46,
          size: 40,
          stroke: 'muted',
          enter: 'none',
        } satisfies CanvasElement,
        text('AFTER', ab.x + 74, ab.y + 26 + fs, fs, 'semibold', 'muted', {
          width: ab.w - 74 - 18,
          height: ah - 44,
          leading: 1.15,
          enter: 'type',
          dur: 0.7,
          ...cued('AFTER', LAND + 0.2),
        }),
      ],
    } satisfies CanvasElement);
  }
  return { ...context };
}
