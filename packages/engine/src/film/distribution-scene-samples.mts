import { type DistributionObservation } from './distribution-data.mjs';

import type { DistributionContext } from './distribution-scene-contracts.mjs';
import { check, show } from './distribution-scene-common.mjs';
export function distributionSamples(ctx: DistributionContext): void {
  const {
    id,
    focus,
    m,
    stripTop,
    stripBottom,
    r,
    pitch,
    px,
    elements,
    geometry,
  } = ctx;
  const rows: number[] = [];
  for (const o of [...m.observations]
    .filter(
      (o): o is DistributionObservation & { value: number } => o.value !== null,
    )
    .sort((a, b) => a.value - b.value || a.index - b.index)) {
    const x = px(o.value);
    let row = rows.findIndex((last) => x - last >= pitch);
    if (row < 0) {
      row = rows.length;
      rows.push(-Infinity);
    }
    rows[row] = x;
    const y = stripTop + row * pitch;
    check(
      y + r * 1.3 + 1.5 <= stripBottom,
      'sample strip too dense; fewer observations or larger frame required',
    );
    const selected = focus && o.qualifies,
      at = focus ? 0.45 : 0;
    elements.push({
      id: `${id}-sample-${o.index}`,
      type: 'circle',
      cx: x,
      cy: y,
      r,
      fill: 'accent',
      ...show,
    });
    if (selected)
      elements.push({
        id: `${id}-selected-${o.index}`,
        type: 'circle',
        cx: x,
        cy: y,
        r: r * 1.3,
        fill: 'none',
        stroke: 'ink',
        width: 3,
        ...show,
        at,
      });
    geometry.points.push({ ...o, point: [x, y], r, selected, at });
  }
}
