import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { weekColumnsGrid } from './columns-grid.mjs';
export function weekColumnsToday(context: ReturnType<typeof weekColumnsGrid>) {
  const { today, cued, text, els, card, cols } = context;

  // Today: a flag over its column.
  const tc = cols[today],
    fw = Math.min(tc.w - 16, 190),
    fy = card.y - 72;

  els.push({
    type: 'group',
    enter: 'drop',
    dist: 24,
    dur: 0.45,
    ...cued('TODAY'),
    children: [
      {
        type: 'rect',
        x: round(tc.cx - fw / 2),
        y: fy,
        w: fw,
        h: 50,
        r: 25,
        fill: 'ink',
        enter: 'none',
      } satisfies CanvasElement,
      {
        type: 'poly',
        points: [
          [tc.cx - 12, fy + 48],
          [tc.cx + 12, fy + 48],
          [tc.cx, fy + 64],
        ],
        closed: true,
        fill: 'ink',
        enter: 'none',
      },
      text('TODAY', tc.cx, fy + 35, 28, 'bold', 'bg', {
        anchor: 'middle',
        fit: fw - 32,
        enter: 'none',
      }),
    ],
  } satisfies CanvasElement);
  return { ...context, cued, text, els, card, cols };
}
