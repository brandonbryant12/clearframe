import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { AT } from './model.mjs';

export function drawCarryoverLabels({
  R,
  lost,
  coinY,
  total,
  cry,
  lineY,
  base,
  t,
  text,
  label,
  T,
  els,
  amount,
  keep,
}: DrawCarryoverLabelsContext) {
  const bx = R + 36;
  const lostMid = lost > 0 ? round((coinY(total - 1) - cry + lineY) / 2) : null;
  const keepMid = round((lineY + base + t + cry) / 2);
  // Keep the two labels clear of each other when either part is thin.
  let [lostY, keepY] = [lostMid, keepMid];
  if (lostY != null && keepY - lostY < 150) {
    const mid = (keepY + lostY) / 2;
    [lostY, keepY] = [round(mid - 75), round(mid + 75)];
  }
  const bracket = (
    y0: number,
    y1: number,
    stroke: string,
    cue: keyof typeof AT,
    dt: number,
  ): CanvasElement =>
    ({
      type: 'path',
      d: `M ${bx} ${round(y0 + 4)} L ${bx + 16} ${round(y0 + 4)} L ${bx + 16} ${round(y1 - 4)} L ${bx} ${round(y1 - 4)}`,
      fill: 'none',
      stroke,
      width: 4,
      cap: 'round',
      join: 'round',
      enter: 'draw',
      dur: 0.45,
      cue,
      at: round(AT[cue] + dt),
      after: dt,
    }) satisfies CanvasElement;
  const amountLabel = (
    y: number,
    figure: string,
    fill: string,
    words: string,
    cue: keyof typeof AT,
    dt: number,
  ): CanvasElement =>
    ({
      type: 'group',
      enter: 'right',
      dist: 30,
      dur: 0.45,
      cue,
      at: round(AT[cue] + dt),
      after: dt,
      children: [
        text(figure, label.x, round(y + 6), T ? 72 : 80, 'bold', fill, {
          fit: label.width,
          enter: 'none',
        }),
        text(words, label.x, round(y + 52), T ? 34 : 36, 'semibold', 'ink', {
          width: label.width,
          leading: 1.15,
          enter: 'none',
        }),
      ],
    }) satisfies CanvasElement;
  if (lost > 0 && lostY != null) {
    els.push(
      bracket(coinY(total - 1) - cry, lineY, 'negative', 'YEAREND', 0.4),
    );
    els.push(
      amountLabel(
        lostY,
        `−${amount(lost)}`,
        'negative',
        'LOSE',
        'YEAREND',
        0.9,
      ),
    );
  }
  els.push(bracket(lineY, base + t + cry, 'accent', 'KEEP', 0));
  els.push(amountLabel(keepY, amount(keep), 'accent', 'KEEP', 'KEEP', 0.15));
}

export interface DrawCarryoverLabelsContext {
  R: number;
  lost: number;
  coinY: (i: number) => number;
  total: number;
  cry: number;
  lineY: number;
  base: number;
  t: number;
  text: (
    s: string,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra?: Partial<CanvasElement>,
  ) => CanvasElement;
  label: { x: number; width: number };
  T: boolean;
  els: CanvasElement[];
  amount: (n: number) => string;
  keep: number;
}
