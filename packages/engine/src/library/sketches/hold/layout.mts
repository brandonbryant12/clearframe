import { cueWriter } from '.././drawing/cues.mjs';

import type {
  CanvasElement,
  ElementFields,
} from '../../../film/contracts/canvas.mjs';

import { body, round } from '../../../film/sketch-kit.mjs';

import { SAMPLES } from './common.mjs';
import type { holdValues } from './values.mjs';

export function holdLayout(context: ReturnType<typeof holdValues>) {
  const { w, h, lock, falls, steps, fmt, peak, low, AT, vals, vmin, vmax } =
    context;

  // Layout: the lock's tag hangs in a gutter left of the window, where both lines start, with
  // its words over it; narrow frames make the gutter just wide enough for the tag.
  const wide = w >= 1400;

  const b = body(w, h);

  const fs = wide
    ? { tag: 46, label: 34, value: 46, tick: 30, kept: 54 }
    : { tag: 38, label: 32, value: 44, tick: 30, kept: 50 };

  // Type stays inside the title-safe width (in narrow frames even after the beat's slow push).
  const L = wide ? 200 : round(w * 0.115 + 6),
    R = w - L;

  const tagH = wide ? 76 : 66;

  const tagW = (v: number) =>
    round(
      Math.min(
        wide ? 380 : 330,
        (wide ? 96 : 80) + fmt(v).length * fs.tag * 0.6,
      ),
    );

  const gap = wide ? 30 : 22;

  const x0 = wide ? 580 : round(L + tagW(lock) + gap),
    x1 = wide ? 1640 : round(R - 22);

  // The lowest level drawn sits clear of the axis: room under the low's label or the
  // float-down's tag. A tall frame keeps the lines no taller than the window is wide (so a
  // ripple stays a ripple) and centres the picture in the room it leaves.
  const fallSpace = falls ? 92 : 40;
  const under = steps ? 124 : fallSpace;

  let top = b.y + (wide ? 80 : 120),
    axisY = b.y + b.h - (wide ? 64 : 120);

  const slack = wide ? 0 : Math.max(0, axisY - under - top - 0.8 * (x1 - x0));

  top = round(top + slack / 2);

  axisY = round(axisY - slack / 2);

  const bottom = round(axisY - under);

  const yOf = (v: number) =>
    round(bottom - ((v - vmin) / (vmax - vmin)) * (bottom - top));

  const xOf = (t: number) => round(x0 + t * (x1 - x0));

  const lockY = yOf(lock),
    lowY = yOf(low),
    peakY = yOf(peak);

  const pts = vals.map((v, i) => [xOf(i / SAMPLES), yOf(v)]);

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
      x,
      y,
      size,
      font,
      fill,
      ...extra,
    }) satisfies CanvasElement;

  const cued = cueWriter(AT, true);

  const els: CanvasElement[] = [];
  return {
    ...context,
    lock,
    falls,
    steps,
    fmt,
    peak,
    low,
    AT,
    vals,
    wide,
    fs,
    L,
    R,
    tagH,
    tagW,
    gap,
    x0,
    x1,
    top,
    axisY,
    lockY,
    lowY,
    peakY,
    pts,
    text,
    cued,
    els,
  };
}
