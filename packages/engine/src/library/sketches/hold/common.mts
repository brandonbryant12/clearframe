import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: {
    lock?: number;
    rise?: number;
    fall?: number;
    floatDown?: boolean;
    days?: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
  };
}

// A value held while the market moves: a time axis spans the window (a rate lock's 45 days), a
// locked level line runs across it from a padlock tag, and a market line wanders off from the
// same start. On RISE the market climbs above the lock and the gap between them shades in behind
// its tip: what the lock keeps, measured and labelled. With a fall the market then drops below
// the lock; with a float-down the locked line steps down once to meet it. On END the window
// closes. The market's path is seeded and smooth; its peak and low are exactly the levels in
// sketchParams, and every printed value comes from sketchParams. Moments: LOCK, RISE, FALL (only
// when fall > 0), END.
export const SAMPLES = 100;

/** A padlock centred on (x, y) at scale s; its shackle can be lifted (open) by a key. */
export function padlock(
  x: number,
  y: number,
  s: number,
  fill: string,
  hole: string,
) {
  const bw = round(30 * s),
    bh = round(23 * s),
    by = round(y - 6 * s),
    leg = round(9 * s),
    top = round(by - 7 * s);
  return {
    shackle: {
      type: 'path',
      d: `M ${round(x - leg)} ${round(by + 2)} L ${round(x - leg)} ${top} A ${leg} ${leg} 0 0 1 ${round(x + leg)} ${top} L ${round(x + leg)} ${round(by + bh * 0.6)}`,
      fill: 'none',
      stroke: fill,
      width: round(4.5 * s),
      cap: 'round',
      enter: 'none',
    } satisfies CanvasElement,
    body: {
      type: 'rect',
      x: round(x - bw / 2),
      y: by,
      w: bw,
      h: bh,
      r: round(5 * s),
      fill,
      enter: 'none',
    } satisfies CanvasElement,
    keyhole: {
      type: 'circle',
      cx: x,
      cy: round(by + bh * 0.45),
      r: round(3.2 * s),
      fill: hole,
      enter: 'none',
    } satisfies CanvasElement,
  };
}

/** Day ticks at a round step, at most six of them, the last always the window's end. */
export function dayTicks(days: number) {
  const step =
    [1, 2, 5, 7, 10, 15, 30, 60, 90, 180, 365].find((s) => days / s <= 5) ??
    Math.ceil(days / 5);
  const ticks = [];
  for (let d = 0; d < days - step * 0.55; d += step) ticks.push(d);
  return [...ticks, days];
}
