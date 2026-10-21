import type { CanvasElement, MorphFrom } from './types.mjs';

export interface SlicePart {
  el: CanvasElement;
  m: MorphFrom;
  from: CanvasElement;
}
export function sliceParts(
  list: CanvasElement[],
  prev: Map<string, CanvasElement>,
): Map<string, SlicePart[]> {
  const bySource = new Map<string, SlicePart[]>();
  for (const el of list) {
    if (!el.morphFrom) continue;
    const m = el.morphFrom;
    delete el.morphFrom;
    const from = prev.get(m.id);
    if (!from) continue;
    if (from.type !== 'rect')
      throw new Error(
        `${el.id} comes out of ${m.id}, which the beat before draws as a ${from.type}; only a rect can be divided`,
      );
    const parts = bySource.get(m.id) ?? [];
    parts.push({ el, m, from });
    bySource.set(m.id, parts);
  }

  return bySource;
}
export function validateSlices(
  id: string,
  parts: SlicePart[],
  list: CanvasElement[],
): void {
  if (list.some((el) => el.id === id))
    throw new Error(
      `${id} is divided into ${parts.map((x) => x.el.id).join(', ')} in this beat, so it cannot also stay on screen as itself (its quantity would show twice)`,
    );
  const sorted = [...parts].sort((a, b) => a.m.slice[0] - b.m.slice[0]);
  for (let k = 1; k < sorted.length; k++)
    if (sorted[k].m.slice[0] < sorted[k - 1].m.slice[1] - 1e-6)
      throw new Error(
        `${sorted[k].el.id} and ${sorted[k - 1].el.id} come out of overlapping slices of ${id}; the slices of one element must not overlap`,
      );
}
