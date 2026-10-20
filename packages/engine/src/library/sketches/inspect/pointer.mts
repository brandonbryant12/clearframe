import { inspectMetrics } from './metrics.mjs';
import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { cursorPath } from './common.mjs';
import type { inspectReport } from './report.mjs';

export function inspectPointer(context: ReturnType<typeof inspectReport>) {
  const { w, side, compact, STEP, cued, btnC } = context;

  const metrics = inspectMetrics(side, compact);

  // The pointer comes in from below the button, presses it, and steps aside as the marks fade.
  const k = metrics.pointerScale;

  const start = [
    Math.min(w - round(60 * k), btnC[0] + (side ? 170 : 70)),
    btnC[1] + (side ? 300 : 280),
  ];

  const tip = [btnC[0] + 6 - start[0], btnC[1] + 8 - start[1]];

  const pointer = {
    type: 'path',
    d: cursorPath(start[0], start[1], k),
    fill: 'ink',
    stroke: 'surface',
    width: 3,
    join: 'round',
    enter: 'fade',
    dur: 0.15,
    ...cued(0),
    keys: [
      cued(0, { dur: STEP.light, ease: 'inOut', x: tip[0], y: tip[1] }),
      cued(STEP.light + 0.35, {
        dur: 0.3,
        ease: 'in',
        x: tip[0] + 40,
        y: tip[1] + 60,
        opacity: 0,
      }),
    ],
  } satisfies CanvasElement;
  return { ...context, w, side, STEP, cued, btnC, k, pointer };
}
