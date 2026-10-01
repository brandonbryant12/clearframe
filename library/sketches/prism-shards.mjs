import { frame, poly, line, wash, group, gradient, round, jitter } from './_material-kit.mjs';

export default {
  name: 'prism-shards', order: 38,
  summary: 'A suspended cluster of cut crystal facets, contrasting edge lights and offset fragment motion.',
  use: 'Gaming, bold music identities and futuristic reveals. Electric, neon or midnight; use briefly as a hero reveal or turn.',
  build(w, h, { seed } = {}) {
    const { m, cx, cy } = frame(w, h), j = jitter(seed);
    const shard = (u, v, size, tilt, color) => {
      const angle = round(tilt + j(10)), x = cx + u * m, y = cy + v * m, s = size * (1 + j(0.1)) * m,
        p = (a, b) => [x + a * s, y + b * s];
      return group([
        poly([p(0, -1), p(0.44, -0.2), p(0.06, 0.9), p(-0.36, 0.22)], gradient(['surface', color], 15), { opacity: 0.75 }),
        poly([p(0, -1), p(0.04, -0.02), p(-0.36, 0.22)], gradient(['ink', color], 45), { opacity: 0.78 }),
        poly([p(0.04, -0.02), p(0.44, -0.2), p(0.06, 0.9)], gradient([color, 'bg'], 70), { opacity: 0.9 }),
        line(p(0, -1), p(0.04, -0.02), { stroke: 'ink', width: 2.3, opacity: 0.9 }),
        line(p(0.04, -0.02), p(0.06, 0.9), { stroke: color, width: 2, glow: { blur: 8, opacity: 0.3 } }),
      ], { rotate: angle, origin: [round(x), round(y)], loop: { type: 'float', period: 6.5 + Math.abs(u) * 8, amount: 7 + size * 18 } });
    };
    return { layer: 'under', elements: [
      wash(cx, cy, m * 0.55, m * 0.55, 'accent2', 0.13),
      shard(-0.2, -0.12, 0.24, -24, 'accent2'),
      shard(0.2, 0.13, 0.22, 27, 'accent2'),
      shard(0, 0, 0.36, 12, 'accent'),
      shard(0.31, -0.27, 0.075, 45, 'accent'),
      shard(-0.26, 0.3, 0.06, -25, 'accent'),
    ] };
  },
};
