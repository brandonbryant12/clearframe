import { edgeAnchor, text, line } from '../drawing.mjs';

import type { phaseTrail } from '../../phase-data.mjs';

import type { CanvasElement } from '../../types.mjs';
import { check } from './check.mjs';
import { phaseValue } from './phase-value.mjs';
import { tickLabelOffset } from './tick-label-offset.mjs';

export function drawPhaseAxes({
  m,
  px,
  small,
  py,
  left,
  right,
  yLabelWidth,
  elements,
  id,
  top,
  bottom,
  tall,
  margin,
  w,
}: DrawPhaseAxesContext) {
  check(
    m.x.ticks.every(
      (v, i) => !i || px(v) - px(m.x.ticks[i - 1]) >= small * 1.8,
    ),
    'x ticks too close',
  );
  check(
    m.y.ticks.every(
      (v, i) => !i || py(m.y.ticks[i - 1]) - py(v) >= small * 1.7,
    ),
    'y ticks too close',
  );
  const tickBoxes = m.x.ticks.map((v, i) => {
    const length = phaseValue(v, m.x.decimals).length * small * 0.7,
      start = px(v) - tickLabelOffset(i, m.x.ticks.length, length);
    return [start, start + length];
  });
  check(
    tickBoxes.every(
      (b, i) =>
        b[0] >= left - 1e-7 &&
        b[1] <= right + 1e-7 &&
        (!i || b[0] - tickBoxes[i - 1][1] >= small * 0.35),
    ),
    'x tick labels overlap; use fewer ticks or a shorter honest notation',
  );
  check(
    m.y.ticks.every(
      (v) => phaseValue(v, m.y.decimals).length * 28 * 0.7 <= yLabelWidth,
    ),
    'y tick labels cannot retain 28 px in the reserved margin',
  );
  for (const [i, v] of m.x.ticks.entries())
    elements.push(
      line(`${id}-x-grid-${i}`, px(v), top, px(v), bottom, {
        stroke: v === m.x.reference ? 'muted' : 'line',
        width: v === m.x.reference ? 2 : 1,
      }),
      text(
        `${id}-x-tick-${i}`,
        phaseValue(v, m.x.decimals),
        px(v),
        bottom + small * 1.25,
        small,
        {
          anchor: edgeAnchor(i, m.x.ticks.length - 1 + 1),
          font: 'figures',
        },
      ),
    );
  for (const [i, v] of m.y.ticks.entries())
    elements.push(
      line(`${id}-y-grid-${i}`, left, py(v), right, py(v), {
        stroke: v === m.y.reference ? 'muted' : 'line',
        width: v === m.y.reference ? 2 : 1,
      }),
      text(
        `${id}-y-tick-${i}`,
        phaseValue(v, m.y.decimals),
        left - small * 0.4,
        py(v) + small * 0.3,
        small,
        { anchor: 'end', font: 'figures', fit: yLabelWidth },
      ),
    );
  elements.push(
    text(
      id + '-y-name',
      m.y.label,
      tall ? margin : left,
      top - small * 0.65,
      small,
      { fit: tall ? w - 2 * margin : right - left },
    ),
    text(id + '-x-name', m.x.label, right, bottom + small * 2.65, small, {
      anchor: 'end',
      fit: right - left,
    }),
  );
}

export interface DrawPhaseAxesContext {
  m: ReturnType<typeof phaseTrail>;
  px: (v: number) => number;
  small: number;
  py: (v: number) => number;
  left: number;
  right: number;
  yLabelWidth: number;
  elements: CanvasElement[];
  id: string;
  top: number;
  bottom: number;
  tall: boolean;
  margin: number;
  w: number;
}
