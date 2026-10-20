import { required } from '.././drawing/contracts.mjs';

import { rng } from '../../../film/sketch-kit.mjs';
import { monotone } from '.././drawing/monotone.mjs';
import type { BuildOptions } from './common.mjs';
import { SAMPLES } from './common.mjs';

export function holdValues(
  w: number,
  h: number,
  { seed = 7, params = {} }: BuildOptions = {},
) {
  const {
    lock = 6.25,
    rise = 0.6,
    fall = 0,
    floatDown = false,
    days = 45,
    prefix = '',
    suffix = '%',
    decimals = 2,
  } = params;

  const falls = fall > 0;

  const steps = falls && floatDown;

  const fmt = (v: number) => {
    const s = Math.abs(v).toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    return `${v < 0 && Number(s.replace(/,/g, '')) !== 0 ? '−' : ''}${prefix}${s}${suffix}`;
  };

  const peak = lock + rise,
    low = lock - fall;

  // Moments: the market's fall gets its own beat between the climb and the close.
  const AT = falls
    ? { LOCK: 0.6, RISE: 2.2, FALL: 4.4, END: 6.6 }
    : { LOCK: 0.6, RISE: 2.2, END: 4.6 };

  // The market, in values: a short wander just under the lock, a climb to the peak, and (with
  // a fall) a slide to the low; seeded ripples ride on it, never past the peak or the low.
  const S = rise + fall;

  const T: { A: number; peak: number; B: number; low?: number } = falls
    ? { A: 0.2, peak: 0.46, B: 0.6, low: 0.84 }
    : { A: 0.2, peak: 1, B: 1 };

  // Small pullbacks on the way (a monotone curve turns flat at each key, so they ripple).
  const trend = monotone(
    falls
      ? [
          [0, lock],
          [0.08, lock - 0.06 * S],
          [T.A, lock],
          [0.31, lock + 0.55 * rise],
          [0.36, lock + 0.5 * rise],
          [T.peak, peak],
          [0.53, peak - 0.14 * S],
          [T.B, peak - 0.08 * S],
          [0.72, lock - 0.45 * fall],
          [0.77, lock - 0.35 * fall],
          [required(T.low, 'fall low'), low],
          [1, low + 0.08 * S],
        ]
      : [
          [0, lock],
          [0.08, lock - 0.06 * S],
          [T.A, lock],
          [0.36, lock + 0.4 * rise],
          [0.42, lock + 0.36 * rise],
          [0.6, lock + 0.78 * rise],
          [0.7, lock + 0.74 * rise],
          [0.86, lock + 0.92 * rise],
          [1, peak],
        ],
  );

  const rand = rng(seed);

  const waves = [
    [2.6 + rand(), 0.55],
    [5.5 + 1.5 * rand(), 0.3],
    [10 + 2 * rand(), 0.15],
  ].map(([f, a]) => [f, a, rand() * Math.PI * 2]);

  const amp = 0.06 * S;

  const value = (t: number) => {
    const v = trend(t);
    // Room to ripple: never above the lock before the climb, never past the peak or the low.
    const ceil = t <= T.A ? lock : peak,
      floor = falls && t > T.A ? low : lock - 0.12 * S;
    const room = Math.max(0, Math.min(ceil - v, v - floor)) / 1.15;
    const ramp = Math.min(1, t / 0.06);
    const n = waves.reduce(
      (s, [f, a, p]) => s + a * Math.sin(2 * Math.PI * f * t + p),
      0,
    );
    return v + Math.min(amp, room) * ramp * ramp * n;
  };

  const vals = Array.from({ length: SAMPLES + 1 }, (_, i) =>
    value(i / SAMPLES),
  );

  const vmin = Math.min(...vals),
    vmax = peak;
  return {
    w,
    h,
    lock,
    rise,
    days,
    falls,
    steps,
    fmt,
    peak,
    low,
    AT,
    T,
    vals,
    vmin,
    vmax,
  };
}
