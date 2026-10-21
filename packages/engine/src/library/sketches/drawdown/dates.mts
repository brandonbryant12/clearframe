import type { DrawdownMoments } from '../drawing/contracts.mjs';
import { cueWriter } from '.././drawing/cues.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import type { BuildOptions } from './common.mjs';
import { day, short, quarterStart, quarterEnd } from './common.mjs';

export function drawdownDates(
  w: number,
  h: number,
  { params = {} }: BuildOptions = {},
) {
  const {
    start: s0 = '2027-08-04',
    low: l0 = '2027-08-19',
    drop = 6.4,
    act: a0 = '',
    back: b0 = '',
    from: f0 = '',
    to: t0 = '',
    decimals = 1,
  } = params;

  const start = day('start', s0),
    low = day('low', l0);

  const act = a0 ? day('act', a0) : null,
    back = b0 ? day('back', b0) : null;

  if (low <= start)
    throw new Error(
      `sketchParams.low for drawdown must come after start (got ${s0} to ${l0})`,
    );

  if (back != null && back <= low)
    throw new Error(
      `sketchParams.back for drawdown must come after low (got ${l0} to ${b0})`,
    );

  if (act != null && act < start)
    throw new Error(
      `sketchParams.act for drawdown must not come before start (got ${a0}, start ${s0})`,
    );

  const dates = [start, low, act, back].filter((v) => v != null);

  const first = Math.min(...dates),
    last = Math.max(...dates);

  const from = f0 ? day('from', f0) : quarterStart(first),
    to = t0 ? day('to', t0) : quarterEnd(last);

  if (from > first || to < last)
    throw new Error(
      `sketchParams.from and to for drawdown must take in every date (${short(first)} to ${short(last)}; got ${short(from)} to ${short(to)})`,
    );

  const pct = `−${drop.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;

  // Moments: the start, the fall, its chip, then the action and the recovery in their dates' order.
  const later = [
    ...(act != null ? [{ cue: 'ACT' as const, day: act, priority: 0 }] : []),
    ...(back != null
      ? [{ cue: 'RECOVER' as const, day: back, priority: 1 }]
      : []),
  ].sort((a, b) => a.day - b.day || a.priority - b.priority);

  const AT: DrawdownMoments = { OPEN: 0.3, FALL: 1.3, LOW: 3.2 };

  later.forEach(({ cue }, i) => (AT[cue] = round(4.6 + 1.8 * i)));

  const cued = cueWriter(AT);

  const FALL_DUR = 1.6,
    RISE_DUR = 2;
  return {
    w,
    h,
    start,
    low,
    act,
    back,
    from,
    to,
    pct,
    cued,
    FALL_DUR,
    RISE_DUR,
  };
}
