import type {
  CanvasElement,
  ElementFields,
} from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import { SAMPLES } from './common.mjs';
import type { lookbackLayout } from './layout.mjs';

export function lookbackPositions(context: ReturnType<typeof lookbackLayout>) {
  let {
    w,
    h,
    end,
    lowStart,
    lo,
    pay,
    vals,
    vtop,
    wide,
    square,
    tagH,
    pillH,
    pillW,
    bw,
    x0,
    x1,
    xs,
    top0,
    axisY,
    rHi,
    wordsBase,
    gainBlock,
    settle,
  } = context;

  // (A phone-tall frame lets the range run taller than the period is wide: the frame is the picture.)
  let capH = Infinity;
  if (!wide) {
    const ratio = square ? 1 : 1.2;
    capH =
      h > w * 1.5 ? Math.max(1.55 * (x1 - x0), 0.48 * h) : ratio * (x1 - x0);
  }

  let H = 600,
    yPay = axisY;

  for (let i = 0; i < 8; i++) {
    const s = settle(H);
    const below = s.pillTop - s.barH + pillH + gainBlock + 36;
    yPay = axisY - Math.max(below, lowStart ? wordsBase + 30 - s.barH : 0);
    H = Math.min(capH, yPay - top0 - 8, (yPay - top0 - 44 - tagH) / rHi);
  }

  // The room a capped range leaves is shared above and below (the picture rises by half of it).
  const used = Math.min(yPay - H - 8, yPay - rHi * H - 44 - tagH);

  const shift = -round(Math.max(0, used - top0) / 2);

  axisY = round(axisY + shift);

  yPay = round(yPay + shift);

  H = round(H);

  const yOf = (v: number) => round(yPay - ((v - pay) / (vtop - pay)) * H);

  const yLo = yOf(lo),
    yEnd = yOf(end);

  const { barH, pctC, pillTop } = settle(H);

  // What you pay hangs under the bar, right-aligned to it.
  const pill = {
    x: round(xs + bw / 2 - pillW),
    y: round(yLo + pillTop),
    w: pillW,
    h: pillH,
  };

  const pcy = pill.y + pillH / 2;

  const pts = vals.map((v, i) => [x0 + (i / SAMPLES) * (x1 - x0), yOf(v)]);

  const text = (
    t: string,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra: ElementFields = {},
  ): CanvasElement =>
    ({
      type: 'text',
      text: t,
      x: round(x),
      y: round(y),
      size: round(size),
      font,
      fill,
      ...extra,
    }) satisfies CanvasElement;

  const under: CanvasElement[] = [],
    els: CanvasElement[] = [],
    hand: CanvasElement[] = [];
  return {
    ...context,
    end,
    lowStart,
    pay,
    vtop,
    wide,
    tagH,
    pillH,
    pillW,
    bw,
    x0,
    x1,
    xs,
    axisY,
    wordsBase,
    yPay,
    yOf,
    yLo,
    yEnd,
    barH,
    pctC,
    pill,
    pcy,
    pts,
    text,
    under,
    els,
    hand,
  };
}
