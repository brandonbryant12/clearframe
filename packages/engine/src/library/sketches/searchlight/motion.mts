import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { tall, round } from '../../../film/sketch-kit.mjs';
import { AT, LABELS } from './common.mjs';
import type { searchlightRoom } from './room.mjs';

export function searchlightMotion(context: ReturnType<typeof searchlightRoom>) {
  const { w, h, L, boardH, finds } = context;

  const shelves = L.units.flatMap((unit) => [
    {
      type: 'rect',
      x: unit.x,
      y: unit.boards[0],
      w: 14,
      h: L.floor - unit.boards[0],
      fill: 'muted',
    } satisfies CanvasElement,
    {
      type: 'rect',
      x: unit.x + unit.w - 14,
      y: unit.boards[0],
      w: 14,
      h: L.floor - unit.boards[0],
      fill: 'muted',
    } satisfies CanvasElement,
    ...unit.boards.map(
      (b): CanvasElement =>
        ({
          type: 'rect',
          x: unit.x,
          y: b,
          w: unit.w,
          h: boardH,
          fill: 'muted',
        }) satisfies CanvasElement,
    ),
  ]);

  // The torch: a pool of light that leaves the room dark around it, carried find to find.
  const [sx, sy] = L.start,
    r = round(Math.min(w, h) * 0.17);

  // SEARCH sweeps the torch across the room before anything is found; then it goes find to find.
  const moves = [
    {
      cue: 'SEARCH',
      at: AT.SEARCH,
      x: round(w * (tall(w, h) ? 0.2 : 0.3)),
      y: round(-h * 0.3),
      dur: 1.5,
      ease: 'inOut',
    },
    ...finds.map((f, i) => ({
      cue: LABELS[i],
      at: AT[LABELS[i]],
      x: f.x - sx,
      y: f.b - 70 - sy,
      dur: 0.7,
      ease: 'inOut',
    })),
  ];

  // A hand-held torch: the pool never stands quite still.
  const sway = { type: 'float', period: 2.6, amount: 10 };

  const thread = finds
    .map((f, i) => `${i ? 'L' : 'M'} ${f.x} ${f.b - 60}`)
    .join(' ');
  return {
    ...context,
    w,
    h,
    L,
    finds,
    shelves,
    sx,
    sy,
    r,
    moves,
    sway,
    thread,
  };
}
