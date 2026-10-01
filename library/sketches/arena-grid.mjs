import { frame, still, poly, line, group, wash, round, jitter } from './_material-kit.mjs';

export default {
  name: 'arena-grid', order: 37,
  summary: 'An angular competition gate above a receding grid, with restrained edge lights and racing dashes.',
  use: 'Gaming, competitive launches and high-energy technology. Dark electric or neon palettes; side-lit geometry keeps a readable copy zone.',
  build(w, h, { seed } = {}) {
    const { m, cx, cy } = frame(w, h), j = jitter(seed), hy = cy + m * 0.24,
      p = (u, v) => [cx + u * m, cy + v * m],
      // The seed reshapes the gate: its width, height and the cut of each upper corner.
      sw = 1 + j(0.08), top = -0.32 + j(0.03), left = -0.18 + j(0.05), right = 0.21 + j(0.05);
    const gate = [p(-0.31 * sw, 0.21), p(-0.28 * sw, -0.21), p(left * sw, top), p(right * sw, top), p(0.31 * sw, -0.21), p(0.31 * sw, 0.21)];
    return { layer: 'under', elements: [
      wash(cx, cy, m * 0.57, m * 0.48, 'accent2', 0.12),
      ...Array.from({ length: 13 }, (_, i) => line([cx + (i - 6) * m * 0.024, hy], [cx + (i - 6) * m * 0.3, h * 1.1], { stroke: 'accent', opacity: 0.16, width: 1.5 })),
      ...Array.from({ length: 8 }, (_, i) => {
        const y = hy + (h - hy) * (i / 7) ** 1.7;
        return line([cx - m * 0.65, y], [w * 1.1, y], { opacity: 0.18, width: 1.5 });
      }),
      group([
        poly(gate, 'none', { closed: false, stroke: 'accent', width: 4, glow: { blur: 13, opacity: 0.5 } }),
        poly(gate.map(([x, y]) => [cx + (x - cx) * 1.13, cy + (y - cy) * 1.13]), 'none', { closed: false, stroke: 'accent2', width: 2, opacity: 0.4 }),
        poly(gate, 'none', { closed: false, stroke: 'ink', width: 4, dash: [12, 170], opacity: 0.8, loop: { type: 'dash', period: 2.5 } }),
        ...[-1, 1].map(dir => line(p(dir * 0.4, -0.09), p(dir * 0.4, 0.1), { stroke: 'accent2', width: 7, opacity: 0.7 })),
      ], { origin: [round(cx), round(cy)], loop: { type: 'float', period: 8, amount: 7 } }),
      still('particles', { x: round(cx - m * 0.5), y: round(cy - m * 0.5), w: round(m), h: round(m), kind: 'dust', count: 24, seed: 12, size: 2, speed: 0.4, fill: 'accent', opacity: 0.3 }),
    ] };
  },
};
