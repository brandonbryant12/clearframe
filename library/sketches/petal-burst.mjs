import { frame, still, circle, group, gradient, round } from './_material-kit.mjs';

export default {
  name: 'petal-burst', order: 36,
  summary: 'A rotating rosette of rounded paper petals, a contrasting centre and a few orbiting confetti discs.',
  use: 'Creative events, joyful reveals and culture stories. A graphic, rounded alternative to sharp sunbursts. Use sorbet for soft energy or pop for print-poster impact.',
  build(w, h) {
    const { m, cx, cy } = frame(w, h), r = m * 0.29;
    const petals = Array.from({ length: 12 }, (_, i) => still('ellipse', {
      cx: round(cx), cy: round(cy - r * 0.52), rx: round(r * 0.25), ry: round(r * 0.74),
      fill: gradient([i % 3 ? 'accent' : 'accent2', 'surface'], 90), stroke: 'none',
      rotate: i * 30, origin: [round(cx), round(cy)], opacity: 0.82,
    }));
    return { layer: 'under', elements: [
      group(petals, { origin: [round(cx), round(cy)], loop: { type: 'spin', period: 30, amount: 1 } }),
      circle(cx, cy, r * 0.32, 'bg', { shadow: { blur: 8, dy: 4, opacity: 0.1 } }),
      circle(cx, cy, r * 0.13, 'ink'),
      ...[[-0.36, -0.27, 0.029], [0.32, 0.31, 0.045], [0.42, -0.07, 0.018]].map(([u, v, size], i) =>
        circle(cx + m * u, cy + m * v, m * size, i % 2 ? 'accent' : 'accent2',
          { loop: { type: 'float', period: 6 + i * 2, amount: 13 }, opacity: 0.8 })),
    ] };
  },
};
