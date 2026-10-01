import { frame, still, circle, wash, gradient, group, round } from './_material-kit.mjs';

export default {
  name: 'glass-orbits', order: 33,
  summary: 'Overlapping translucent optical discs, thin rims, soft caustic colour and a suspended solid sphere.',
  use: 'Light professional product and science storytelling. Suggests precision and depth without technical-looking UI. Use daylight, paper or a pale custom brand palette.',
  build(w, h) {
    const { m, cx, cy } = frame(w, h);
    const disc = (x, y, r, color, angle) => group([
      circle(x, y, r, gradient(['bg', color, 'bg'], angle), { opacity: 0.12 }),
      circle(x, y, r, 'none', { stroke: gradient(['bg', color, 'surface', color], angle), width: m * 0.014, opacity: 0.56 }),
      circle(x + m * 0.009, y, r * 0.97, 'none', { stroke: color, width: 1.5, opacity: 0.3 }),
      still('path', { d: `M ${round(x - r * 0.8)} ${round(y - r * 0.48)} A ${round(r * 0.93)} ${round(r * 0.93)} 0 0 1 ${round(x + r * 0.48)} ${round(y - r * 0.82)}`, fill: 'none', stroke: 'bg', width: 5, opacity: 0.95 }),
    ], { origin: [round(x), round(y)], loop: { type: 'orbit', period: 12 + angle / 20, amount: m * 0.009 } });
    return { layer: 'under', elements: [
      wash(cx, cy + m * 0.3, m * 0.5, m * 0.08, 'ink', 0.1),
      still('ellipse', { cx: round(cx), cy: round(cy + m * 0.34), rx: m * 0.48, ry: m * 0.025, fill: gradient(['bg', 'accent2', 'bg'], 0), stroke: 'none', opacity: 0.18, rotate: -18, origin: [round(cx), round(cy + m * 0.34)] }),
      disc(cx - m * 0.12, cy + m * 0.06, m * 0.32, 'accent', 20),
      disc(cx + m * 0.12, cy - m * 0.12, m * 0.27, 'accent2', 130),
      circle(cx + m * 0.03, cy + m * 0.12, m * 0.09, gradient(['bg', 'surface', 'accent2'], 45),
        { shadow: { blur: 16, dx: 3, dy: 12, opacity: 0.16 }, loop: { type: 'float', period: 7, amount: 9 } }),
      circle(cx - m * 0.16, cy - m * 0.27, m * 0.025, 'accent', { opacity: 0.8, loop: { type: 'float', period: 10, amount: 12 } }),
    ] };
  },
};
