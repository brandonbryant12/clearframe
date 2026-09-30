import { round } from '../../fframes/sketch-kit.mjs';

// The silence before an impact: nothing but one thin line drawing itself in the middle of
// the dark, a faint breath of light behind it. Use it on a beat with no voice, just before
// the title or the payoff; the flash or cut that follows lands twice as hard.
export default {
  name: 'pause',
  order: 17,
  summary: 'The silence before an impact: one thin line drawing itself in the dark, a faint breath of light behind it.',
  use: 'A beat with no voice right before the title, the number or the turn. Pair with a flash or hard cut into the next shot.',
  build(w, h) {
    const cx = round(w / 2),
      cy = round(h / 2),
      half = round(Math.min(w, h) * 0.06);
    return {
      elements: [
        {
          type: 'ellipse',
          cx,
          cy,
          rx: round(w * 0.3),
          ry: round(h * 0.12),
          fill: { gradient: ['accent', 'accent'], radial: true, fade: true },
          opacity: 0.08,
          at: 0.2,
          enter: 'fade',
          dur: 1.6,
          loop: { type: 'pulse', period: 2.4, amount: 0.06 },
        },
        {
          type: 'line',
          x1: cx - half,
          y1: cy,
          x2: cx + half,
          y2: cy,
          stroke: 'ink',
          width: 2,
          cap: 'round',
          glow: { blur: 8 },
          at: 0.4,
          enter: 'draw',
          dur: 1.2,
        },
      ],
    };
  },
};
