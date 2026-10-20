import type { FormationLayout } from './formation-layout.mjs';
export function keepInFrame({
  form,
  tall,
  W,
  H,
  out,
  extent,
  top,
  bottom,
  below,
}: FormationLayout) {
  // Every placed object stays whole inside the title-safe area (an exit leaves on purpose): a
  // formation set beside an object near an edge, or a wide ring, is pulled back in.
  if (form !== 'exit') {
    const [mx, my] = tall ? [W * 0.1, H * 0.06] : [W * 0.05, H * 0.05];
    for (const [id, t] of out) {
      const [hw, hh] = extent(id).map((v) => v * (t.scale ?? 1) * 1.16);
      t.x = Math.min(Math.max(t.x, mx + hw), W - mx - hw);
      // (A label hangs below its object, so the object stands higher by it.)
      t.y = Math.min(
        Math.max(t.y, Math.max(my, top) + hh),
        Math.min(H - my, bottom) - Math.max(hh, below(id) * (t.scale ?? 1)),
      );
    }
  }
}
