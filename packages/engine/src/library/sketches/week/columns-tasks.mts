import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { CUES } from './common.mjs';

import type { weekColumnsToday } from './columns-today.mjs';
export function weekColumnsTasks(context: ReturnType<typeof weekColumnsToday>) {
  const {
    cued,
    text,
    byDay,
    box,
    settle,
    els,
    inset,
    fs,
    cb,
    padX,
    padY,
    cols,
    cardW,
    above,
    textW,
    lift,
    cardH,
    slotY,
  } = context;

  // The tasks, each dropping into its day on its word, empty, its words typing in as it lands
  // (a change that lasts long enough to read as one, not a blink).
  byDay.forEach((list, d) =>
    list.forEach((i, j) => {
      const b = {
        x: cols[d].x + inset,
        y: slotY(j),
        w: cardW(d),
        h: cardH,
      };
      els.push({
        type: 'group',
        enter: 'drop',
        dist: 110,
        dur: 0.6,
        shadow: { blur: 22, dy: 9, opacity: 0.18 },
        origin: [round(b.x + b.w / 2), round(b.y + b.h / 2)],
        ...cued(CUES[i]),
        keys: settle(CUES[i], 4),
        children: [
          {
            type: 'rect',
            ...b,
            r: 14,
            fill: 'bg',
            stroke: 'line',
            width: 2,
            enter: 'none',
          } satisfies CanvasElement,
          box(
            b.x + padX,
            above ? b.y + padY : b.y + padY + fs * 0.64 - cb / 2,
            cb,
            CUES[i],
          ),
          text(
            `TASK${i + 1}`,
            above ? b.x + padX : b.x + padX + cb + 14,
            round(b.y + padY + lift + fs),
            fs,
            'semibold',
            'ink',
            {
              width: textW(d),
              height: b.h - 2 * padY - lift,
              leading: 1.15,
              enter: 'type',
              dur: 0.9,
              ...cued(CUES[i], 0.25),
            },
          ),
        ],
      } satisfies CanvasElement);
    }),
  );
  return { ...context, cued, text, byDay, els, inset, fs, cols, cardW, slotY };
}
