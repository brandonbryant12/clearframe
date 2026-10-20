import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { body, round } from '../../../film/sketch-kit.mjs';

export function differenceX(
  inSpan: boolean,
  from: number,
  right: boolean,
  x0: number,
  W: number,
): number {
  if (inSpan) {
    return from + 40;
  }
  if (right) {
    return x0 + W;
  }
  return x0;
}

export function differenceWidth(
  inSpan: boolean,
  room: number,
  T: boolean,
  W: number,
): number {
  if (inSpan) {
    return room;
  }
  if (T) {
    return W;
  }
  return Math.min(W, 820);
}

export function differenceY(
  inSpan: boolean,
  shorter: boolean,
  below: { amount: number; label: number },
  big: number,
  above: { amount: number; label: number },
  small: number,
) {
  if (inSpan) {
    if (shorter) {
      return below.amount - big * 0.3;
    }
    return above.amount - big * 0.3;
  }
  return below.label + small * 2.2;
}

export function wasNowLayout({
  w,
  h,
  prefix,
  decimals,
  suffix,
  now,
  was,
  note,
}: WasNowLayoutContext) {
  const T = w < 1400;
  const b = body(w, h);
  const money = (v: number) =>
    `${prefix}${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
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
      ...extra,
    }) satisfies CanvasElement;
  const els: CanvasElement[] = [];
  const shorter = now < was;
  // Zero to the larger number across the body, so both ends are drawn to one scale.
  const x0 = round(b.x),
    W = round(b.w);
  const X = (v: number) => round(x0 + (W * v) / Math.max(was, now));
  const [wasX, nowX] = [X(was), X(now)];
  // A phone reads these: the numbers at a figure's size, the labels well above the floor.
  const big = T ? 80 : 72,
    small = T ? 48 : 44,
    barH = T ? 84 : 72,
    titleSize = T ? 54 : 56;
  const pair = big * 0.72 + small * 1.35;
  // The whole stack (what it is, the old number, the bar, the new number and the note) is
  // centred in the frame's safe height: no band is held empty for a heading the beat lacks.
  // (Room for the title to wrap once: the old number stands under it, at the old end.)
  const stack =
    titleSize * 2.2 +
    30 +
    pair +
    28 +
    barH +
    28 +
    pair +
    (note ? small * 1.6 : 0);
  const [safeTop, safeBottom] = [h * (T ? 0.12 : 0.1), h * (T ? 0.78 : 0.74)];
  const titleY = round(
    safeTop + Math.max(0, (safeBottom - safeTop - stack) / 2) + titleSize * 0.8,
  );
  const ty = round(titleY + titleSize * 1.2 + 30 + pair + 28);
  // The old number stands above the bar at its end, the new one below at its own: they never
  // collide, however close the two ends are.
  const above = {
    amount: round(ty - 28 - small * 1.35),
    label: round(ty - 28),
  };
  const below = {
    amount: round(ty + barH + 28 + big * 0.72),
    label: round(ty + barH + 28 + big * 0.72 + small * 1.35),
  };
  return {
    T,
    money,
    text,
    els,
    shorter,
    x0,
    W,
    X,
    wasX,
    nowX,
    big,
    small,
    barH,
    titleSize,
    titleY,
    ty,
    above,
    below,
  };
}

export interface WasNowLayoutContext {
  w: number;
  h: number;
  prefix: string;
  decimals: number;
  suffix: string;
  now: number;
  was: number;
  note: boolean;
}
