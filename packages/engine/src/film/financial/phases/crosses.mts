import type { Point, Box } from '../scene-types.mjs';

// Segment/rectangle intersection, including endpoint contact. Used only to
// reserve quadrant copy; never to alter, smooth or clip an observation.
export function crosses(a: Point, b: Point, box: Box) {
  const [l, t, r, d] = box;
  let lo = 0,
    hi = 1;
  for (const [p, q] of [
    [-(b[0] - a[0]), a[0] - l],
    [b[0] - a[0], r - a[0]],
    [-(b[1] - a[1]), a[1] - t],
    [b[1] - a[1], d - a[1]],
  ]) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const v = q / p;
    if (p < 0) lo = Math.max(lo, v);
    else hi = Math.min(hi, v);
    if (lo > hi) return false;
  }
  return true;
}
