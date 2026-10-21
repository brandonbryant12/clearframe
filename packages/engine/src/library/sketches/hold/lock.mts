import { shadeLockGap } from './lock-gap.mjs';
import { required } from '.././drawing/contracts.mjs';
import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import { SAMPLES } from './common.mjs';
import type { holdAxis } from './axis.mjs';

export function holdLock(context: ReturnType<typeof holdAxis>) {
  const { lock, steps, T, x0, x1, lockY, pts, cued, els, tip } = context;

  // The lock line, drawn across the window on LOCK (with a float-down, up to the market's low:
  // its tail is drawn below, so it can step down).
  const iL = steps
    ? Math.round(required(T.low, 'float-down low') * SAMPLES)
    : null;

  const xs = steps ? pts[required(iL, 'float-down sample')][0] : x1;

  const lockDraw = 0.9,
    share = (xs - x0) / (x1 - x0);

  const lockLine = {
    stroke: 'accent',
    width: 7,
    cap: 'round',
    enter: 'draw',
    drawEase: 'linear',
  };

  els.push({
    type: 'line',
    x1: x0,
    y1: lockY,
    x2: xs,
    y2: lockY,
    ...lockLine,
    dur: round(lockDraw * share),
    ...cued('LOCK', 0.15),
  } satisfies CanvasElement);

  const { iu, id } = shadeLockGap(context);
  return {
    ...context,
    lock,
    steps,
    T,
    x0,
    x1,
    lockY,
    pts,
    cued,
    els,
    tip,
    iL,
    xs,
    lockDraw,
    share,
    lockLine,
    iu,
    id,
  };
}
