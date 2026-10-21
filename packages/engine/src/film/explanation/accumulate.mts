import type { CanvasElement, FrameSize, Rect } from '../types.mjs';
import {
  round,
  tall,
  cue,
  fnOf,
  axesFor,
  axisElements,
  samples,
  pathOf,
  autoDomain,
} from './shared.mjs';
import { decodeAccumulate } from './specs.mjs';
/**
 * accumulate: {rate: {kind, …} | number, x: {domain, label}, rateLabel?, totalLabel?, steps?: 4–24,
 *   box?, fill?: {say|at, dur}, stack?: {say|at, dur}}
 * The rate curve over its domain, cut into equal steps (each a small amount: midpoint rate × width),
 * which then lift and stack, in order, into a column whose height is their sum. The column is
 * normalised: its full height is the total, scaled to the plot's height, not read on the rate axis.
 */
export function accumulateElements(
  input: unknown,
  frame: Partial<FrameSize> = {},
): CanvasElement[] {
  const spec = decodeAccumulate(input);
  const f = fnOf(spec.rate, 'accumulate.rate'),
    [x0, x1] = spec.x?.domain ?? [0, 1];
  const n = Math.max(4, Math.min(24, Math.round(spec.steps ?? 12)));
  const T = tall(frame);
  const pts = samples(f, [x0, x1]);
  if (pts.some(([, y]) => !Number.isFinite(y) || y < 0))
    throw new Error(
      'accumulate.rate must be finite and not negative over x.domain',
    );
  const box: Rect =
    spec.box ?? (T ? [120, 560, 540, 820] : [200, 200, 1080, 640]);
  const A = axesFor(frame, box, [x0, x1], autoDomain(pts.map((p) => p[1])));
  const base = A.by + A.bh,
    dx = (x1 - x0) / n;
  // Steps with nothing in them add nothing: they are left out, and an all-zero rate stacks nothing.
  const rects = Array.from({ length: n }, (_, i) => {
    const xm = x0 + (i + 0.5) * dx;
    return {
      x: A.X(x0 + i * dx),
      w: A.X(x0 + (i + 1) * dx) - A.X(x0 + i * dx),
      h: base - A.Y(f(xm)),
    };
  }).filter((r) => r.h > 0.5);
  const total = rects.reduce((s, r) => s + r.h, 0);
  // The total column: as tall as the plot, to the right of it; each piece keeps its share.
  const colX = T ? A.bx + A.bw + 120 : A.bx + A.bw + 140,
    colW = T ? 110 : 150,
    k = A.bh / (total || 1);
  const fill = cue(spec.fill, 1.6),
    fillDur = spec.fill?.dur ?? 2;
  const stack = cue(spec.stack, (fill.at ?? 0) + fillDur + 0.8),
    stackDur = spec.stack?.dur ?? 2.4;
  // Each piece scales about its bottom-left corner, then moves so that corner sits on the pieces
  // already stacked: the column's height is the sum of the pieces, in their order and proportion.
  let below = 0;
  const pieces: CanvasElement[] = rects.map((r, i) => {
    const prev = below,
      w = Math.max(2, r.w - 2);
    below += r.h;
    const step = stackDur / n,
      when =
        stack.say != null
          ? { say: stack.say, after: round(i * step * 100) / 100 }
          : { at: round((stack.at + i * step) * 100) / 100 };
    return {
      type: 'rect',
      x: r.x + 1,
      y: base - r.h,
      w,
      h: Math.max(1, r.h),
      fill: i % 2 ? 'accent' : 'accent2',
      opacity: 0.9,
      origin: [r.x + 1, base],
      enter: 'grow-y',
      dur: 0.3,
      keys: [
        {
          ...when,
          dur: Math.max(0.35, step * 2),
          ease: 'smooth',
          x: round(colX - (r.x + 1)),
          y: round(-prev * k),
          scaleX: round((colW / w) * 1000) / 1000,
          scaleY: round(k * 1000) / 1000,
        },
      ],
    };
  });
  return [
    ...axisElements(A, { xLabel: spec.x?.label, yLabel: spec.rateLabel }),
    {
      type: 'path',
      d: pathOf(pts.map(([x, y]) => [A.X(x), A.Y(y)])),
      fill: 'none',
      stroke: 'ink',
      width: 6,
      cap: 'round',
      enter: 'draw',
      at: 0.5,
      dur: 1,
    },
    {
      type: 'group',
      enter: 'none',
      ...fill,
      stagger: round((fillDur / n) * 100) / 100,
      children: pieces,
    },
    {
      type: 'rect',
      x: colX - 6,
      y: A.by - 6,
      w: colW + 12,
      h: A.bh + 12,
      r: 10,
      fill: 'none',
      stroke: 'muted',
      width: 4,
      dash: [12, 10],
      enter: 'fade',
      ...fill,
      dur: 0.6,
    },
    ...(spec.totalLabel
      ? [
          {
            type: 'text' as const,
            text: spec.totalLabel,
            x: colX + colW / 2,
            y: A.by - 40,
            size: A.size,
            font: 'semibold',
            fill: 'ink',
            anchor: 'middle',
            fit: T ? 230 : 360,
            enter: 'fade',
            ...stack,
            dur: 0.5,
          },
        ]
      : []),
  ];
}
