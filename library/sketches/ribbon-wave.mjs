import { frame, still, group, smoothPath, round } from './_material-kit.mjs';

export default {
  name: 'ribbon-wave', order: 35,
  summary: 'A broad looping ribbon drawn as parallel colour bands, with soft edge light and slow rotational sway.',
  use: 'Contemporary culture, creative tools and upbeat announcements. Geometric energy with room for clear type; sorbet, paper, pop or brand colours.',
  build(w, h) {
    const { m, cx, cy } = frame(w, h);
    const bands = Array.from({ length: 6 }, (_, i) => {
      const off = (i - 2.5) * m * 0.025;
      const p = (x, y) => [cx + x * m + off * 0.5, cy + y * m + off];
      return still('path', {
        d: smoothPath([p(-0.48, 0.12), p(-0.27, -0.28), p(0.1, -0.32), p(0.30, -0.12), p(0.08, 0.02), p(-0.15, 0.21), p(0.12, 0.34), p(0.46, 0.13)]),
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
