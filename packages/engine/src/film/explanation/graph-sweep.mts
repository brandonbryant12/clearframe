import type { CanvasElement, ElementKey, Point } from '../types.mjs';
import type { GraphSpec } from './specs.mjs';
import type { Axes, ResolvedCue } from './shared.mjs';
import { round, num, cue, samples } from './shared.mjs';
export function graphSweep(
  sweep: NonNullable<GraphSpec['sweep']>,
  f: (x: number) => number,
  A: Axes,
  [x0, x1]: Point,
  drawAt: ResolvedCue,
  drawDur: number,
): CanvasElement[] {
  // The input moves from `from` to `to`; the point, its drop to the x-axis, its line to the
  // y-axis and both axis markers follow it, keyed at 24 steps (straight between steps).
  const base = A.by + A.bh;
  const a = num(sweep.from ?? x0, 'graph.sweep.from'),
    b = num(sweep.to ?? x1, 'graph.sweep.to');
  const dur = sweep.dur ?? 3,
    n = 22,
    start = cue(sweep, (drawAt.at ?? 0) + drawDur + 0.4);
  const path = samples(f, [a, b], n).map(([x, y]): Point => [A.X(x), A.Y(y)]);
  const [px0, py0] = path[0],
    H = A.bh,
    W = A.bw;
  const keys = (map: (p: Point) => ElementKey): ElementKey[] =>
    path.slice(1).map((p, i) => ({
      ...(start.say != null
        ? { say: start.say, after: round(((i * dur) / n) * 100) / 100 }
        : { at: round((start.at + (i * dur) / n) * 100) / 100 }),
      dur: round((dur / n) * 100) / 100,
      ease: 'linear',
      ...map(p),
    }));
  const showAt = { ...start, ...(start.say != null ? { after: 0 } : {}) };
  return [
    // Drop to the x-axis and line to the y-axis: dashed guides that stretch with the point.
    {
      type: 'line',
      x1: px0,
      y1: base,
      x2: px0,
      y2: base - H,
      stroke: 'accent2',
      width: 4,
      dash: [10, 10],
      origin: [px0, base],
      enter: 'fade',
      ...showAt,
      dur: 0.3,
      keys: [
        { ...showAt, dur: 0, scaleY: (base - py0) / H },
        ...keys(([x, y]) => ({ x: x - px0, scaleY: (base - y) / H })),
      ],
    },
    {
      type: 'line',
      x1: A.bx,
      y1: py0,
      x2: A.bx + W,
      y2: py0,
      stroke: 'accent2',
      width: 4,
      dash: [10, 10],
      origin: [A.bx, py0],
      enter: 'fade',
      ...showAt,
      dur: 0.3,
      keys: [
        { ...showAt, dur: 0, scaleX: (px0 - A.bx) / W },
        ...keys(([x, y]) => ({ y: y - py0, scaleX: (x - A.bx) / W })),
      ],
    },
    {
      type: 'circle',
      cx: px0,
      cy: base,
      r: 12,
      fill: 'accent2',
      enter: 'pop',
      ...showAt,
      dur: 0.3,
      keys: keys(([x]) => ({ x: x - px0 })),
    },
    {
      type: 'circle',
      cx: A.bx,
      cy: py0,
      r: 12,
      fill: 'accent2',
      enter: 'pop',
      ...showAt,
      dur: 0.3,
      keys: keys(([, y]) => ({ y: y - py0 })),
    },
    {
      type: 'circle',
      cx: px0,
      cy: py0,
      r: 18,
      fill: 'accent2',
      stroke: 'bg',
      width: 5,
      enter: 'pop',
      ...showAt,
      dur: 0.3,
      keys: keys(([x, y]) => ({ x: x - px0, y: y - py0 })),
    },
  ];
}
