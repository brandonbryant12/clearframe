import type { JobBeat, CanvasElement } from './types.mjs';

import { sliceParts, validateSlices } from './job-slice-parts.mjs';
import { sliceElement } from './job-slice-element.mjs';
/**
 * One-to-many morphs (`morphFrom: {id, slice, axis}`): elements of this beat that come out of one
 * element of the beat before each start as their slice of it, so a part's bar breaks into its
 * parts. The slices of one source must not overlap (that would show a quantity twice), and the
 * source cannot also stay on screen under its own id. A source the beat before does not draw is
 * no morph: the parts arrive as authored. Returns whether anything was linked.
 */
export function linkSlices(
  _beat: JobBeat,
  list: CanvasElement[],
  prev: Map<string, CanvasElement>,
): boolean {
  const bySource = sliceParts(list, prev);
  for (const [id, parts] of bySource) {
    validateSlices(id, parts, list);
    for (const part of parts) sliceElement(id, part);
  }
  return bySource.size > 0;
}
