import { round } from '../../film/sketch-kit.mjs';

// The silence before an impact: a seam of light across the dark. A bright core is there on the
// first frame; a line opens from it to both edges while a band of light widens around it, with
// dust drifting through the beam. Use it on a beat with no voice, just before the title or the
// payoff; the flash or cut that follows lands twice as hard.
export default {
  name: 'pause',
  order: 17,
  summary:
    'The silence before an impact: a seam of light opening across the dark, a widening band of light and dust in the beam.',
  use: 'A beat with no voice right before the title, the number or the turn. Pair with a flash or hard cut into the next shot.',
  build(w, h) {
    const cx = round(w / 2),
      cy = round(h / 2),
      reach = round(w * 0.47);
    const seam = x2 => ({
      type: 'line',
      x1: cx,
      y1: cy,
      x2,
      y2: cy,
      stroke: 'ink',
      width: 3,
      cap: 'round',
      glow: { blur: 16, opacity: 0.9 },
      at: 0.25,
      enter: 'draw',
      dur: 1.8,
    });
    return {
      elements: [
        {
          type: 'ellipse',
          cx,
          cy,
          rx: round(w * 0.62),
          ry: round(h * 0.2),
          fill: { gradient: ['accent', 'accent'], radial: true, fade: true },
          opacity: 0.22,
          origin: [cx, cy],
          at: 0,
          enter: 'none',
          keys: [
            { at: 0, scaleY: 0.18, dur: 0 },
            { at: 0.2, scaleY: 1, dur: 2.6, ease: 'inOut', hold: false },
          ],
        },
        {
          type: 'particles',
          x: 0,
          y: round(cy - h * 0.22),
          w,
          h: round(h * 0.44),
          kind: 'dust',
          count: 46,
          fill: 'ink',
          opacity: 0.45,
          size: 3,
          at: 0,
          enter: 'none',
        },
        seam(cx - reach),
        seam(cx + reach),
        {
          type: 'circle',
          cx,
          cy,
          r: round(Math.min(w, h) * 0.006),
          fill: 'ink',
          glow: { blur: 22, opacity: 1 },
          at: 0,
          enter: 'none',
          loop: { type: 'pulse', period: 1.6, amount: 0.25 },
        },
      ],
    };
  },
};
