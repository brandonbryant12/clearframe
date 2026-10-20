import type { CanvasElement, Extent } from './types.mjs';
import { expandMacro } from './canvas-macro.mjs';
import { scaledGroupExtent } from './canvas-extent-group.mjs';
import { primitiveExtent } from './canvas-extent-primitives.mjs';
export type { ExtentField } from './canvas-extent-contracts.mjs';
/** Rough extent of canvas elements at rest, in author units: {w, h, bottom, left, top}. */
export function elementsExtent(elements: CanvasElement[]): Extent | null {
  let l = Infinity,
    t = Infinity,
    r = -Infinity,
    b = -Infinity;
  const grow = (x0: number, y0: number, x1: number, y1: number): void => {
    l = Math.min(l, x0);
    t = Math.min(t, y0);
    r = Math.max(r, x1);
    b = Math.max(b, y1);
  };
  const walk = (list: CanvasElement[], dx = 0, dy = 0): void => {
    for (const el of list) {
      // A receipt or an app is measured as the group it becomes.
      if (['receipt', 'app', 'crumbs'].includes(el.type)) {
        let drawn: CanvasElement | null = null;
        try {
          drawn = expandMacro(el, 'element', (m) => {
            throw new Error(m);
          });
        } catch {}
        if (drawn) walk([drawn], dx, dy);
        continue;
      }
      if (el.type === 'group') groupExtent(el, dx, dy, grow, walk);
      else primitiveExtent(el, dx, dy, grow);
    }
  };
  walk(elements);
  return Number.isFinite(l)
    ? { w: r - l, h: b - t, left: l, top: t, bottom: b }
    : null;
}

function groupExtent(
  el: CanvasElement,
  dx: number,
  dy: number,
  grow: (x0: number, y0: number, x1: number, y1: number) => void,
  walk: (elements: CanvasElement[], dx: number, dy: number) => void,
): void {
  if (el.scale != null && el.scale !== 1) scaledGroupExtent(el, dx, dy, grow);
  else walk(el.children ?? [], dx + (el.x ?? 0), dy + (el.y ?? 0));
}
