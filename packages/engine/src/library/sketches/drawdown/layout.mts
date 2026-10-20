import { chartMargin } from '../drawing/chart-margin.mjs';
import { required } from '.././drawing/contracts.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import type { ChipSpot } from './common.mjs';
import { short } from './common.mjs';
import type { drawdownType } from './type.mjs';

export function drawdownLayout(context: ReturnType<typeof drawdownType>) {
  const {
    w,
    h,
    start,
    low,
    act,
    back,
    from,
    to,
    pct,
    wide,
    phone,
    F,
    cap,
    numW,
    wordsW,
  } = context;

  // Across: the title-safe width (a frame taller than wide loses a tenth each side to a phone's
  // buttons), then the time axis, inset a little so a tag over its first day stays inside.
  const L = chartMargin(w, h, wide),
    R = w - L;

  const x0 = round(L + 24),
    x1 = round(R - (wide ? 16 : 4));

  const X = (d: number) => round(x0 + ((d - from) / (to - from)) * (x1 - x0));

  // Down: the title and subtitle, the action's pill and note (with act), the start's and the
  // recovery's labels over the 0% line, the depth of the fall, the chip's room, the time axis and
  // its months; the beat's source line sits under it all, higher on a tall frame.
  const dotR = 18,
    halo = wide ? 62 : 60,
    lineW = wide ? 12 : 11;

  const topFraction = phone ? 0.1 : 0.08;
  const top0 = wide ? 96 : round(h * topFraction);

  // The months stay above the caption band (the bottom quarter of a wide frame, fifth of a tall one).
  const bottom0 = round(h * (h > w ? 0.8 : 0.75));

  let titleY = top0 + cap(F.title),
    subY = titleY + F.sub * 1.5;

  let band = subY + (wide ? 40 : 46);

  const pillH = round(F.act * 1.8),
    pillPad = round(F.act * 0.75),
    pillW = round(wordsW(18, F.act) + 2 * pillPad);

  let pillTop = band,
    noteY = band + pillH + 12 + cap(F.note);

  if (act != null) band = noteY + (wide ? 18 : 30);

  // The start's day and its 0% hang over it in a small ink tag (the low's chip in miniature);
  // the recovery's words share its row.
  const tagDay = round(F.label * 0.78),
    tagVal = round(F.label * 1.1),
    tagPadV = round(F.label * 0.34),
    tagIn = round(F.label * 0.24);

  const tagH = round(2 * tagPadV + cap(tagDay) + tagIn + cap(tagVal)),
    tagPad = round(F.label * 0.45),
    tagPtr = 10,
    tagGap = dotR + 6 + tagPtr;

  let Y0 = band + tagH + tagGap;

  let axisY = bottom0 - round(F.tick * 1.35);

  // The chip: the low's day over the fall, filled in the negative colour.
  const chipPad = round(F.value * 0.24),
    chipGap = round(F.value * 0.2);

  const chipH = round(2 * chipPad + cap(F.chipDate) + chipGap + cap(F.value)),
    chipW = round(
      Math.max(
        numW(pct, F.value),
        wordsW(short(low).length, F.chipDate) * 1.1,
      ) +
        2 * round(F.value * 0.32),
    );

  const ptr = 12;

  // Where the chip goes: beside the low at its level (left of the fall, else right of the
  // climb), or hanging under the low when neither side has room. Beside it, the low sits deeper.
  const lowFor = (place: string) =>
    place === 'below'
      ? axisY - 28 - chipH - ptr - 10 - dotR
      : axisY - 28 - chipH / 2;

  const xs = X(start),
    xl = X(low),
    xb = back != null ? X(back) : null,
    xa = act != null ? X(act) : null;

  const fits = (place: string, Ylow: number): ChipSpot | null => {
    const depth = Ylow - Y0;
    const edge = chipH / 2 + 12;
    if (place === 'left') {
      const right = Math.min(
        xl - (edge * (xl - xs)) / depth - 26,
        xl - halo - 10,
      );
      return right - chipW >= L
        ? {
            x: round(right - chipW),
            lead: [round(right + 6), round(xl - dotR - 6)],
          }
        : null;
    }
    if (place === 'right') {
      const left = Math.max(
        xl + halo + 10,
        xb != null ? xl + (edge * (xb - xl)) / depth + 26 : 0,
      );
      if (left + chipW > R) return null;
      // The action's pin hangs down to the line: it must not run through the chip.
      if (
        xa != null &&
        act != null &&
        act > low &&
        xa > left - 14 &&
        xa < left + chipW + 14
      )
        return null;
      return {
        x: round(left),
        lead: [round(xl + dotR + 6), round(left - 6)],
      };
    }
    return { x: round(Math.min(Math.max(xl - chipW / 2, L), R - chipW)) };
  };

  const chooseSpot = () => {
    const left = fits('left', lowFor('left'));
    if (left) return { place: 'left', spot: left };
    const right = fits('right', lowFor('right'));
    if (right) return { place: 'right', spot: right };
    return {
      place: 'below',
      spot: required(fits('below', lowFor('below')), 'drawdown chip'),
    };
  };

  let { place, spot } = chooseSpot();

  let Ylow = round(lowFor(place));

  // A phone-tall frame keeps the fall a little shallower than the axis is wide (deeper, a quarter's
  // fall reads as a spike) and centres the chart in the height it leaves.
  const deepest = round(0.85 * (x1 - x0));

  if (phone && Ylow - Y0 > deepest) {
    const shift = round((Ylow - Y0 - deepest) / 2);
    [titleY, subY, pillTop, noteY, Y0] = [titleY, subY, pillTop, noteY, Y0].map(
      (v) => round(v + shift),
    );
    Ylow = round(Ylow - shift);
    axisY = round(axisY - shift);
    spot = fits(place, Ylow) ?? spot;
  }

  const yOn = (d: number) => {
    if (d <= low) return Y0 + ((d - start) / (low - start)) * (Ylow - Y0);
    if (back != null && d <= back)
      return Ylow - ((d - low) / (back - low)) * (Ylow - Y0);
    return null;
  };
  return {
    ...context,
    start,
    low,
    act,
    back,
    from,
    to,
    pct,
    F,
    cap,
    numW,
    wordsW,
    L,
    R,
    x0,
    x1,
    X,
    dotR,
    halo,
    lineW,
    titleY,
    subY,
    pillH,
    pillPad,
    pillW,
    pillTop,
    noteY,
    tagDay,
    tagVal,
    tagPadV,
    tagIn,
    tagH,
    tagPad,
    tagGap,
    Y0,
    axisY,
    chipPad,
    chipGap,
    chipH,
    chipW,
    ptr,
    xs,
    xl,
    xb,
    xa,
    place,
    spot,
    Ylow,
    yOn,
  };
}
