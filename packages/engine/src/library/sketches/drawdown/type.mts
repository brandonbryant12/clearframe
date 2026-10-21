import type { Point } from '../../../film/contracts/primitives.mjs';

import type {
  CanvasElement,
  ElementFields,
} from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import type { DashOptions } from './common.mjs';

import type { drawdownDates } from './dates.mjs';

export function drawdownType(context: ReturnType<typeof drawdownDates>) {
  const { w, h, cued } = context;

  // Type: wide frames read at a distance; 1080-wide frames are sized for a phone.
  const wide = w > h * 1.25,
    phone = h > w * 1.5,
    square = !wide && h < w * 1.15;

  const F = Object.fromEntries(
    Object.entries(
      wide
        ? {
            title: 52,
            sub: 34,
            label: 32,
            value: 72,
            chipDate: 30,
            act: 32,
            note: 30,
            tick: 30,
          }
        : {
            title: 54,
            sub: 36,
            label: 36,
            value: 76,
            chipDate: 32,
            act: 34,
            note: 32,
            tick: 32,
          },
    ).map(([k, v]) => [k, round(square ? v * 0.9 : v)]),
  );

  const cap = (s: number) => 0.72 * s;

  const numW = (s: string, size: number) => s.length * 0.62 * size;

  const wordsW = (n: number, size: number) => n * 0.55 * size;

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

  // A dashed line that draws on dash by dash behind a moving head (a stroke drawing on is drawn
  // solid until it lands, so each dash is its own short line). `at(f)` is the share of the
  // duration at which the head reaches share f of the length.
  const dashed = (
    [ax, ay]: Point,
    [bx, by]: Point,
    {
      on,
      off,
      cue,
      dur,
      delay = 0,
      at = (f: number) => f,
      ...paint
    }: DashOptions,
  ) => {
    const len = Math.hypot(bx - ax, by - ay),
      out = [];
    for (let s = 0; s < len - 2; s += on + off) {
      const e = Math.min(len, s + on),
        t0 = at(s / len) * dur,
        t1 = at(e / len) * dur;
      const pt = (d: number) => [
        round(ax + ((bx - ax) * d) / len),
        round(ay + ((by - ay) * d) / len),
      ];
      const [[x1, y1], [x2, y2]] = [pt(s), pt(e)];
      out.push({
        type: 'line',
        x1,
        y1,
        x2,
        y2,
        cap: 'butt',
        ...paint,
        enter: 'draw',
        drawEase: 'linear',
        dur: round(Math.max(0.04, t1 - t0)),
        ...cued(cue, round(delay + t0)),
      } satisfies CanvasElement);
    }
    return out;
  };
  return {
    ...context,
    w,
    h,
    cued,
    wide,
    phone,
    F,
    cap,
    numW,
    wordsW,
    text,
    dashed,
  };
}
