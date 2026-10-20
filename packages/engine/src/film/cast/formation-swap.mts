import type { FormationLayout } from './formation-layout.mjs';

import { required } from './common.mjs';
export function swap(layout: FormationLayout) {
  const { f, current, cx, cy, out } = layout;

  // One becomes another in place: the old shrinks away where it stands, the new grows into its pose.
  const c = current.get(required(f.out, 'out')) ?? {
    x: cx,
    y: cy,
    scale: 1,
    rotate: 0,
  };
  out.set(required(f.out, 'out'), {
    x: c.x,
    y: c.y,
    scale: 0.01,
    rotate: c.rotate ?? 0,
    opacity: 0,
  });
  out.set(required(f.in, 'in'), {
    x: c.x,
    y: c.y,
    scale: c.scale ?? 1,
    rotate: 0,
    opacity: 1,
  });
}
