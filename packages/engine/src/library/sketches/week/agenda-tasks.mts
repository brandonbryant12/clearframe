import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { CUES } from './common.mjs';

import type { weekAgendaToday } from './agenda-today.mjs';
export function weekAgendaTasks(context: ReturnType<typeof weekAgendaToday>) {
  const { cued, text, byDay, box, settle, els, lane, laneH, k, s, rowC } =
    context;

  // The tasks, each dropping into its day's row on its word.
  const itemY = (d: number, j: number) =>
    round(rowC(d) - laneH(d, s) / 2 + j * (s.cardH + s.gap));

  const inner = round(24 * k);

  byDay.forEach((list, d) =>
    list.forEach((i, j) => {
      const b = { x: lane.x, y: itemY(d, j), w: lane.w, h: round(s.cardH) };
      const cy = b.y + b.h / 2;
      els.push({
        type: 'group',
        enter: 'drop',
        dist: round(60 * k),
        dur: 0.5,
        shadow: { blur: 22, dy: 9, opacity: 0.18 },
        origin: [round(b.x + b.w / 2), round(cy)],
        ...cued(CUES[i]),
        keys: settle(CUES[i], 1.5),
        children: [
          {
            type: 'rect',
            ...b,
            r: round(18 * k),
            fill: 'bg',
            stroke: 'line',
            width: 2,
            enter: 'none',
          } satisfies CanvasElement,
          box(b.x + inner, cy - s.cb / 2, s.cb, CUES[i]),
          text(
            `TASK${i + 1}`,
            round(b.x + inner + s.cb + 20 * k),
            round(cy + s.fs * 0.36),
            round(s.fs),
            'semibold',
            'ink',
            {
              fit: round(b.w - 2 * inner - s.cb - 20 * k),
              enter: 'type',
              dur: 0.9,
              ...cued(CUES[i], 0.25),
            },
          ),
        ],
      } satisfies CanvasElement);
    }),
  );
  return { ...context, cued, text, byDay, els, lane, k, s, itemY, inner };
}
