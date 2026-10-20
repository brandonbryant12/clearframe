import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round, tall, body } from '../../../film/sketch-kit.mjs';
import { NAMES, ROW0, STEP } from './model.mjs';

export function cardHeight(stacked: boolean, n: number) {
  if (stacked) {
    return 94;
  }
  if (n > 3) {
    return 106;
  }
  if (n > 2) {
    return 124;
  }
  return 132;
}

export function choiceLayout(rows: string[], w: number, h: number) {
  const n = rows.length;
  const AT = Object.fromEntries(
    NAMES.slice(0, n).map((k, i) => [k, round(ROW0 + i * STEP)]),
  );
  AT.PICK = round(ROW0 + (n - 1) * STEP + 1.6);

  const T = tall(w, h);
  const b = body(w, h);
  // Stacked cards need the height of a full vertical frame; anything shorter sits side by side.
  const stacked = T && h >= 1600;
  const colors = ['accent', 'accent2'];
  const sides = ['a', 'b'];
  const wins = (row: string, s: string) => row === 'both' || row === s;
  const text = (
    t: string,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra = {},
  ): CanvasElement =>
    ({
      type: 'text',
      ...(t == null ? {} : { text: t }),
      x,
      y,
      size,
      font,
      fill,
      enter: 'none',
      ...extra,
    }) satisfies CanvasElement;

  // Layout: card rects, row centres and (side by side) a label column between the cards.
  let cards: { x: number; y: number; w: number; h: number }[];
  let rowY: (card: number, row: number) => number;
  let labelX = 0,
    labelW = 0,
    labelSize = 0,
    narrowCards = false;
  const head = stacked ? 124 : 150;
  const rh = cardHeight(stacked, n);
  const foot = stacked ? 22 : 34;
  const ch = head + n * rh + foot;
  if (stacked) {
    const cw = w - 180,
      gap = 56;
    const y0 = round(b.y + (b.h - (2 * ch + gap)) / 2 - 30);
    cards = [0, 1].map((i) => ({
      x: round((w - cw) / 2),
      y: round(y0 + i * (ch + gap)),
      w: cw,
      h: ch,
    }));
    rowY = (c: number, i: number) => round(cards[c].y + head + rh * (i + 0.5));
  } else {
    const unit = Math.min(1, b.w / 1600);
    const cw = round(480 * unit),
      gap = round(40 * unit);
    labelW = round(560 * unit);
    const x0 = round((w - (2 * cw + labelW + 2 * gap)) / 2);
    const y0 = round(Math.max(b.y - 20, b.y + (b.h - ch) / 2 - 10));
    cards = [0, 1].map((i) => ({
      x: round(x0 + i * (cw + labelW + 2 * gap)),
      y: y0,
      w: cw,
      h: ch,
    }));
    labelX = round(w / 2);
    labelSize = round(42 * Math.max(unit, 0.76));
    narrowCards = unit < 0.8;
    rowY = (c, i) => round(y0 + head + rh * (i + 0.5));
  }

  // A row's mark: a tick in a filled disc for the winner, a quiet dash for the other.
  return {
    AT,
    stacked,
    colors,
    sides,
    wins,
    text,
    cards,
    rowY,
    labelX,
    labelW,
    labelSize,
    narrowCards,
    head,
    rh,
  };
}
