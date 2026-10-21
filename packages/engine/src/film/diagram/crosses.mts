import type { Point } from '../types.mjs';
import type { Box } from './contracts.mjs';
export function crosses(p: Point, q: Point, o: Box) {
  const l = Math.min(p[0], q[0]),
    r = Math.max(p[0], q[0]),
    t = Math.min(p[1], q[1]),
    b = Math.max(p[1], q[1]);
  return l < o.r && o.l < r && t < o.b && o.t < b;
}
