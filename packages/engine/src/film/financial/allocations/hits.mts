import type { Point } from '../scene-types.mjs';

import { check } from './check.mjs';

// Axis-aligned token routes. Moving bounding boxes must clear all stationary
// tokens throughout each leg, not merely at sampled frames.
export function hits(a: Point, b: Point, p: Point, size: number, pad = 2) {
  const lo = [p[0] - size - pad, p[1] - size - pad],
    hi = [p[0] + size + pad, p[1] + size + pad];
  if (a[0] === b[0])
    return (
      a[0] > lo[0] &&
      a[0] < hi[0] &&
      Math.max(a[1], b[1]) > lo[1] &&
      Math.min(a[1], b[1]) < hi[1]
    );
  check(a[1] === b[1], 'routes must have orthogonal legs');
  return (
    a[1] > lo[1] &&
    a[1] < hi[1] &&
    Math.max(a[0], b[0]) > lo[0] &&
    Math.min(a[0], b[0]) < hi[0]
  );
}
