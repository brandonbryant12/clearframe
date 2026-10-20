import { cueWriter } from '../drawing/cues.mjs';

import { rng } from '../../../film/sketch-kit.mjs';
import { monotone } from '.././drawing/monotone.mjs';
import type { BuildOptions } from './common.mjs';
import { SAMPLES } from './common.mjs';

export function lookbackPrices(
  w: number,
  h: number,
  { seed = 5, params = {} }: BuildOptions = {},
) {
  const {
    start = 40,
    end = 50,
    discount = 0.15,
    prefix = '$',
    decimals = 0,
    gain = false,
  } = params;

  // Prices as the source prints them: what you pay is rounded to the printed decimals first, so
  // the printed gap is the difference of the printed prices.
  const q = (v: number) =>
    Math.round(v * 10 ** decimals + 1e-7) / 10 ** decimals;

  const fmt = (v: number) =>
    `${prefix}${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;

  const lowStart = start <= end;
  // a tie counts the first day as the lower
  const lo = Math.min(start, end),
    hi = Math.max(start, end);

  const pay = q(lo * (1 - discount)),
    gap = q(end - pay);

  const pct = `−${Math.round(discount * 10000) / 100}%`;

  const AT = {
    PERIOD: 0.5,
    START: 2.6,
    END: 3.7,
    LOWER: 4.9,
    DISCOUNT: 6.3,
    PAY: 7.6,
    ...(gain ? { GAIN: 8.9 } : {}),
  };

  const cued = cueWriter(AT);

  // The price, from the lower day (u = 0) to the higher (u = 1): a wobble, a climb with a
  // pullback, a peak a little above the higher price and a settle onto it. Falling prices run
  // the same path backwards. Seeded ripples ride on it, never under the lower price or over the peak.
  const D = hi - lo,
    span = Math.max(D, 0.1 * hi);

  const rand = rng(seed);

  const jit = (s: number) => (rand() * 2 - 1) * s;

  const over = span * (0.1 + 0.06 * rand());

  const trend = monotone([
    [0, lo],
    [0.09 + jit(0.02), lo + 0.06 * span + 0.1 * D],
    [0.2 + jit(0.03), lo + 0.03 * span + 0.05 * D],
    [0.36 + jit(0.03), lo + (0.5 + jit(0.1)) * D + 0.06 * span],
    [0.47 + jit(0.03), lo + (0.38 + jit(0.08)) * D + 0.04 * span],
    [0.62 + jit(0.04), hi + over],
    [0.76 + jit(0.03), hi - (0.12 + jit(0.05)) * D + 0.02 * span],
    [0.9, hi + 0.04 * span],
    [1, hi],
  ]);

  const waves = [
    [3 + rand(), 0.5],
    [6.5 + 1.5 * rand(), 0.3],
    [12 + 2 * rand(), 0.15],
  ].map(([f, a]) => [f, a, rand() * Math.PI * 2]);

  const value = (u: number) => {
    const v = trend(u);
    const room = Math.max(0, Math.min(v - lo, hi + over - v)) / 1.2;
    const ramp = Math.max(0, Math.min(1, u / 0.1, (1 - u) / 0.08));
    return (
      v +
      Math.min(0.05 * span, room) *
        ramp *
        waves.reduce(
          (s, [f, a, p]) => s + a * Math.sin(2 * Math.PI * f * u + p),
          0,
        )
    );
  };

  const vals = Array.from({ length: SAMPLES + 1 }, (_, i) =>
    value(lowStart ? i / SAMPLES : 1 - i / SAMPLES),
  );

  const vtop = Math.max(...vals, hi);
  return {
    w,
    h,
    start,
    end,
    gain,
    fmt,
    lowStart,
    lo,
    hi,
    pay,
    gap,
    pct,
    cued,
    vals,
    vtop,
  };
}
