import { frame, circle, wash, group, gradient, round } from './_material-kit.mjs';

export default {
  name: 'bubble-cluster', order: 34,
  summary: 'A buoyant cluster of softly lit spheres in several sizes, with offset rhythms and restrained glossy highlights.',
  use: 'Friendly launches, community, wellbeing and optimistic explainers. A playful picture with a quiet copy region; sorbet or daylight works well.',
  build(w, h) {
    const { m, cx, cy } = frame(w, h);
    const bubbles = [
      [-0.21, 0.13, 0.15, 'accent2'], [0.2, -0.16, 0.13, 'accent'],
      [0.04, 0.02, 0.22, 'accent'], [-0.18, -0.21, 0.085, 'accent2'],
      [0.23, 0.22, 0.105, 'accent2'], [-0.29, -0.08, 0.038, 'accent'],
      [0.10, -0.31, 0.045, 'accent2'],
    ];
    return { layer: 'under', elements: [
      wash(cx, cy + m * 0.39, m * 0.45, m * 0.07, 'ink', 0.08),
      ...bubbles.map(([u, v, rr, color], i) => {
        const x = cx + u * m, y = cy + v * m, r = rr * m;
        return group([
          circle(x, y, r, gradient(['bg', color], 45), { opacity: 0.68, shadow: { blur: 16, dy: 8, opacity: 0.08 } }),
          circle(x - r * 0.25, y - r * 0.3, r * 0.46, { gradient: ['bg', 'bg'], radial: true, fade: true }, { opacity: 0.8 }),
          circle(x, y, r, 'none', { stroke: 'bg', width: 2, opacity: 0.65 }),
        ], { origin: [round(x), round(y)], loop: { type: 'float', period: 5.5 + i * 0.75, amount: 18 + i * 3 } });
      }),
    ] };
  },
};
