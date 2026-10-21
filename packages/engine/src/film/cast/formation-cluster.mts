import type { FormationLayout } from './formation-layout.mjs';

import { hash } from './common.mjs';
export function cluster(layout: FormationLayout) {
  const { ids, size, sx, sy, cx, cy, scale, n, place } = layout;

  // Hexagonal packing outward from the centre: a pile of objects touching.
  const gap = size * 1.08 * scale,
    cells = [[0, 0]];
  for (let ring = 1; cells.length < n; ring++)
    for (let k = 0; k < 6 * ring && cells.length < n; k++) {
      const side = Math.floor(k / ring),
        step = k % ring,
        a0 = (side * Math.PI) / 3,
        a1 = ((side + 1) * Math.PI) / 3;
      const [x0, y0, x1, y1] = [
        Math.cos(a0) * ring,
        Math.sin(a0) * ring,
        Math.cos(a1) * ring,
        Math.sin(a1) * ring,
      ];
      cells.push([
        x0 + (x1 - x0) * (step / ring),
        y0 + (y1 - y0) * (step / ring),
      ]);
    }
  ids.forEach((id, i) =>
    place(id, cx + cells[i][0] * gap * sx, cy + cells[i][1] * gap * -sy, {
      rotate: (hash(`${id}c`) - 0.5) * 12,
    }),
  );
}
