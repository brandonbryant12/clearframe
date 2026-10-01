import { frame, poly, line, wash, gradient, group, jitter } from './_material-kit.mjs';

export default {
  name: 'paper-fold', order: 32,
  summary: 'A broad folded paper ribbon with lit and shaded faces, contact shadow and a crisp contrasting edge.',
  use: 'Editorial essays, professional announcements and chapter openings. A physical, warm alternative to a glowing technology backdrop; paper or daylight palettes.',
  build(w, h, { seed } = {}) {
    const { m, cx, cy } = frame(w, h), j = jitter(seed),
      p = (x, y) => [cx + (x + j(0.025)) * m, cy + (y + j(0.025)) * m];
    // Each corner is placed once, so faces that share a fold keep sharing its edge.
    const [a, b, c, d, e, f, g, k] = [[-0.25, -0.30], [0.10, -0.43], [0.32, -0.14], [-0.04, -0.01],
      [0.17, 0.16], [-0.24, 0.12], [0.29, 0.39], [-0.38, 0.32]].map(([x, y]) => p(x, y));
    return { layer: 'under', elements: [
      wash(cx, cy + m * 0.32, m * 0.52, m * 0.075, 'ink', 0.13),
      group([
        poly([a, b, c, d], gradient(['surface', 'bg'], 30), { stroke: 'muted', width: 1, opacity: 0.9 }),
        poly([d, c, e, f], gradient(['surface', 'accent'], 110), { opacity: 0.72 }),
        poly([f, e, g, k], gradient(['bg', 'surface'], 55), { stroke: 'muted', width: 1, opacity: 0.9 }),
        line(a, d, { stroke: 'bg', width: 3, opacity: 0.85 }),
        line(d, c, { stroke: 'ink', width: 1.5, opacity: 0.2 }),
        line(f, e, { stroke: 'bg', width: 3, opacity: 0.7 }),
        line(k, g, { stroke: 'accent2', width: 3, opacity: 0.55 }),
      ], { loop: { type: 'float', period: 9, amount: m * 0.009 } }),
    ] };
  },
};
