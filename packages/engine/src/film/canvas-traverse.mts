import type { CanvasElement } from './types.mjs';

/** Visit every element, depth first. */
export function eachElement(
  list: CanvasElement[] | null | undefined,
  visit: (el: CanvasElement) => void,
): void {
  for (const el of list ?? []) {
    visit(el);
    if (el.type === 'group') eachElement(el.children, visit);
  }
}
