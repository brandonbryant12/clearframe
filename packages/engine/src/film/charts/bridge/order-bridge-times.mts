import { check } from './check.mjs';
import { placeUncuedColumns } from './place-uncued-columns.mjs';

/**
 * Reading order once spoken cues are resolved: cued columns are anchors and keep their times;
 * uncued columns keep theirs when they already fall in order between the anchors, otherwise they
 * are spread evenly between them (a gap apart after the last anchor). Cued columns out of order
 * are the author's to fix. Returns one time per column.
 */
export function orderBridgeTimes(
  times: number[],
  cued: boolean[],
  gap = 0.35,
): number[] {
  const out = [...times],
    anchors = cued.map((c, i) => (c ? i : -1)).filter((i) => i >= 0);
  for (let k = 1; k < anchors.length; k++)
    check(
      out[anchors[k]] > out[anchors[k - 1]],
      `column ${anchors[k] + 1} is cued at ${out[anchors[k]].toFixed(2)} s, before column ${anchors[k - 1] + 1} (${out[anchors[k - 1]].toFixed(2)} s); cue the drivers in reading order`,
    );
  check(!cued[0], 'the opening total is never cued');
  let i = 0;
  while (i < out.length) {
    if (cued[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < out.length && !cued[j]) j++;
    const lo = i > 0 ? out[i - 1] : -Infinity,
      hi = j < out.length ? out[j] : Infinity;
    const start = i;
    const run = out.slice(i, j),
      inOrder = run.every(
        (t, k) =>
          t > (k ? run[k - 1] : lo) && t < hi && (k || start > 0 || t >= 0),
      );
    placeUncuedColumns({ inOrder, hi, lo, gap, run, out, start });
    i = j;
  }
  return out;
}
