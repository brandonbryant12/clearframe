import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

export function coinEntrance(
  ready: boolean,
  grow: boolean,
  cue: 'YOU' | 'MATCH',
  M: {
    NOWYOU: number;
    NOWMATCH: number;
    YOU: number;
    MATCH: number;
    TOTAL: number;
    AGAIN: number;
  },
  i: number,
  at: number,
): Partial<CanvasElement> {
  if (ready && !grow) {
    return { enter: 'none', at: 0 };
  }
  if (ready) {
    return {
      enter: 'drop',
      dist: 260,
      cue: `NOW${cue}`,
      at: round(M[`NOW${cue}`] + i * 0.14),
      after: round(i * 0.14),
      dur: 0.42,
    };
  }
  return {
    enter: 'drop',
    dist: 260,
    cue,
    at,
    after: round(at - M[cue]),
    dur: 0.42,
  };
}

export interface CoinDrawingContext {
  ready: boolean;
  grow: boolean;
  cue: 'YOU' | 'MATCH';
  M: {
    NOWYOU: number;
    NOWMATCH: number;
    YOU: number;
    MATCH: number;
    TOTAL: number;
    AGAIN: number;
  };
  i: number;
  at: number;
  x: number;
  y: number;
  t: 34 | 32;
  rx: number;
  ry: number;
  fill: string;
}

export function coinDrawing({
  ready,
  grow,
  cue,
  M,
  i,
  at,
  x,
  y,
  t,
  rx,
  ry,
  fill,
}: CoinDrawingContext) {
  return {
    type: 'group',
    ...coinEntrance(ready, grow, cue, M, i, at),
    children: [
      {
        type: 'ellipse',
        cx: x,
        cy: y + t,
        rx,
        ry,
        fill,
        enter: 'none',
      } satisfies CanvasElement,
      {
        type: 'rect',
        x: x - rx,
        y,
        w: 2 * rx,
        h: t,
        fill,
        enter: 'none',
      } satisfies CanvasElement,
      {
        type: 'ellipse',
        cx: x,
        cy: y + t,
        rx,
        ry,
        fill: 'ink',
        opacity: 0.22,
        enter: 'none',
      } satisfies CanvasElement,
      {
        type: 'rect',
        x: x - rx,
        y,
        w: 2 * rx,
        h: t,
        fill: 'ink',
        opacity: 0.22,
        enter: 'none',
      } satisfies CanvasElement,
      {
        type: 'ellipse',
        cx: x,
        cy: y,
        rx,
        ry,
        fill,
        stroke: 'bg',
        width: 2,
        enter: 'none',
      } satisfies CanvasElement,
      {
        type: 'ellipse',
        cx: x,
        cy: y,
        rx: round(rx * 0.68),
        ry: round(ry * 0.68),
        fill: 'none',
        stroke: 'bg',
        width: 3,
        opacity: 0.55,
        enter: 'none',
      } satisfies CanvasElement,
    ],
  } satisfies CanvasElement;
}
