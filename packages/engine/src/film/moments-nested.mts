import type { CanvasElement, ScrollMove, Timed } from './types.mjs';

/** Resolve the timed responses attached to one element. */
export function applyNestedMoments(
  element: CanvasElement,
  path: string,
  at: (item: Timed, path: string) => number,
): void {
  for (const [index, key] of (element.keys ?? []).entries())
    if (key.cue != null) key.at = at(key, `${path}.keys[${index}]`);
  if (element.along?.cue != null)
    element.along.at = at(element.along, `${path}.along`);
  for (const [index, mark] of (element.marks ?? []).entries())
    if (!Array.isArray(mark) && mark.cue != null)
      mark.at = at(mark, `${path}.marks[${index}]`);
  const scroll: ScrollMove[] =
    element.type === 'document' ? (element.scroll ?? []) : [];
  for (const [index, move] of scroll.entries())
    if (move.cue != null) move.at = at(move, `${path}.scroll[${index}]`);
  if (typeof element.shine === 'object' && element.shine.cue != null)
    element.shine.at = at(element.shine, `${path}.shine`);
}
