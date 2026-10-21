import { chartMargin } from '../drawing/chart-margin.mjs';
import { round } from '../../../film/sketch-kit.mjs';

import type { lookbackPrices } from './prices.mjs';

export function lookbackLayout(context: ReturnType<typeof lookbackPrices>) {
  const { w, h, start, end, gain, fmt, lowStart, lo, hi, pay, vtop } = context;

  // Type: wide frames read at a distance; 1080-wide frames are sized for a phone.
  const wide = w > h * 1.25,
    square = !wide && h < w * 1.15;

  const F = Object.fromEntries(
    Object.entries(
      wide
        ? {
            tag: 46,
            words: 36,
            date: 34,
            period: 36,
            pct: 52,
            pay: 52,
            payWords: 42,
            gain: 54,
            gainWords: 34,
          }
        : {
            tag: 54,
            words: 42,
            date: 40,
            period: 42,
            pct: 58,
            pay: 60,
            payWords: 48,
            gain: 58,
            gainWords: 42,
          },
    ).map(([k, v]) => [k, round(square ? v * 0.88 : v)]),
  );

  const cap = (s: number) => 0.72 * s;

  const numW = (s: string, size: number) => s.length * 0.62 * size;

  // Long prices ("$1,234.56") set their tags and pill smaller rather than squeeze the period.
  F.tag = Math.min(
    F.tag,
    round(
      (wide ? 300 : w * 0.22) /
        (Math.max(fmt(start).length, fmt(end).length) * 0.62 + 0.9),
    ),
  );

  F.pay = Math.min(
    F.pay,
    round((wide ? 380 : w * 0.32) / (fmt(pay).length * 0.62 + 1.1)),
  );

  // A price's tag is a tooltip: its day, small, over the price.
  const tagD = round(F.tag * (wide ? 0.6 : 0.68)),
    tagPad = round(F.tag * 0.3),
    tagGap = round(F.tag * 0.26);

  const tagH = round(2 * tagPad + cap(tagD) + tagGap + cap(F.tag) + 4),
    tagW = (v: number) =>
      round(Math.max(numW(fmt(v), F.tag), 5.5 * 0.56 * tagD) + F.tag * 0.9);

  const pillH = round(F.pay * 1.42),
    pillW = round(numW(fmt(pay), F.pay) + F.pay * 1.1);

  const dotR = wide ? 13 : 14,
    bw = wide ? 84 : 76;

  // Across: the start's tag hangs left of the period; past its end, the purchase column (the
  // bar, the gain's bracket and, in wide frames, the gain's words beside it). Type keeps to the
  // title-safe width (a frame taller than wide loses a tenth each side to the phone's buttons);
  // only the ring and the bracket may reach past it.
  const L = chartMargin(w, h, wide),
    R = w - L;

  const x0 = round(L + tagW(start) - 10);

  const gapC = wide ? 34 : 26,
    gainW = wide ? 330 : 0;

  const colNeed = gapC + bw + (wide && gain ? 22 + 24 + gainW : 0);

  const x1 = round(R - Math.max(colNeed, tagW(end) - 10));

  const xs = round(x1 + gapC + bw / 2),
    xb = round(xs + bw / 2 + 22);

  // Down: the dates (and the period's words) under the axis, what you pay and its words above
  // it, the line's range above that. Narrow frames cap the range's height against the period's
  // width (so a ripple stays a ripple) and centre the picture in the height left over. The
  // beat's source line sits under the picture, higher on a tall frame.
  const { top0, axisY } = verticalBounds(w, h, wide, square, F);

  const rLo = (lo - pay) / (vtop - pay),
    rHi = (hi - pay) / (vtop - pay);

  const pctCap = cap(F.pct);

  // The circled price's words sit just under its dot; with the end circled, the discount's
  // label stacks under them.
  const wordsBase = dotR + 20 + cap(F.words);

  const gainBlock = gain && !wide ? 30 + cap(F.gain) + 14 + F.gainWords : 0;

  const settle = (H: number) => {
    const barH = rLo * H;
    const pctC = Math.max(
      barH / 2,
      (lowStart ? 18 : wordsBase + 30) + pctCap / 2,
    );
    const pillTop = Math.max(barH + 24, pctC + pctCap / 2 + 24);
    return { barH, pctC, pillTop };
  };
  return {
    ...context,
    w,
    h,
    start,
    end,
    gain,
    fmt,
    lowStart,
    lo,
    pay,
    vtop,
    wide,
    square,
    F,
    cap,
    numW,
    tagD,
    tagPad,
    tagGap,
    tagH,
    tagW,
    pillH,
    pillW,
    dotR,
    bw,
    L,
    R,
    x0,
    x1,
    xs,
    xb,
    top0,
    axisY,
    rHi,
    wordsBase,
    gainBlock,
    settle,
  };
}

function verticalBounds(
  w: number,
  h: number,
  wide: boolean,
  square: boolean,
  F: Record<string, number>,
) {
  const topFraction = square ? 0.09 : 0.11;
  const top0 = wide ? 110 : round(h * topFraction),
    bottom0 = round(
      h - (wide ? 162 : 172) - (h > w ? Math.max(0, h * 0.06 - 40) : 0),
    );

  const datesH = wide
    ? round(F.date * 1.45)
    : round(F.date * 1.4 + F.period * 1.55);

  const axisY = bottom0 - datesH;
  return { top0, axisY };
}
