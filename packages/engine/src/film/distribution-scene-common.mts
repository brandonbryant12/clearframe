import type { CanvasElement, ElementFields } from './types.mjs';
import type { Relation } from './distribution-data.mjs';
export function check(ok: unknown, m: string): asserts ok {
  if (!ok) throw Error(`distribution scene: ${m}`);
}
export const show = { at: 0, enter: 'none' },
  text = (
    id: string,
    value: unknown,
    x: number,
    y: number,
    size: number,
    extra: ElementFields = {},
  ): CanvasElement => ({
    id,
    type: 'text',
    text: String(value),
    x,
    y,
    size,
    fill: 'ink',
    font: 'text',
    ...show,
    ...extra,
  }),
  line = (
    id: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    extra: ElementFields = {},
  ): CanvasElement => ({
    id,
    type: 'line',
    x1,
    y1,
    x2,
    y2,
    stroke: 'line',
    width: 1,
    ...show,
    ...extra,
  });
const RELATION = { gte: '≥', gt: '>', lte: '≤', lt: '<' } satisfies Record<
  Relation,
  string
>;
export const thresholdLabel = (t: {
  relation: Relation;
  value: number;
}): string => `${RELATION[t.relation]} ${t.value}`;
