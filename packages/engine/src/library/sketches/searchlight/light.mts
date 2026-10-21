import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { tall, round } from '../../../film/sketch-kit.mjs';
import { AT } from './common.mjs';
import type { SearchlightContext } from './contracts.mjs';
export function searchlightLight(context: SearchlightContext): CanvasElement[] {
  const { w, h, L, sx, sy, r, moves, sway } = context;
  return [
    // Dust drifting through the room: drawn under the dark, so it shows in the torch's pool.
    {
      type: 'particles',
      x: 0,
      y: 0,
      w,
      h: L.floor,
      kind: 'dust',
      count: tall(w, h) ? 70 : 90,
      seed: 7,
      size: 3,
      speed: 0.6,
      fill: 'ink',
      opacity: 0.55,
      enter: 'none',
      at: 0,
    } satisfies CanvasElement,

    {
      // The dark is near-black on any palette (a dark room is dark, even on paper).
      type: 'spotlight',
      cx: sx,
      cy: sy,
      r,
      dim: 0.86,
      fill: '#07090d',
      enter: 'none',
      at: 0,
      keys: moves,
      loop: sway,
      exit: 'fade',
      exitCue: 'ALL',
      exitAt: AT.ALL,
      exitDur: 0.8,
    } satisfies CanvasElement,

    // Warm light in the pool, riding with it.
    {
      type: 'circle',
      cx: sx,
      cy: sy,
      r: round(r * 1.05),
      fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true },
      opacity: 0.22,
      blend: 'screen',
      enter: 'none',
      at: 0,
      keys: moves,
      loop: sway,
      exit: 'fade',
      exitCue: 'ALL',
      exitAt: AT.ALL,
      exitDur: 0.8,
    } satisfies CanvasElement,
  ];
}
