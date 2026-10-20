import type { AxisScale } from './contracts.mjs';
import { axisValue } from './axis-value.mjs';
import { check } from './check.mjs';

/** Pure mapping; no clamping: out-of-domain values must fail at the input boundary. */
export function axisPosition(value: unknown, axis: AxisScale): number {
  const x = axisValue(value, axis.type),
    [lo, hi] = axis.domain.map((v) => axisValue(v, axis.type));
  check(
    lo < hi && x >= lo && x <= hi,
    'value lies outside an increasing explicit domain',
  );
  return axis.type === 'log'
    ? (Math.log(x) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))
    : (x - lo) / (hi - lo);
}
