import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import type { DrawOpenWindowContext } from './contracts.mjs';

export function drawOpenWindow({
  end,
  start,
  firstWeekday,
  cell,
  els,
  R,
  cued,
}: DrawOpenWindowContext) {
  const span = end - start + 1;
  const sweep = Math.min(1.5, Math.max(0.6, span * 0.07));
  let d = start;
  while (d <= end) {
    const rowEnd = Math.min(end, d + (6 - ((firstWeekday + d - 1) % 7)));
    const [x0, y0] = cell(d),
      [x1] = cell(rowEnd);
    const from = (d - start) / span,
      len = (rowEnd - d + 1) / span;
    els.push({
      type: 'rect',
      x: x0 - R,
      y: y0 - R,
      w: round(x1 - x0 + 2 * R),
      h: 2 * R,
      r: R,
      fill: 'wash',
      enter: 'none',
      origin: [x0 - R, y0],
      ...cued('OPEN', round(0.25 + from * sweep)),
      keys: [
        cued('OPEN', round(0.25 + from * sweep), { dur: 0, scaleX: 0 }),
        cued('OPEN', round(0.25 + from * sweep), {
          dur: round(len * sweep),
          ease: 'linear',
          scaleX: 1,
        }),
      ],
    } satisfies CanvasElement);
    d = rowEnd + 1;
  }
}
