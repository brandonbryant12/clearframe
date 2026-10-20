import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import { round } from '../../../film/sketch-kit.mjs';
import { AT } from './model.mjs';
import type { BuildOptions } from './model.mjs';
import { growthLayout, niceStep } from './layout.mjs';
import { compactAmount, drawGrowthReadout } from './readout.mjs';
import { drawYearLabels } from './labels.mjs';

export function buildSketch(
  w: number,
  h: number,
  { params = {} }: BuildOptions = {},
): SketchDrawing {
  const {
    years = 30,
    perYear = 6000,
    rate = 0.05,
    prefix = '$',
    startYear = 0,
  } = params;
  // The stated assumption: perYear goes in at the start of each year and grows at `rate`.
  const {
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
  } = growthLayout({ years, perYear, rate, prefix, w, h });
  const els: CanvasElement[] = [];

  // On screen from the first frame: the assumption, gridlines with their amounts (as many as
  // the height has room for), the baseline and the years under it.
  els.push(
    text('BASIS', L, basisY, fs.basis, 'semibold', 'muted', {
      fit: R - L,
      enter: 'none',
      at: 0,
    }),
  );
  const lines = Math.max(1, Math.min(4, Math.floor(H / 95)));
  const g = niceStep(total / (lines + 0.2));
  const compact = (v: number) => `${prefix}${compactAmount(v)}`;
  for (let v = g; v < total * 0.97; v += g) {
    const y = yOf(v);
    els.push({
      type: 'line',
      x1: x0,
      y1: y,
      x2: x1,
      y2: y,
      stroke: 'line',
      width: 2,
      enter: 'none',
      at: 0,
    } satisfies CanvasElement);
    els.push(
      text(compact(v), x0, y - 10, fs.grid, 'semibold', 'muted', {
        enter: 'none',
        at: 0,
      }),
    );
  }
  els.push({
    type: 'line',
    x1: x0,
    y1: base,
    x2: x1,
    y2: base,
    stroke: 'muted',
    width: 3,
    cap: 'round',
    enter: 'none',
    at: 0,
  } satisfies CanvasElement);
  // Year labels: the last and first columns, and round years between (multiples of 5 or 10,
  // else counted back from the last), never closer than a label's width.
  drawYearLabels({
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
  });

  // The columns: contributions rise first, left to right (START); then the growth climbs onto
  // each (GROW). At TOTAL every column but the last steps back.
  const dim = () => ({ cue: 'TOTAL', at: AT.TOTAL, dur: 0.5, opacity: 0.4 });
  const spread = (i: number, span: number) =>
    n > 1 ? round((span * i) / (n - 1)) : 0;
  ks.forEach((k, i) => {
    const x = round(cx(i) - bw / 2);
    const p = perYear * k,
      hP = round((p / total) * H),
      hAll = round((bal[k] / total) * H);
    const r = round(Math.min(5, bw / 4));
    const last = i === n - 1;
    if (hP >= 1)
      els.push({
        type: 'rect',
        x,
        y: round(base - hP),
        w: bw,
        h: hP,
        r,
        fill: 'accent2',
        enter: 'grow-y',
        dur: 0.45,
        ...cued('START', spread(i, 1.3)),
        ...(last ? {} : { keys: [dim()] }),
      } satisfies CanvasElement);
    const hG = round(hAll - hP - 3);
    if (hG >= 1.5)
      els.push({
        type: 'rect',
        x,
        y: round(base - hAll),
        w: bw,
        h: hG,
        r,
        fill: 'accent',
        enter: 'grow-y',
        dur: 0.5,
        ...cued('GROW', spread(i, 1.5)),
        ...(last ? {} : { keys: [dim()] }),
      } satisfies CanvasElement);
  });

  // The last column, named in parts, and the total.
  const right = round(cx(n - 1) + bw / 2);
  const yTop = yOf(total),
    yMid = yOf(putIn);
  const putAt = () => cued('START', 1.55),
    grewAt = () => cued('GROW', 1.75);
  const count = { from: 0, to: total, decimals: 0, prefix, dur: 1.2 };
  drawGrowthReadout({
    side,
    right,
    R,
    fs,
    yTop,
    yMid,
    base,
    text,
    els,
    putAt,
    money,
    putIn,
    grew,
    grewAt,
    count,
    cued,
    L,
    ro,
  });
  // Count-only figures carry no text.
  for (const el of els)
    if (el.type === 'text' && el.text == null) delete el.text;
  return { elements: els };
}
