import type { SequenceOrder } from './revisions-model.mjs';

/**
 * Did the sequence of beats change between two orders of ids (not times: a cut that moves
 * later beats earlier is not a reorder)? Beats in both are compared (`before`, `after`); `moved`
 * is a smallest set of beats whose moving explains the new order (those outside a longest run
 * kept in order).
 */
export function sequenceMoves(
  before: string[],
  after: string[],
): SequenceOrder {
  const inBoth = new Set(before.filter((id) => after.includes(id)));
  const a = before.filter((id) => inBoth.has(id)),
    b = after.filter((id) => inBoth.has(id));
  if (a.join('\n') === b.join('\n')) return { reordered: false, moved: [] };
  // Longest increasing subsequence of the old positions, in the new order.
  const pos = b.map((id) => a.indexOf(id));
  const tails: number[] = [],
    prev: number[] = new Array<number>(pos.length).fill(-1);
  pos.forEach((p, i) => {
    let lo = 0,
      hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pos[tails[mid]] < p) lo = mid + 1;
      else hi = mid;
    }
    prev[i] = lo ? tails[lo - 1] : -1;
    tails[lo] = i;
  });
  const stay = new Set<string>();
  for (let i = tails.length ? tails[tails.length - 1] : -1; i >= 0; i = prev[i])
    stay.add(b[i]);
  return {
    reordered: true,
    moved: b.filter((id) => !stay.has(id)),
    before: a,
    after: b,
  };
}
