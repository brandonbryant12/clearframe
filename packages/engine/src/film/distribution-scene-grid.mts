import type { DistributionContext } from './distribution-scene-contracts.mjs';
import { text, line } from './distribution-scene-common.mjs';
export function distributionGrid(ctx: DistributionContext): void {
  const { id, m, margin, size, left, right, py, elements } = ctx;
  for (const [i, v] of m.y.ticks.entries())
    elements.push(
      line(`${id}-grid-${i}`, left, py(v), right, py(v), {
        stroke: v === 0 ? 'muted' : 'line',
        width: v === 0 ? 2 : 1,
      }),
      text(
        `${id}-y-${i}`,
        v.toFixed(m.y.decimals),
        left - size * 0.4,
        py(v) + size * 0.3,
        size,
        { anchor: 'end', font: 'figures', fit: left - margin - size * 0.6 },
      ),
    );
}
