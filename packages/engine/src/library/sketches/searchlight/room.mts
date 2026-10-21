import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { tall, round, rng } from '../../../film/sketch-kit.mjs';
import type { BuildOptions } from './common.mjs';
import { layout } from './common.mjs';

export function searchlightRoom(
  w: number,
  h: number,
  { seed }: BuildOptions = {},
) {
  const L = layout(w, h),
    rand = rng(seed ?? 7),
    boardH = 12,
    size = tall(w, h) ? 44 : 38;

  const finds = L.finds.map((f) => ({
    ...f,
    x: f.cx,
    b: L.units[f.unit].boards[f.board],
  }));

  // Clutter: boxes on every board, left to right, leaving room for a find.
  const clutter: CanvasElement[] = [];

  for (const [u, unit] of L.units.entries())
    unit.boards.slice(1).forEach((b, i) => {
      const gap = b - unit.boards[i];
      let x = unit.x + 18 + rand() * 20;
      while (x < unit.x + unit.w - 60) {
        const bw = round(40 + rand() * 70),
          bh = round(gap * (0.35 + rand() * 0.4));
        const clear = finds.every(
          (f) =>
            f.unit !== u || f.b !== b || x + bw < f.x - 110 || x > f.x + 110,
        );
        if (clear && x + bw < unit.x + unit.w - 16)
          clutter.push({
            type: 'rect',
            x: round(x),
            y: b - bh,
            w: bw,
            h: bh,
            r: 3,
            fill: rand() < 0.5 ? 'surface' : 'muted',
          } satisfies CanvasElement);
        x += bw + 8 + rand() * 22;
      }
    });
  return { w, h, L, boardH, size, finds, clutter };
}
