import { elementsExtent } from './canvas.mjs';
import type { CanvasElement } from './types.mjs';
import type { Indexed } from './pointer-contracts.mjs';

/** Every element with an id, with the offset of the groups it sits in. */
export function index(
  list: CanvasElement[],
  dx = 0,
  dy = 0,
  out = new Map<string, Indexed>(),
): Map<string, Indexed> {
  for (const el of list) {
    if (el.id != null && !out.has(el.id)) out.set(el.id, { el, dx, dy });
    if (el.type === 'group')
      index(el.children ?? [], dx + (el.x ?? 0), dy + (el.y ?? 0), out);
  }
  return out;
}

/** A target's box in frame coordinates at rest, moved by any keys it has finished before `t`. */
export function box(
  entry: Indexed,
): { x: number; y: number; w: number; h: number } | null {
  const { el, dx, dy } = entry;
  const e = elementsExtent([el]);
  if (!e) return null;
  return { x: dx + e.left, y: dy + e.top, w: e.w, h: e.h };
}
