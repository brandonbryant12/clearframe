import type { CanvasElement } from './types.mjs';

export { checkPointer } from './pointer-check.mjs';
export { POINTER_FIELDS } from './pointer-common.mjs';
import { index } from './pointer-targets.mjs';
import { pointerContext } from './pointer-context.mjs';
import { pointerMotion } from './pointer-motion.mjs';
import { pointerDrawing } from './pointer-draw.mjs';
/**
 * Replace each pointer in `list` (in place) with its cursor, and give each target its press.
 * `frame` is the canvas's width and height; `tall` frames default to a fingertip.
 */
export function expandPointers(
  list: CanvasElement[],
  { width = 1920, height = 1080 }: { width?: number; height?: number } = {},
): CanvasElement[] {
  const ids = index(list);
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (p?.type !== 'pointer') {
      if (p?.type === 'group' && p.children)
        expandPointers(p.children, { width, height });
      continue;
    }
    const ctx = pointerContext(p, ids, width, height);
    pointerMotion(ctx);
    list[i] = pointerDrawing(ctx);
  }
  return list;
}
