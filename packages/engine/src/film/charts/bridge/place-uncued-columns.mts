export function placeUncuedColumns({
  inOrder,
  hi,
  lo,
  gap,
  run,
  out,
  start,
}: PlaceUncuedColumnsContext) {
  if (!inOrder) {
    if (Number.isFinite(hi)) {
      const from = Number.isFinite(lo)
          ? lo
          : Math.max(0, hi - gap * (run.length + 1)),
        step = (hi - from) / (run.length + (Number.isFinite(lo) ? 1 : 0.5));
      run.forEach((_, k) => {
        out[start + k] = Number.isFinite(lo)
          ? from + step * (k + 1)
          : from + step * k;
      });
    } else
      run.forEach((t, k) => {
        out[start + k] = Math.max(t, (k ? out[start + k - 1] : lo) + gap);
      });
  }
}

export interface PlaceUncuedColumnsContext {
  inOrder: boolean;
  hi: number;
  lo: number;
  gap: number;
  run: number[];
  out: number[];
  start: number;
}
