import { frame, still, group, wash, smoothPath, round } from './_material-kit.mjs';

export default {
  name: 'contour-field', order: 31,
  summary: 'An asymmetric fine-line sculpture: nested organic contours ripple around a quiet centre, like a field of folded silk.',
  use: 'Research, systems, strategy and cultural films. Abstract illustrative geometry, never geographic or measured data. Keep copy in the open left/top region.',
  build(w, h) {
    const { m, cx, cy, tall } = frame(w, h);
    const contours = Array.from({ length: 28 }, (_, i) => {
      const r = m * (0.09 + i * 0.016);
      const points = Array.from({ length: 73 }, (_, j) => {
        const a = j / 72 * Math.PI * 2,
          k = 1 + 0.10 * Math.cos(a * 3 + i * 0.035) + 0.05 * Math.sin(a * 5);
        return [cx + Math.cos(a) * r * k * (tall ? 0.9 : 1.05), cy + Math.sin(a) * r * k * 0.88];
      });
      return still('path', { d: smoothPath(points) + ' Z', fill: 'none', stroke: i % 7 === 0 ? 'accent2' : 'accent',
        width: i % 7 === 0 ? 2.8 : 1.7, opacity: round(0.18 + (1 - i / 32) * 0.33) });
    });
    return { layer: 'under', elements: [
      wash(cx, cy, m * 0.6, m * 0.55, 'accent2', 0.08),
      group(contours, { origin: [round(cx), round(cy)], loop: { type: 'sway', period: 18, amount: 3.5 } }),
    ] };
  },
};
