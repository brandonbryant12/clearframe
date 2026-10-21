import type { CanvasElement } from './types.mjs';
import type { GrowExtent } from './canvas-extent-contracts.mjs';
import { elementsExtent } from './canvas-extent.mjs';
export function scaledGroupExtent(
  el: CanvasElement,
  dx: number,
  dy: number,
  grow: GrowExtent,
): void {
  const n = (k: 'x' | 'y') => el[k] ?? 0;
  const scale = el.scale ?? 1;
  const e = elementsExtent(el.children ?? []);
  if (!e) return;
  // As the renderer scales it: about its origin, given in the frame around the group
  // (the centre of what it draws unless given).
  const [l0, t0] = [n('x') + e.left, n('y') + e.top];
  const [ox, oy] = el.origin ?? [l0 + e.w / 2, t0 + e.h / 2];
  const at = (x: number, y: number): [number, number] => [
    dx + ox + (x - ox) * scale,
    dy + oy + (y - oy) * scale,
  ];
  grow(...at(l0, t0), ...at(l0 + e.w, t0 + e.h));
}
