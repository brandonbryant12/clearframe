import type { CanvasElement } from '../types.mjs';
import type { GraphSpec } from './specs.mjs';
import type { Axes } from './shared.mjs';
import { num, cue, HALO } from './shared.mjs';
export function graphMarks(
  marks: NonNullable<GraphSpec['marks']>,
  f: (x: number) => number,
  A: Axes,
): CanvasElement[] {
  const els: CanvasElement[] = [];
  for (const m of marks) {
    const x = num(m.x, 'graph.marks[].x'),
      px = A.X(x),
      py = A.Y(f(x)),
      c = cue(m, 1);
    // A mark in the right third labels towards the inside, so it stays in frame; the label rises
    // clear of the curve along its whole width (a nearly flat curve would run through it).
    const inward = px > A.bx + A.bw * 0.66;
    const ly = markLabelY(m.label, px, py, inward, f, A);
    els.push(
      {
        type: 'circle',
        cx: px,
        cy: py,
        r: 14,
        fill: 'ink',
        stroke: 'accent',
        width: 5,
        enter: 'pop',
        ...c,
        dur: 0.35,
      },
      ...(m.label
        ? [
            {
              type: 'text' as const,
              text: m.label,
              x: inward ? px - 26 : px + 26,
              y: ly,
              size: A.size,
              font: 'semibold',
              fill: 'ink',
              shadow: HALO,
              ...(inward ? { anchor: 'end' } : {}),
              enter: 'fade',
              ...c,
              dur: 0.4,
            },
          ]
        : []),
    );
  }
  return els;
}

function markLabelY(
  label: string | undefined,
  px: number,
  py: number,
  inward: boolean,
  f: (x: number) => number,
  A: Axes,
): number {
  let ly = py - 26;
  if (label) {
    const w = label.length * A.size * 0.55,
      lx = inward ? px - 26 - w : px + 26;
    for (let i = 0; i <= 8; i++) {
      const v = f(A.fromX(lx + (i / 8) * w));
      if (Number.isFinite(v)) ly = Math.min(ly, A.Y(v) - 22);
    }
    ly = Math.max(ly, A.by + A.size);
  }
  return ly;
}
