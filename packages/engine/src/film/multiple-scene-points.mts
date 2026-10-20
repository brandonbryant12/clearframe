import { axisPosition, type AxisValue } from './plot-data.mjs';

import type { MultiplePanel } from './multiple-scene-contracts.mjs';
import { show, line } from './multiple-scene-common.mjs';

export function multiplePoints(panel: MultiplePanel): void {
  const { ctx } = panel;
  const { width, expandedId, reveal, p, geometry } = ctx;
  const { s, box, children, prefix, px, py } = panel;
  let previous: { x: AxisValue; y: number } | null = null;
  for (const [j, v] of s.values.entries()) {
    if (v.y === null) {
      previous = null;
      geometry.push({
        seriesId: s.id,
        index: j,
        date: v.x,
        value: null,
        point: null,
      });
      continue;
    }
    const at = reveal ? 0.7 + 3.5 * axisPosition(v.x, p.x) : 0,
      color = expandedId === s.id ? 'accent2' : 'accent';
    if (previous) {
      const start = reveal ? 0.7 + 3.5 * axisPosition(previous.x, p.x) : 0;
      children.push(
        line(
          `${prefix}-segment-${j}`,
          px(previous.x),
          py(previous.y),
          px(v.x),
          py(v.y),
          {
            stroke: color,
            width: width * 0.0025,
            ...(reveal
              ? {
                  at: start,
                  enter: 'draw',
                  dur: at - start,
                  drawEase: 'linear',
                }
              : {}),
          },
        ),
      );
    }
    children.push({
      id: `${prefix}-point-${j}`,
      type: 'circle',
      cx: px(v.x),
      cy: py(v.y),
      r: width * 0.0032,
      fill: color,
      ...show,
      at,
    });
    geometry.push({
      seriesId: s.id,
      index: j,
      date: v.x,
      value: v.y,
      local: [px(v.x), py(v.y)],
      point: [box[0] + px(v.x), box[1] + py(v.y)],
      at,
    });
    previous = v;
  }
}
