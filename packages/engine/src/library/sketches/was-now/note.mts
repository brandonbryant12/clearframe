import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { differenceY, differenceWidth, differenceX } from './layout.mjs';

export function drawDifferenceNote({
  note,
  shorter,
  nowX,
  wasX,
  T,
  fitsLeft,
  below,
  big,
  above,
  small,
  x0,
  W,
  els,
  text,
  at,
}: DrawDifferenceNoteContext) {
  if (note) {
    const [from, to] = shorter ? [nowX, wasX] : [wasX, nowX];
    const room = to - from - 48;
    // (Below a cut span only when the new number is not already standing in it.)
    const inSpan = room >= (T ? 330 : 380) && (fitsLeft || !shorter);
    const y = differenceY(inSpan, shorter, below, big, above, small);
    // On its own line it still sits on the side where the change happened.
    const right = !inSpan && (from + to) / 2 > x0 + W / 2;
    const noteW = round(differenceWidth(inSpan, room, T, W));
    els.push(
      text(
        'NOTE',
        differenceX(inSpan, from, right, x0, W),
        round(y),
        small,
        'text',
        'ink',
        {
          width: noteW,
          ...(right ? { anchor: 'end' } : {}),
          enter: 'rise',
          dist: 14,
          cue: 'NOTE',
          at: at.NOTE,
          dur: 0.45,
        },
      ),
    );
    if (inSpan)
      els.push({
        type: 'line',
        x1: from + 20,
        y1: round(y - small * 0.9),
        x2: from + 20,
        y2: round(y + small * 1.6),
        stroke: 'accent',
        width: 4,
        cap: 'round',
        enter: 'draw',
        cue: 'NOTE',
        at: at.NOTE,
        dur: 0.3,
      } satisfies CanvasElement);
  }
}

export interface DrawDifferenceNoteContext {
  note: boolean;
  shorter: boolean;
  nowX: number;
  wasX: number;
  T: boolean;
  fitsLeft: boolean;
  below: { amount: number; label: number };
  big: number;
  above: { amount: number; label: number };
  small: number;
  x0: number;
  W: number;
  els: CanvasElement[];
  text: (
    t: string,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra?: Partial<CanvasElement>,
  ) => CanvasElement;
  at: { CHANGE: number; NOTE: number; WAS: number };
}
