import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { AT } from './common.mjs';
import type { SearchlightContext } from './contracts.mjs';
export function searchlightFloor(context: SearchlightContext): CanvasElement[] {
  const { w, h, L, clutter, shelves, thread } = context;
  return [
    {
      type: 'rect',
      x: 0,
      y: L.floor,
      w,
      h: h - L.floor,
      fill: 'surface',
      opacity: 0.55,
      enter: 'none',
      at: 0,
    } satisfies CanvasElement,

    {
      type: 'group',
      enter: 'none',
      at: 0,
      children: [...shelves, ...clutter],
    } satisfies CanvasElement,

    // The thread runs behind the finds, from one to the next, once the room is lit.
    {
      type: 'path',
      d: thread,
      fill: 'none',
      stroke: 'accent2',
      width: 6,
      dash: [16, 12],
      enter: 'draw',
      cue: 'ALL',
      at: AT.ALL + 0.3,
      dur: 1.2,
    } satisfies CanvasElement,
  ];
}
