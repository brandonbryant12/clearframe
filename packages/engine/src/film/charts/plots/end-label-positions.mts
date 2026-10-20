import { check } from './check.mjs';

/** Terminal value labels sit beside the line ends; push neighbours apart so they never collide. */
export function endLabelPositions(
  targets: number[],
  gap: number,
  top: number,
  bottom: number,
): number[] {
  const order = targets.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < order.length; k++)
    order[k].y = Math.max(order[k].y, order[k - 1].y + gap);
  const overflow = order.length ? order[order.length - 1].y - bottom : 0;
  if (overflow > 0) for (const o of order) o.y -= overflow;
  for (let k = order.length - 2; k >= 0; k--)
    order[k].y = Math.min(order[k].y, order[k + 1].y - gap);
  check(
    !order.length || order[0].y >= top - gap,
    'too many series end near the same value to label them',
  );
  const out: number[] = [];
  for (const o of order) out[o.i] = o.y;
  return out;
}
