import { required } from '.././drawing/contracts.mjs';
import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round, smoothPath } from '../../../film/sketch-kit.mjs';

import { SAMPLES } from './common.mjs';
import type { lookbackAxis } from './axis.mjs';

export function lookbackLine(context: ReturnType<typeof lookbackAxis>) {
  const { cued, wide, axisY, pts, under, els } = context;

  // The price draws across the period with its area tinted in just behind the tip (a price
  // chart, and a change a phone can see); the tint clears and the line steps back once the
  // lower price is circled.
  const run = [0];

  for (let i = 1; i <= SAMPLES; i++)
    run.push(
      run[i - 1] +
        Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]),
    );

  const tip = (i: number) => round(0.1 + (1.8 * run[i]) / run[SAMPLES]);

  const base = round(axisY - 2);

  for (let a = 0, SL = 6; a < SAMPLES; a += SL) {
    const z = Math.min(SAMPLES, a + SL + 1),
      edge = pts.slice(a, z + 1).map(([x, y]) => [round(x), y]);
    under.push({
      type: 'poly',
      points: [
        ...edge,
        [required(edge.at(-1), 'area endpoint')[0], base],
        [edge[0][0], base],
      ],
      closed: true,
      fill: 'wash2',
      enter: 'fade',
      dur: 0.3,
      ...cued('PERIOD', tip(Math.min(z, SAMPLES))),
      keys: [cued('LOWER', 0, { dur: 0.9, opacity: 0 })],
    });
  }

  els.push({
    type: 'path',
    d: smoothPath(pts),
    fill: 'none',
    stroke: 'accent2',
    width: wide ? 6 : 7,
    cap: 'round',
    join: 'round',
    enter: 'draw',
    drawEase: 'linear',
    dur: 1.8,
    ...cued('PERIOD', 0.1),
    keys: [cued('LOWER', 0, { dur: 0.9, opacity: 0.5 })],
  } satisfies CanvasElement);
  return { ...context, cued, wide, under, els };
}
