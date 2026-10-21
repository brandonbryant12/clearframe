import type { Point } from '../types.mjs';
import { r2 } from './shared.mjs';
export function rounded(pts: Point[], radius: number) {
  let d = `M ${r2(pts[0][0])} ${r2(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    if (i === pts.length - 1) {
      d += ` L ${r2(x)} ${r2(y)}`;
      break;
    }
    const [px, py] = pts[i - 1],
      [nx, ny] = pts[i + 1];
    const into = Math.hypot(x - px, y - py),
      out = Math.hypot(nx - x, ny - y),
      k = Math.min(radius, into / 2, out / 2);
    if (k < 0.5) {
      d += ` L ${r2(x)} ${r2(y)}`;
      continue;
    }
    const ax = x - ((x - px) / into) * k,
      ay = y - ((y - py) / into) * k,
      bx = x + ((nx - x) / out) * k,
      by = y + ((ny - y) / out) * k;
    d += ` L ${r2(ax)} ${r2(ay)} Q ${r2(x)} ${r2(y)} ${r2(bx)} ${r2(by)}`;
  }
  return d;
}
