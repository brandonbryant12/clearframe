import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { body, round } from '../../../film/sketch-kit.mjs';
import { AT } from './model.mjs';

/** A round step for gridlines: 1, 2, 2.5 or 5 times a power of ten. */
export function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p;
}

export function growthTypeSizes(wide: boolean, side: boolean) {
  if (wide) {
    return { basis: 32, total: 76, value: 44, words: 30, tick: 30, grid: 28 };
  }
  if (side) {
    return { basis: 30, total: 58, value: 38, words: 28, tick: 28, grid: 28 };
  }
  return { basis: 32, total: 84, value: 44, words: 30, tick: 30, grid: 28 };
}

export function growthLayout({
  years,
  perYear,
  rate,
  prefix,
  w,
  h,
}: GrowthLayoutContext) {
  const bal = [0];
  for (let k = 1; k <= years; k++)
    bal.push((bal[k - 1] + perYear) * (1 + rate));
  const money = (v: number) =>
    `${prefix}${Math.round(v).toLocaleString('en-US')}`;
  // Printed parts add up to the printed total.
  const total = Math.round(bal[years]),
    putIn = Math.round(perYear * years),
    grew = total - putIn;

  const wide = w >= 1400;
  const b = body(w, h);
  // Tall frames set the readout over the chart; wide and short frames set it beside the last
  // column, where each part is bracketed at its true height.
  const side = wide || b.h < 900;
  // Type stays inside the title-safe width (in narrow frames even after the beat's slow push).
  const L = wide ? 200 : round(w * 0.115 + 6),
    R = w - L;
  // Columns: every year, or every 2, 5 or 10 years counted back from the last, at most 30 (20
  // in narrow frames).
  const maxCols = wide ? 30 : 20;
  const step = [1, 2, 5, 10].find((s) => years / s <= maxCols) ?? 10;
  const ks = [];
  for (let k = years; k >= 1; k -= step) ks.unshift(k);
  const n = ks.length;

  const fs = growthTypeSizes(wide, side);
  const basisY = round(b.y + (wide ? 34 : 30));
  // The readout over a tall frame's chart: the total and its words, then the two parts.
  const readoutY = round(basisY + 124);
  const ro = { total: readoutY, words: readoutY + 48, parts: readoutY + 140 };
  const lw = wide ? 390 : 250;
  const x0 = L,
    x1 = side ? round(R - lw - 30) : R;
  const sideTop = round(b.y + (wide ? 120 : 100));
  const top = side ? sideTop : round(ro.parts + 150);
  const base = round(b.y + b.h - (wide ? 52 : 70));
  const H = base - top;
  const pitch = (x1 - x0) / n;
  const bw = round(Math.max(8, Math.min(64, pitch * 0.64)));
  const cx = (i: number) => round(x0 + pitch * (i + 0.5));
  const yOf = (v: number) => round(base - (v / total) * H);
  const text = (
    t: string | null,
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
  const cued = (cue: keyof typeof AT, dt: number, extra = {}) => ({
    cue,
    at: round(AT[cue] + dt),
    after: round(dt),
    ...extra,
  });
  return {
    text,
    L,
    basisY,
    fs,
    R,
    H,
    total,
    yOf,
    x0,
    x1,
    base,
    wide,
    step,
    pitch,
    n,
    ks,
    cx,
    bw,
    bal,
    cued,
    putIn,
    side,
    money,
    grew,
    ro,
  };
}

export interface GrowthLayoutContext {
  years: number;
  perYear: number;
  rate: number;
  prefix: string;
  w: number;
  h: number;
}
