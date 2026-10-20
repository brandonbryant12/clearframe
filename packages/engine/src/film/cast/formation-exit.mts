import type { FormationLayout } from './formation-layout.mjs';

export function exit(layout: FormationLayout) {
  const { ids, current, W, H, cx, cy, out } = layout;

  // Each leaves along the line from the centre through where it stands, past the frame edge.
  ids.forEach((id) => {
    const c = current.get(id) ?? { x: cx, y: cy },
      dx = c.x - W / 2 || 1,
      dy = c.y - H / 2,
      d = Math.hypot(dx, dy) || 1,
      far = Math.hypot(W, H) * 0.7;
    out.set(id, {
      x: W / 2 + (dx / d) * far,
      y: H / 2 + (dy / d) * far,
      scale: c.scale ?? 1,
      rotate: (c.rotate ?? 0) + 20,
      opacity: 0,
    });
  });
}
