import type { CanvasElement } from './types.mjs';
import type { GrowExtent, ExtentField } from './canvas-extent-contracts.mjs';
import { textExtent } from './canvas-extent-text.mjs';
import { pathPoints } from './canvas-path.mjs';
export function primitiveExtent(
  el: CanvasElement,
  dx: number,
  dy: number,
  grow: GrowExtent,
): void {
  const n = (k: ExtentField) => el[k] ?? 0;
  if (['rect', 'image', 'meter', 'particles', 'document'].includes(el.type)) {
    grow(dx + n('x'), dy + n('y'), dx + n('x') + n('w'), dy + n('y') + n('h'));
    return;
  }
  if (el.type === 'solid') {
    const r = el.size ?? 120;
    grow(
      dx + n('cx') - r,
      dy + n('cy') - r,
      dx + n('cx') + r,
      dy + n('cy') + r,
    );
  } else if (el.type === 'circle' || el.type === 'ellipse') {
    const rx = el.r ?? el.rx ?? 0,
      ry = el.r ?? el.ry ?? 0;
    grow(
      dx + n('cx') - rx,
      dy + n('cy') - ry,
      dx + n('cx') + rx,
      dy + n('cy') + ry,
    );
  } else if (el.type === 'line')
    grow(
      dx + Math.min(n('x1'), n('x2')),
      dy + Math.min(n('y1'), n('y2')),
      dx + Math.max(n('x1'), n('x2')),
      dy + Math.max(n('y1'), n('y2')),
    );
  else if (el.type === 'icon') {
    const size = el.size ?? 64;
    grow(
      dx + n('x') - size / 2,
      dy + n('y') - size / 2,
      dx + n('x') + size / 2,
      dy + n('y') + size / 2,
    );
  } else if (el.type === 'text') textExtent(el, dx, dy, grow);
  else if (el.type === 'path' && typeof el.d === 'string') {
    for (const [x, y] of pathPoints(el.d)) grow(dx + x, dy + y, dx + x, dy + y);
  }
}
