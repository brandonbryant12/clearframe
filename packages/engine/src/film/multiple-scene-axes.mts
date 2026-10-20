import { axisLabel } from './plot-data.mjs';

import type { MultiplePanel } from './multiple-scene-contracts.mjs';
import { text, line } from './multiple-scene-common.mjs';

export function multipleAxes(panel: MultiplePanel): void {
  const { ctx } = panel;
  const { p, tick, local, dateLabel } = ctx;
  const { children, prefix, px, py } = panel;
  for (const [j, y] of p.y.ticks.entries())
    children.push(
      line(`${prefix}-grid-${j}`, local.left, py(y), local.right, py(y), {
        stroke: y === 0 ? 'muted' : 'line',
        width: y === 0 ? 2 : 1,
      }),
      text(
        `${prefix}-y-${j}`,
        axisLabel(y, p.y),
        local.left - tick * 0.25,
        py(y) + tick * 0.3,
        tick,
        { anchor: 'end', font: 'figures', fit: local.left - tick * 0.4 },
      ),
    );
  for (const [j, x] of p.x.ticks.entries())
    children.push(
      text(
        `${prefix}-x-${j}`,
        dateLabel(x),
        px(x),
        local.bottom + tick * 1.1,
        tick,
        {
          anchor: tickAnchor(j, p.x.ticks.length),
          font: 'figures',
          fit: ((local.right - local.left) / (p.x.ticks.length - 1)) * 0.9,
        },
      ),
    );
}

function tickAnchor(i: number, count: number): string {
  if (i === 0) return 'start';
  if (i === count - 1) return 'end';
  return 'middle';
}
