import {
  show,
  ids,
  MORPH,
  partAt,
  childrenOf,
  barAt,
} from './breakdown-common.mjs';

import type {
  BreakdownScene,
  BreakdownElement,
} from './breakdown-contracts.mjs';
export function gatherBreakdown(
  { p }: BreakdownScene,
  els: BreakdownElement[],
  gather: string,
): void {
  // Gathered: the opened part's parts slide back into their slices of its bar (same ids as the
  // opened beat, so they morph), and the bar replaces them the frame they arrive.
  const part = partAt(p, gather),
    bar = barAt(els, ids(p, part.id, 'bar'));
  let run = 0;
  for (const child of childrenOf(part)) {
    const w = bar.w * (child.value / part.value);
    els.push({
      id: ids(p, part.id, child.id, 'bar'),
      type: 'rect',
      x: bar.x + run,
      y: bar.y,
      w,
      h: bar.h,
      r: 4,
      ...(child.remainder
        ? { fill: 'none', stroke: 'muted', width: 2.5, dash: [10, 8] }
        : { fill: bar.fill }),
      ...show,
      exit: 'none',
      exitAt: MORPH,
    });
    run += w;
  }
  Object.assign(bar, { at: MORPH, enter: 'none', dur: 0 });
  // The rest of the whole comes back around the part once its parts have met, so nothing the
  // part's name passes on its way down is on screen yet.
  const theirs = new Set(
    [part.id].flatMap((k) =>
      ['bar', 'label', 'value', 'marker'].map((x) => ids(p, k, x)),
    ),
  );
  for (const el of els)
    if (!theirs.has(el.id) && !el.id.startsWith(ids(p, part.id) + '-'))
      Object.assign(el, {
        at: Math.max(el.at ?? 0, MORPH),
        enter: 'fade',
        dur: 0.4,
      });
}
