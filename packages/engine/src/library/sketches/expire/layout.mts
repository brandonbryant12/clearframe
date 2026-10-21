import { body, round } from '../../../film/sketch-kit.mjs';

export function hourglassBounds(
  T: boolean,
  b: { x: number; y: number; w: number; h: number },
  short: boolean,
) {
  if (T) {
    return { y0: b.y + 150, y1: b.y + b.h - 50 };
  }
  if (short) {
    return { y0: 390, y1: 900 };
  }
  return { y0: 400, y1: 890 };
}

export function hourglassX(T: boolean, short: boolean, w: number) {
  if (T) {
    return 300;
  }
  if (short) {
    return 280;
  }
  return round(w * 0.48);
}

export function hourglassWidth(T: boolean, short: boolean) {
  if (T) {
    return 380;
  }
  if (short) {
    return 260;
  }
  return 380;
}

export function jarLayout(h: number, w: number, total: number) {
  const T = h > w * 1.1;
  const short = !T && w < 1400;
  const b = body(w, h);
  // The jar: centred left of the frame's middle, labels to its right; the year-end tag sits on
  // the line to its left in wide frames and above the rim in narrow ones.
  const jw = hourglassWidth(T, short);
  const cx = hourglassX(T, short, w);
  const L = cx - jw / 2,
    R = cx + jw / 2,
    ry = round(jw * 0.085);
  const rx = round(jw / 2 - 34),
    cry = round(rx * 0.27);
  // The jar is as tall as its coins need (at least six), centred in the room the frame gives it.
  const room = hourglassBounds(T, b, short);
  const slots = Math.max(total, 6);
  const step = round(Math.min(46, (room.y1 - room.y0 - 82 - 2 * cry) / slots));
  const jarH = slots * step + 82 + 2 * cry;
  const top = round(room.y0 + Math.max(0, (room.y1 - room.y0 - jarH) / 2)),
    bottom = round(top + jarH);
  const t = round(step * 0.74);
  const base = round(bottom - t - cry - 12);
  const coinY = (i: number) => round(base - i * step);
  const label = { x: R + 76, width: round(w * (T ? 0.9 : 0.92) - (R + 76)) };
  return {
    cx,
    t,
    rx,
    cry,
    bottom,
    jw,
    ry,
    L,
    top,
    R,
    coinY,
    base,
    T,
    short,
    label,
  };
}
