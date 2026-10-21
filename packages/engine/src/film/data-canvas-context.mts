import type { CanvasElement, Timed } from './types.mjs';
import type { ChartSpec, KeyedValue } from './data-canvas-contracts.mjs';
import { slug, r } from './data-canvas-common.mjs';

export function chartContext(
  spec: ChartSpec,
  { w, h }: { w: number; h: number },
) {
  // One bar compares nothing and fills its box (a reviewer took it for a render bug): one value is a number.
  if (spec.kind === 'bars' && spec.values.length === 1)
    spec = { ...spec, kind: 'number' };
  // A chart is mostly drawn by the first spoken word: an early start and a quick stagger.
  const id = spec.id ?? 'chart',
    at = spec.at ?? 0.05,
    stagger = spec.stagger ?? 0.08;
  const values: KeyedValue[] = spec.values.map((v) => ({
    ...v,
    key: `${id}-${slug(v.id ?? v.label)}`,
  }));
  const tall = h > w;
  const note = spec.note && {
    ...spec.note,
    target:
      values.find((v) => v.label === spec.note?.to) ??
      values.find((v) => v.highlight) ??
      values[0],
  };
  const fill = (v: KeyedValue): string => (v.highlight ? 'accent' : 'muted');
  // A value with `say` lands on that word (its parts `after` it); otherwise on the stagger.
  const when = (v: KeyedValue, t: number, offset = 0): Timed =>
    v.say
      ? { say: v.say, ...(offset ? { after: r(offset) } : {}) }
      : { at: r(t + offset) };
  const out: CanvasElement[] = [];
  return { spec, w, h, id, at, stagger, values, tall, note, fill, when, out };
}
