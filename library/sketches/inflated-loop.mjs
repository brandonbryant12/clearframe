import { frame, still, circle, wash, group, gradient, round, jitter } from './_material-kit.mjs';

// Reconstructed from the second imagegen material study: explicit back/capsule/front
// layers, palette paints, native geometry. No generated image is loaded at render time.
export default {
  name: 'inflated-loop', order: 39,
  summary: 'A softly inflated ring and diagonal capsule, layered with a real open centre and a shaded front arc.',
  use: 'Bubbly brand reveals, community and playful product films. Sorbet for warmth, daylight for calmer branded forms.',
  build(w, h, { seed } = {}) {
    const { m, cx, cy } = frame(w, h), j = jitter(seed), r = m * 0.235, thickness = m * 0.13,
      // The capsule always crosses the front arc, so the interlock survives every seed.
      lean = round(34 + j(16));
    const arc = `M ${round(cx - r)} ${round(cy)} A ${round(r)} ${round(r)} 0 0 0 ${round(cx + r)} ${round(cy)}`;
    return { layer: 'under', elements: [
      wash(cx, cy + m * 0.36, m * 0.42, m * 0.07, 'ink', 0.12),
      group([
        circle(cx, cy, r, 'none', { stroke: gradient(['surface', 'accent', 'surface'], 0), width: thickness }),
        still('rect', { x: round(cx - m * 0.06), y: round(cy - m * 0.37), w: round(m * 0.16), h: round(m * 0.74), r: round(m * 0.08),
          fill: gradient(['surface', 'accent2', 'bg'], 0), stroke: 'none', rotate: lean, origin: [round(cx), round(cy)],
          shadow: { blur: 14, dx: 3, dy: 8, opacity: 0.15 } }),
        still('path', { d: arc, fill: 'none', stroke: gradient(['surface', 'accent', 'surface'], 0), width: thickness, cap: 'butt' }),
        still('path', { d: `M ${round(cx - r * 0.84)} ${round(cy + r * 0.42)} A ${round(r * 0.94)} ${round(r * 0.94)} 0 0 0 ${round(cx + r * 0.78)} ${round(cy + r * 0.52)}`,
          fill: 'none', stroke: 'bg', width: m * 0.008, opacity: 0.38, cap: 'round' }),
      ], { origin: [round(cx), round(cy)], loop: { type: 'rock', period: 6, amount: 7 } }),
    ] };
  },
};
