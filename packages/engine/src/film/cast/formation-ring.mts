import type { FormationLayout } from './formation-layout.mjs';
import type { Point } from '../types.mjs';

export function ring(layout: FormationLayout) {
  const { ids, size, W, tall, A, cx, cy, spread, n, place } = layout;

  // An ellipse with the frame's proportions, kept clear of its edges.
  const rx = Math.min(spread * (tall ? 0.8 : 1.25), W / 2 - size * 0.9),
    ry = Math.min(spread * (tall ? 1.25 : 0.8), A / 2 - size * 0.9);
  // Equal steps along the ellipse, not equal angles (which bunch objects at the ends of its long axis).
  const K = 360,
    pts: Point[] = [],
    lens = [0];
  for (let k = 0; k <= K; k++) {
    const a = -Math.PI / 2 + (k / K) * Math.PI * 2;
    pts.push([Math.cos(a) * rx, Math.sin(a) * ry]);
  }
  for (let k = 1; k <= K; k++)
    lens.push(
      lens[k - 1] +
        Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]),
    );
  let k = 0;
  ids.forEach((id, i) => {
    const want = (i / n) * lens[K];
    while (k < K && lens[k + 1] < want) k++;
    place(id, cx + pts[k][0], cy + pts[k][1]);
  });
}
