import type {
  allocationPlan,
  allocationClock,
} from '../../allocation-data.mjs';
import { text } from '../drawing.mjs';
import { required } from '../validation.mjs';
import type { CanvasElement } from '../../types.mjs';

export function drawAllocationMoves({
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
}: DrawAllocationMovesContext) {
  for (const [i, g] of groups.entries()) {
    const from = required(
        model.buckets.find((b) => b.id === g.from),
        'allocation scene: missing source bucket',
      ).label,
      to = required(
        model.buckets.find((b) => b.id === g.to),
        'allocation scene: missing destination bucket',
      ).label,
      count = clock.events.filter((e) => e.groupIndex === g.groupIndex).length,
      end =
        groups[i + 1]?.start ??
        required(clock.events.at(-1), 'allocation scene: no last transfer').end;
    elements.push(
      text(
        `${id}-move-${i}`,
        `Move ${count} tiles: ${from} → ${to}`,
        margin,
        h * (tall ? 0.815 : 0.82),
        font,
        { fit: span, at: g.start, exit: 'none', exitAt: end },
      ),
    );
  }
}

export interface DrawAllocationMovesContext {
  groups: {
    start: number;
    end: number;
    index: number;
    groupIndex: number;
    token: string;
    fromSlot: number;
    toSlot: number;
    before: number[];
    inTransit: number[];
    after: number[];
    from: string;
    to: string;
  }[];
  model: ReturnType<typeof allocationPlan>;
  clock: ReturnType<typeof allocationClock>;
  elements: CanvasElement[];
  id: string;
  margin: number;
  h: number;
  tall: boolean;
  font: number;
  span: number;
}
