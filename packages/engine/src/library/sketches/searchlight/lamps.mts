import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { AT } from './common.mjs';
import type { SearchlightContext } from './contracts.mjs';
export function searchlightLamps(context: SearchlightContext): CanvasElement[] {
  const { L } = context;
  return [
    // Lamps hang dark until the room is lit.
    ...L.lamps.flatMap((x) => [
      {
        type: 'line',
        x1: x,
        y1: 0,
        x2: x,
        y2: round(L.units[0].boards[0] * 0.45),
        stroke: 'muted',
        width: 3,
        enter: 'none',
        at: 0,
      } satisfies CanvasElement,
      {
        type: 'path',
        d: `M ${x - 34} ${round(L.units[0].boards[0] * 0.45) + 34} L ${x - 14} ${round(L.units[0].boards[0] * 0.45)} L ${x + 14} ${round(L.units[0].boards[0] * 0.45)} L ${x + 34} ${round(L.units[0].boards[0] * 0.45) + 34} Z`,
        fill: 'muted',
        enter: 'none',
        at: 0,
      } satisfies CanvasElement,
      {
        type: 'circle',
        cx: x,
        cy: round(L.units[0].boards[0] * 0.45) + 40,
        r: 12,
        fill: 'accent2',
        glow: { blur: 30, opacity: 0.9 },
        enter: 'fade',
        cue: 'ALL',
        at: AT.ALL,
        dur: 0.5,
      } satisfies CanvasElement,
    ]),
  ];
}
