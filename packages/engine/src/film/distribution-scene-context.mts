import { distribution } from './distribution-data.mjs';
import type { CanvasElement } from './types.mjs';
import type {
  DistributionGeometry,
  DistributionSceneOptions,
} from './distribution-scene-contracts.mjs';
import { check } from './distribution-scene-common.mjs';
export function distributionContext(
  input: unknown,
  {
    width: w,
    height: h,
    id,
    focus = false,
    reveal = false,
  }: DistributionSceneOptions,
) {
  check(
    Number.isFinite(w) &&
      Number.isFinite(h) &&
      w >= 640 &&
      h >= 640 &&
      w <= 4096 &&
      h <= 4096,
    'frame dimensions must be 640–4096',
  );
  check(
    typeof id === 'string' && /^[a-z][a-z0-9-]*$/.test(id),
    'scene id required',
  );
  check(
    typeof focus === 'boolean' && typeof reveal === 'boolean',
    'focus and reveal must be booleans',
  );
  const model = distribution(input),
    m = model,
    tall = h > w,
    margin = w * (tall ? 0.105 : 0.07),
    size = w * (tall ? 0.032 : 0.024),
    left = w * 0.19,
    right = w * 0.89,
    top = h * (tall ? 0.31 : 0.32),
    bottom = h * (tall ? 0.59 : 0.62),
    stripTop = h * (tall ? 0.7 : 0.74),
    stripBottom = h * (tall ? 0.79 : 0.83),
    r = w * 0.0055,
    pitch = 3 * r + 3,
    lo = m.edges[0],
    hi = m.edges[m.edges.length - 1],
    px = (v: number): number => left + ((v - lo) / (hi - lo)) * (right - left),
    py = (v: number): number => bottom - (v / m.y.max) * (bottom - top),
    elements: CanvasElement[] = [],
    labels: CanvasElement[] = [],
    geometry: DistributionGeometry = { bars: [], points: [], threshold: null },
    sourceId = id + '-source';
  return {
    w,
    h,
    id,
    focus,
    reveal,
    model,
    m,
    tall,
    margin,
    size,
    left,
    right,
    top,
    bottom,
    stripTop,
    stripBottom,
    r,
    pitch,
    lo,
    hi,
    px,
    py,
    elements,
    labels,
    geometry,
    sourceId,
  };
}
