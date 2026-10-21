import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

export function yearLabelAnchor(first: boolean, last: boolean) {
  if (first) {
    return 'start';
  }
  if (last) {
    return 'end';
  }
  return 'middle';
}

export function yearLabelX(
  first: boolean,
  cx: (i: number) => number,
  i: number,
  bw: number,
  last: boolean,
) {
  if (first) {
    return round(cx(i) - bw / 2);
  }
  if (last) {
    return round(cx(i) + bw / 2);
  }
  return cx(i);
}

export function yearLabel(startYear: number, k: number, leftmost: number) {
  if (startYear) {
    return String(startYear + k - 1);
  }
  if (k === leftmost) {
    return `Year ${k}`;
  }
  return String(k);
}

export function drawYearLabels({
  wide,
  step,
  pitch,
  n,
  years,
  ks,
  startYear,
  cx,
  bw,
  els,
  text,
  base,
  fs,
}: DrawYearLabelsContext) {
  const minGap = wide ? 150 : 120;
  const fits = (s: number) => s % step === 0 && (s / step) * pitch >= minGap;
  const labelStep =
    [1, 2, 5, 10, 20].find(fits) ??
    Array.from({ length: n }, (_, m) => (m + 1) * step).find(fits) ??
    years;
  let round5 = ks.filter((k) => k % labelStep === 0);
  if (round5.length < 2)
    round5 = ks.filter((k) => (years - k) % labelStep === 0);
  const kept: number[] = [];
  for (const k of [years, ks[0], ...round5.reverse()])
    if (kept.every((q) => (Math.abs(q - k) / step) * pitch >= minGap * 0.8))
      kept.push(k);
  const leftmost = Math.min(...kept);
  for (const k of kept) {
    const i = ks.indexOf(k);
    // The outermost labels align with their bars' outer edges, inside the title-safe width.
    const first = i === 0,
      last = k === years;
    const t = yearLabel(startYear, k, leftmost);
    const x = yearLabelX(first, cx, i, bw, last);
    els.push(
      text(
        t,
        x,
        base + 44,
        fs.tick,
        last ? 'bold' : 'semibold',
        last ? 'ink' : 'muted',
        {
          anchor: yearLabelAnchor(first, last),
          enter: 'none',
          at: 0,
        },
      ),
    );
  }
}

export interface DrawYearLabelsContext {
  wide: boolean;
  step: number;
  pitch: number;
  n: number;
  years: number;
  ks: number[];
  startYear: number;
  cx: (i: number) => number;
  bw: number;
  els: CanvasElement[];
  text: (
    t: string | null,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra?: Partial<CanvasElement>,
  ) => CanvasElement;
  base: number;
  fs: {
    basis: number;
    total: number;
    value: number;
    words: number;
    tick: number;
    grid: number;
  };
}
