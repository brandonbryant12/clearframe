import type { FormationLayout } from './formation-layout.mjs';

import { hash } from './common.mjs';
export function scatter(layout: FormationLayout) {
  const {
    ids,
    size,
    seed,
    extent,
    below,
    W,
    tall,
    u,
    A,
    cx,
    cy,
    wide,
    scale,
    n,
    place,
  } = layout;

  // A sunflower spiral spread over the frame, jittered by the id: even coverage, never a grid.
  const rx = (tall ? W * 0.36 : W * 0.38) * (wide ? wide / (u * 0.34) : 1),
    ry = (tall ? A * 0.34 : A * 0.33) * (wide ? wide / (u * 0.34) : 1);
  const pts = ids.map((id, i) => {
    const r = Math.sqrt((i + 0.5) / n),
      a = i * 2.39996 + seed + hash(`${id}${seed}`) * 0.6;
    return [Math.cos(a) * r * rx, Math.sin(a) * r * ry];
  });
  // A few points of a spiral lean to one side; centre them so the pile sits in the frame's middle.
  const [mx, my] = [0, 1].map((k) => pts.reduce((s, p) => s + p[k], 0) / n);
  // Wide objects (word pills) would land on each other: push overlapping pairs apart along their
  // shallower overlap until none touch. Deterministic, a few dozen passes at most.
  // (Counting the label that hangs below an object, so no object lands on another's name.)
  const box = ids.map((id) => {
    const [hw, hh] = extent(id);
    return [
      hw * scale + size * 0.08,
      Math.max(hh, below(id)) * scale + size * 0.08,
    ];
  });
  separate(pts, box);
  ids.forEach((id, i) =>
    place(id, cx + pts[i][0] - mx, cy + pts[i][1] - my, {
      rotate: (hash(`${id}r${seed}`) - 0.5) * 28,
      scale: scale * (0.85 + hash(`${id}s`) * 0.25),
    }),
  );
}

function pushApart(
  a: number[],
  b: number[],
  abox: number[],
  bbox: number[],
): boolean {
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const ox = abox[0] + bbox[0] - Math.abs(dx),
    oy = abox[1] + bbox[1] - Math.abs(dy);
  if (ox <= 0 || oy <= 0) return false;
  if (ox / (abox[0] + bbox[0]) < oy / (abox[1] + bbox[1])) {
    const d = ((dx >= 0 ? 1 : -1) * ox) / 2;
    a[0] -= d;
    b[0] += d;
  } else {
    const d = ((dy >= 0 ? 1 : -1) * oy) / 2;
    a[1] -= d;
    b[1] += d;
  }
  return true;
}
function separate(points: number[][], boxes: number[][]): void {
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        moved = pushApart(points[i], points[j], boxes[i], boxes[j]) || moved;
      }
    }
    if (!moved) break;
  }
}
