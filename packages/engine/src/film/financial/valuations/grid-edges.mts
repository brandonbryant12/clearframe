import { required } from '../validation.mjs';

import { check } from './check.mjs';

// Boundaries halfway between declared numeric grid coordinates. Fill is a
// sampled cell, not an interpolated valuation surface or probability area.
export function gridEdges(values: number[]) {
  check(
    Array.isArray(values) &&
      values.length >= 2 &&
      values.length <= 7 &&
      Array.from(values).every(
        (v, i) =>
          Number.isFinite(v) &&
          v >= -90 &&
          v <= 100 &&
          (!i || v > values[i - 1]),
      ),
    'grid coordinates must be 2–7 increasing rates within [-90,100]',
  );
  return [
    values[0] - (values[1] - values[0]) / 2,
    ...values.slice(1).map((v, i) => (v + values[i]) / 2),
    required(values.at(-1), 'valuation scene: missing grid endpoint') +
      (required(values.at(-1), 'valuation scene: missing grid endpoint') -
        required(values.at(-2), 'valuation scene: missing grid endpoint')) /
        2,
  ];
}
