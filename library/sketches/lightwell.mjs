import { frame, still, poly, line, wash, gradient, group, round } from './_material-kit.mjs';

export default {
  name: 'lightwell', order: 30,
  summary: 'A pale architectural opening, bevelled walls and a long pool of light. Spacious, tactile and present from frame one.',
  use: 'Light professional openers, thoughtful reveals and long narration lead-ins. Use daylight or paper; leave copy left in landscape or above in portrait.',
  build(w, h) {
    const { m, tall, cx, cy } = frame(w, h),
      pw = m * 0.36, ph = m * 0.58, x = cx - pw / 2, y = cy - ph / 2,
      d = m * 0.075, floor = y + ph;
    return { layer: 'under', elements: [
      wash(cx, cy, m * 0.72, m * 0.7, 'accent2', 0.08),
      // A continuous floor, the portal's reflection and the cast beam make a place.
      line([0, floor], [w, floor], { stroke: 'muted', opacity: 0.12, width: 1.5 }),
      poly([[x, floor], [x + pw, floor], [x + pw + m * 0.42, h * 1.1], [x - m * 0.28, h * 1.1]],
        gradient(['surface', 'bg']), { opacity: 0.75 }),
      wash(cx + m * 0.04, floor + m * 0.015, pw * 0.82, m * 0.08, 'ink', 0.13),
      group([
        poly([[x - d, y - d], [x + pw + d, y - d], [x + pw, y], [x, y]], gradient(['bg', 'surface'])),
        poly([[x - d, y - d], [x, y], [x, floor], [x - d, floor + d]], gradient(['surface', 'bg'], 0)),
        poly([[x + pw, y], [x + pw + d, y - d], [x + pw + d, floor + d], [x + pw, floor]], gradient(['bg', 'surface'], 0)),
        still('rect', { x: round(x), y: round(y), w: round(pw), h: round(ph), fill: gradient(['surface', 'bg', 'accent2']), opacity: 0.72, stroke: 'none' }),
        line([x + pw, y], [x + pw, floor], { stroke: 'accent2', width: 3, opacity: 0.6 }),
        line([x, y], [x + pw, y], { stroke: 'ink', width: 1.4, opacity: 0.1 }),
        // Light on the threshold, never a solid accidental contour fill.
        still('rect', { x: round(x), y: round(floor - 3), w: round(pw), h: 3, fill: 'bg', glow: { blur: 12, opacity: 0.25, color: 'accent2' } }),
      ], { loop: { type: 'float', period: 14, amount: tall ? 5 : 3 } }),
      still('particles', { x: round(cx - pw), y: round(y), w: round(pw * 2), h: round(ph * 1.4), kind: 'dust', count: 18, size: 2, speed: 0.18, fill: 'accent2', opacity: 0.16, seed: 41 }),
    ] };
  },
};
