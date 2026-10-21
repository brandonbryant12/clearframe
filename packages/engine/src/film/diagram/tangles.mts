import type { Point } from '../types.mjs';

type Segment = [Point, Point];

function segmentCost([p, q]: Segment, [r, s]: Segment): number {
  const horizontal = Math.abs(p[1] - q[1]) < 0.5;
  const otherHorizontal = Math.abs(r[1] - s[1]) < 0.5;
  if (horizontal !== otherHorizontal) {
    const [h0, h1, v0, v1] = horizontal ? [p, q, r, s] : [r, s, p, q];
    const x = v0[0],
      y = h0[1];
    return Number(
      x > Math.min(h0[0], h1[0]) + 0.5 &&
        x < Math.max(h0[0], h1[0]) - 0.5 &&
        y > Math.min(v0[1], v1[1]) + 0.5 &&
        y < Math.max(v0[1], v1[1]) - 0.5,
    );
  }
  const sameRun = horizontal
    ? Math.abs(p[1] - r[1]) < 2
    : Math.abs(p[0] - r[0]) < 2;
  if (!sameRun) return 0;
  const axis = horizontal ? 0 : 1;
  const lo = Math.max(Math.min(p[axis], q[axis]), Math.min(r[axis], s[axis]));
  const hi = Math.min(Math.max(p[axis], q[axis]), Math.max(r[axis], s[axis]));
  return hi - lo > 2 ? 5 : 0;
}

function pairCost(first: Segment[], second: Segment[]): number {
  let cost = 0;
  for (const a of first) for (const b of second) cost += segmentCost(a, b);
  return cost;
}

/** Orthogonal crossings cost one; overlapping runs cost five. */
export function tangles(lines: Point[][]): number {
  const segments = lines.map((points) =>
    points.slice(1).map((q, i): Segment => [points[i], q]),
  );
  let cost = 0;
  for (let i = 0; i < segments.length; i++)
    for (let j = i + 1; j < segments.length; j++)
      cost += pairCost(segments[i], segments[j]);
  return cost;
}
