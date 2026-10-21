import type { FormationLayout } from './formation-layout.mjs';

export function row(layout: FormationLayout) {
  const { ids, size, W, A, cx, cy, n, place, form } = layout;

  const along =
    form === 'row'
      ? Math.min(W * 0.84, size * 2 * n)
      : Math.min(A * 0.66, size * 1.9 * n);
  ids.forEach((id, i) => {
    const d =
      n === 1
        ? 0
        : -along / 2 + (along * (i / (n - 1)) * (n - 1)) / n + along / (2 * n);
    place(id, form === 'row' ? cx + d : cx, form === 'row' ? cy : cy + d);
  });
}
