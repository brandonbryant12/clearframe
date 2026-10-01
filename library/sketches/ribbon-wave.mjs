import { frame, still, group, smoothPath, round, jitter } from './_material-kit.mjs';

export default {
  name: 'ribbon-wave', order: 35,
  summary: 'A broad looping ribbon drawn as parallel colour bands, with soft edge light and slow rotational sway.',
  use: 'Contemporary culture, creative tools and upbeat announcements. Geometric energy with room for clear type; sorbet, paper, pop or brand colours.',
  build(w, h, { seed } = {}) {
    const { m, cx, cy } = frame(w, h), j = jitter(seed),
      // One seeded spine shared by every band, so the bands stay parallel.
      spine = [[-0.48, 0.12], [-0.27, -0.28], [0.1, -0.32], [0.30, -0.12], [0.08, 0.02], [-0.15, 0.21], [0.12, 0.34], [0.46, 0.13]]
        .map(([x, y], i) => [x, y + (i && i < 7 ? j(0.03) : 0)]);
    const bands = Array.from({ length: 6 }, (_, i) => {
      const off = (i - 2.5) * m * 0.025;
      const p = (x, y) => [cx + x * m + off * 0.5, cy + y * m + off];
      return still('path', {
        d: smoothPath(spine.map(([x, y]) => p(x, y))),
        fill: 'none', stroke: i < 2 ? 'accent2' : 'accent', width: m * 0.020,
        cap: 'round', opacity: 0.62,
      });
    });
    return { layer: 'under', elements: [group(bands, {
      origin: [round(cx), round(cy)], loop: { type: 'sway', period: 8, amount: 5 },
      shadow: { blur: 14, dy: 8, opacity: 0.08 },
    })] };
  },
};
