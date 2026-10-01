import { frame, poly, line, wash, gradient, group } from './_material-kit.mjs';

export default {
  name: 'paper-fold', order: 32,
  summary: 'A broad folded paper ribbon with lit and shaded faces, contact shadow and a crisp contrasting edge.',
  use: 'Editorial essays, professional announcements and chapter openings. A physical, warm alternative to a glowing technology backdrop; paper or daylight palettes.',
  build(w, h) {
    const { m, cx, cy } = frame(w, h),
      p = (x, y) => [cx + x * m, cy + y * m];
    return { layer: 'under', elements: [
      wash(cx, cy + m * 0.32, m * 0.52, m * 0.075, 'ink', 0.13),
      group([
        poly([p(-0.25, -0.30), p(0.10, -0.43), p(0.32, -0.14), p(-0.04, -0.01)], gradient(['surface', 'bg'], 30), { stroke: 'muted', width: 1, opacity: 0.9 }),
        poly([p(-0.04, -0.01), p(0.32, -0.14), p(0.17, 0.16), p(-0.24, 0.12)], gradient(['surface', 'accent'], 110), { opacity: 0.72 }),
        poly([p(-0.24, 0.12), p(0.17, 0.16), p(0.29, 0.39), p(-0.38, 0.32)], gradient(['bg', 'surface'], 55), { stroke: 'muted', width: 1, opacity: 0.9 }),
        line(p(-0.25, -0.30), p(-0.04, -0.01), { stroke: 'bg', width: 3, opacity: 0.85 }),
        line(p(-0.04, -0.01), p(0.32, -0.14), { stroke: 'ink', width: 1.5, opacity: 0.2 }),
        line(p(-0.24, 0.12), p(0.17, 0.16), { stroke: 'bg', width: 3, opacity: 0.7 }),
        line(p(-0.38, 0.32), p(0.29, 0.39), { stroke: 'accent2', width: 3, opacity: 0.55 }),
      ], { loop: { type: 'float', period: 9, amount: m * 0.009 } }),
    ] };
  },
};
