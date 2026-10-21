import type {
  allocationPlan,
  allocationClock,
} from '../../allocation-data.mjs';
import { text, rect } from '../drawing.mjs';
import { required } from '../validation.mjs';
import type { CanvasElement } from '../../types.mjs';
import { drawAllocationCounts } from './draw-allocation-counts.mjs';
import { drawAllocationMoves } from './draw-allocation-moves.mjs';
import type { allocationLayout } from './allocation-layout.mjs';

export function drawAllocationTrays({
  geometry,
  elements,
  id,
  model,
  font,
  clock,
  small,
  margin,
  h,
  tall,
  span,
  size,
}: DrawAllocationTraysContext) {
  for (const c of geometry.cards)
    elements.push(
      rect(`${id}-tray-${c.id}`, c.x, c.y, c.width, c.height, {
        fill: 'none',
        stroke: 'line',
        width: 2,
      }),
      text(
        `${id}-label-${c.id}`,
        model.buckets[c.index].label,
        c.x + c.width / 2,
        c.y + font * 1.05,
        font,
        { anchor: 'middle', fit: c.width - 24 },
      ),
    );
  const states = [
    { at: 0, counts: model.before.map((b) => b.count), inTransit: 0 },
    ...clock.events.flatMap((e) => [
      { at: e.start, counts: e.inTransit, inTransit: 1 },
      { at: e.end, counts: e.after, inTransit: 0 },
    ]),
  ];
  drawAllocationCounts({
    states,
    geometry,
    elements,
    id,
    model,
    font,
    small,
    margin,
    h,
    tall,
    span,
  });
  const groups = clock.events.filter(
    (e, i) => !i || e.groupIndex !== clock.events[i - 1].groupIndex,
  );
  elements.push(
    text(
      id + '-initial',
      'Before · every tile has one home',
      margin,
      h * (tall ? 0.815 : 0.82),
      font,
      {
        fit: span,
        ...(groups.length ? { exit: 'none', exitAt: groups[0].start } : {}),
      },
    ),
  );
  drawAllocationMoves({
    groups,
    model,
    clock,
    elements,
    id,
    margin,
    h,
    tall,
    font,
    span,
  });
  if (clock.events.length)
    elements.push(
      text(
        id + '-finished',
        'After · all transfers complete',
        margin,
        h * (tall ? 0.815 : 0.82),
        font,
        {
          fit: span,
          at: required(
            clock.events.at(-1),
            'allocation scene: no last transfer',
          ).end,
        },
      ),
    );
  for (const t of geometry.tracks)
    elements.push(
      rect(`${id}-token-${t.id}`, ...t.initial, size, size, {
        stroke: 'ink',
        width: 1,
        keys: t.keys,
      }),
    );
}

export interface DrawAllocationTraysContext {
  geometry: ReturnType<typeof allocationLayout>;
  elements: CanvasElement[];
  id: string;
  model: ReturnType<typeof allocationPlan>;
  font: number;
  clock: ReturnType<typeof allocationClock>;
  small: number;
  margin: number;
  h: number;
  tall: boolean;
  span: number;
  size: number;
}
