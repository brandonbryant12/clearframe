import { round, tall, body } from '../../../film/sketch-kit.mjs';

export function splitTypeSizes(wide: boolean, compact: boolean) {
  if (wide) {
    return { whole: 44, total: 52, label: 40, value: 44 };
  }
  if (!compact) {
    return { whole: 40, total: 48, label: 36, value: 40 };
  }
  return { whole: 36, total: 44, label: 30, value: 34 };
}

export function splitLayout(w: number, h: number, n: number) {
  const T = tall(w, h);
  const b = body(w, h);
  // Wide frames: names in a column left of the bars, values in a column on the right. Narrow
  // frames: each lane's name and value sit on a line above its bar.
  const wide = w >= 1400;
  // Short narrow frames (square, portrait) tighten the lanes so five still fit.
  const compact = !wide && h < 1500;
  const fs = splitTypeSizes(wide, compact);
  let bx: number,
    bw: number,
    labelEnd: number,
    valueEnd: number,
    wholeY: number,
    wholeH: number,
    laneH: number;
  let laneY: (index: number) => number;
  let textY: (y: number, height?: number, size?: number) => number;
  if (wide) {
    const x0 = round(b.x + 40),
      x1 = round(b.x + b.w - 40);
    labelEnd = x0 + 420;
    bx = labelEnd + 44;
    valueEnd = x1;
    bw = round(valueEnd - 300 - bx);
    wholeH = 96;
    laneH = 60;
    const pitch = Math.min(112, round(450 / n));
    const height = wholeH + 56 + n * pitch;
    const y0 = round(Math.max(b.y - 10, b.y + (b.h - height) / 2 - 10));
    wholeY = y0;
    laneY = (i: number) =>
      round(y0 + wholeH + 56 + pitch * i + (pitch - laneH) / 2);
    textY = (y: number, hh = 0, size = 0) => round(y + hh / 2 + size * 0.36);
  } else {
    // Type stays inside the title-safe width even after the beat's slow push (11.5% in).
    ({ bx, bw, labelEnd, valueEnd, wholeH, laneH, wholeY, laneY, textY } =
      narrowSplitLayout(b, w, compact, T, n));
  }
  return {
    wholeY,
    wholeH,
    bx,
    bw,
    laneY,
    laneH,
    wide,
    labelEnd,
    textY,
    fs,
    valueEnd,
  };
}

export function narrowSplitLayout(
  b: { x: number; y: number; w: number; h: number },
  w: number,
  compact: boolean,
  T: boolean,
  n: number,
) {
  const bx = round(Math.max(b.x, w * 0.115 + 6));
  const bw = round(w - 2 * bx);
  const labelEnd = bx;
  const valueEnd = bx + bw;
  const wholeH = compact ? 64 : 80;
  const laneH = compact ? 34 : 46;
  const above = compact ? 44 : 52;
  const room = T ? b.h - 40 : b.h + 40;
  const pitch = Math.max(
    compact ? 94 : 110,
    Math.min(150, round((room - (wholeH + 70 + 50)) / n)),
  );
  const height = 70 + wholeH + 50 + n * pitch;
  const y0 = round(
    Math.max(T ? b.y - 140 : 180, b.y + (b.h - height) / 2 - (T ? 30 : 0)),
  );
  const wholeY = y0 + 70;
  const laneY = (i: number) => round(wholeY + wholeH + 50 + pitch * i + above);
  const textY = (y: number) => round(y - (compact ? 16 : 22));
  return { bx, bw, labelEnd, valueEnd, wholeH, laneH, wholeY, laneY, textY };
}
