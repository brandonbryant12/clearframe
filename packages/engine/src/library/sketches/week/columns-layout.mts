import { round } from '../../../film/sketch-kit.mjs';

import type { weekBase } from './base.mjs';
export function weekColumnsLayout(context: ReturnType<typeof weekBase>) {
  const { w, h, days, today, due, after, byDay, weekend } = context;

  // Columns: the week across the frame, today flagged above it, the consequence beside it.
  const X0 = round(w * 0.0625),
    X1 = w - X0;

  const Y0 = round(h * 0.17),
    Y1 = round(h * 0.87);

  const aw = after ? round((X1 - X0) * 0.19) : 0,
    ag = after ? 56 : 0;

  const flag = 74;

  const card = { y: 0, h: 0, x: X0, w: X1 - X0 - aw - ag };

  const headH = 100,
    inset = 12,
    gap = 14,
    pillH = 60,
    fs = 32,
    cb = 28,
    padX = 18,
    padY = 16;

  // Weekend days without a task are narrower (the week is the work week); a day holding three
  // or four tasks is wider, so its cards keep their type.
  const weight = (d: number) =>
    weekend(d) && !byDay[d].length && d !== due && d !== today
      ? 0.55
      : 1 + 0.35 * Math.max(0, byDay[d].length - 2);

  const unit =
    (card.w - 20) /
    Array.from({ length: days }, (_, d) => weight(d)).reduce(
      (a, b) => a + b,
      0,
    );

  const cols: { x: number; w: number; cx: number }[] = [];

  for (let d = 0, x = card.x + 10; d < days; x += unit * weight(d), d++)
    cols.push({
      x: round(x),
      w: round(unit * weight(d)),
      cx: round(x + (unit * weight(d)) / 2),
    });

  const cardW = (d: number) => cols[d].w - 2 * inset;

  // The to-do box sits beside the words, or over them when the columns are too narrow to
  // keep a long word ("handbook") at full size beside it (a seven-day week with an after card).
  // (Only when the fullest day has the height for a box over three lines.)
  const room = Y1 - Y0 - flag - headH - 36;

  const busy = byDay.map((l, d) => d).filter((d) => byDay[d].length);

  const limit = Math.min(
    ...busy.map((d) =>
      Math.floor(
        (room - (d === due ? pillH + gap : 0) - (byDay[d].length - 1) * gap) /
          byDay[d].length,
      ),
    ),
  );

  const above =
    Math.min(...busy.map((d) => cardW(d) - padX - cb - 28)) < 140 &&
    limit >= 3 * fs * 1.15 + 2 * padY + cb + 10;

  const textW = (d: number) =>
    above ? cardW(d) - 2 * padX : cardW(d) - padX - cb - 28;

  const lift = above ? cb + 10 : 0;

  // Cards are as tall as two lines (three in narrow columns), shorter only when a day is full.
  const lines = Math.max(...busy.map((d) => (textW(d) < 200 ? 3 : 2)));

  let cardH = round(lines * fs * 1.15 + 2 * padY + lift);

  byDay.forEach((l, d) => {
    if (l.length)
      cardH = Math.min(
        cardH,
        Math.floor(
          (room - (d === due ? pillH + gap : 0) - (l.length - 1) * gap) /
            l.length,
        ),
      );
  });

  // The columns are as tall as the fullest day needs, with room to spare so they read as days.
  const stack = (d: number) => {
    const tail = byDay[d].length ? -gap : 0;
    return byDay[d].length * (cardH + gap) + (d === due ? pillH : tail);
  };

  const slots = Math.min(
    room,
    Math.max(
      320,
      Math.max(...byDay.map((_, d) => stack(d))) + round(cardH * 0.8),
    ),
  );

  card.h = headH + 36 + slots;

  card.y = round(Y0 + flag + (Y1 - Y0 - flag - card.h) / 2);

  const top = card.y + headH + 18;

  const slotY = (j: number) => round(top + j * (cardH + gap));
  return {
    ...context,
    today,
    due,
    after,
    byDay,
    weekend,
    aw,
    ag,
    card,
    headH,
    inset,
    pillH,
    fs,
    cb,
    padX,
    padY,
    cols,
    cardW,
    above,
    textW,
    lift,
    cardH,
    slotY,
  };
}
