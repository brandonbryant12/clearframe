import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { AT } from './model.mjs';

export function drawRemainingCapacity({
  left,
  x1,
  fillEnd,
  els,
  ty,
  trackH,
  leftInside,
  row1,
  row2,
  above,
  text,
  money,
  big,
  small,
}: DrawRemainingCapacityContext) {
  if (left > 0) {
    const gw = round(x1 - fillEnd);
    els.push({
      type: 'rect',
      x: fillEnd,
      y: ty,
      w: gw,
      h: trackH,
      r: round(Math.min(trackH / 2, gw / 2)),
      fill: 'none',
      stroke: 'accent2',
      width: 5,
      dash: [16, 11],
      enter: 'draw',
      cue: 'LEFT',
      at: AT.LEFT,
      dur: 0.6,
    } satisfies CanvasElement);
    const at = leftInside
      ? { x: round((fillEnd + x1) / 2), y: row1, y2: row2, anchor: 'middle' }
      : { x: x1, y: above.amount, y2: above.label, anchor: 'end' };
    els.push(
      text(money(left), at.x, at.y, big, 'bold', 'accent2', {
        anchor: at.anchor,
        enter: 'rise',
        dist: 18,
        cue: 'LEFT',
        at: round(AT.LEFT + 0.3),
        dur: 0.45,
      }),
    );
    els.push(
      text('LEFTLABEL', at.x, at.y2, small, 'strong', 'muted', {
        anchor: at.anchor,
        enter: 'fade',
        cue: 'LEFT',
        at: round(AT.LEFT + 0.5),
        dur: 0.4,
      }),
    );
  }
}

export interface DrawRemainingCapacityContext {
  left: number;
  x1: number;
  fillEnd: number;
  els: CanvasElement[];
  ty: number;
  trackH: number;
  leftInside: boolean;
  row1: number;
  row2: number;
  above: { label: number; amount: number };
  text: (
    t: string | null,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra?: Partial<CanvasElement>,
  ) => CanvasElement;
  money: (v: number) => string;
  big: number;
  small: number;
}
