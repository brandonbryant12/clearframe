import { round } from '../../film/sketch-kit.mjs';

// The signal goes quiet: the hairline from the opening, flat now, its point of light dimming and
// a last breath of light running out along it. In a tall frame the seam runs top to bottom, so the
// silence fills the frame it is shown in instead of floating in a band of black.
export default {
  name: 'flatline',
  order: 8.5,
  summary: 'The signal goes quiet: a flat seam of light, its point dimming, a last pulse running out along it. Vertical in tall frames.',
  use: 'The silence before a title or a turn, after a film that opened on the signal sketch. A beat with no voice; cut or flash into the hit.',
  build(w, h) {
    const tallFrame = h > w,
      cx = round(w / 2),
      cy = round(h / 2),
      long = tallFrame ? h : w;
    // Draw along the long side of the frame.
    const P = (u, v = 0) => (tallFrame ? [round(cx + v), round(u)] : [round(u), round(cy + v)]);
    const [x1, y1] = P(round(long * 0.04)),
      [x2, y2] = P(round(long * 0.96));
    return {
      elements: [
        {
          type: 'ellipse',
          cx,
          cy,
          rx: round(tallFrame ? w * 0.22 : w * 0.4),
          ry: round(tallFrame ? h * 0.42 : h * 0.12),
          fill: { gradient: ['accent', 'accent'], radial: true, fade: true },
          opacity: 0.12,
          at: 0,
          enter: 'none',
          loop: { type: 'pulse', period: 2.6, amount: 0.05 },
        },
        { type: 'line', x1, y1, x2, y2, stroke: 'muted', width: 2, opacity: 0.55, at: 0, enter: 'none' },
        {
          type: 'line',
          x1,
          y1,
          x2,
          y2,
          stroke: 'accent',
          width: 2.5,
          glow: { blur: 10, opacity: 0.8 },
          at: 0,
          enter: 'none',
          keys: [
            { at: 0, opacity: 0.9, dur: 0 },
            { at: 0.1, opacity: 0.2, dur: 1, ease: 'out' },
          ],
        },
        // A last pulse runs out along the line and is gone.
        {
          type: 'circle',
          cx: 0,
          cy: 0,
          r: 5,
          fill: 'ink',
          glow: { blur: 16, color: 'accent', opacity: 1 },
          at: 0,
          enter: 'none',
          along: { d: `M ${cx} ${cy} L ${x2} ${y2}`, at: 0, dur: 1.1, ease: 'in' },
          keys: [{ at: 0.6, opacity: 0, dur: 0.5 }],
          echo: { count: 8, lag: 0.02, fade: 0.75 },
        },
        {
          type: 'circle',
          cx,
          cy,
          r: 8,
          fill: 'ink',
          glow: { blur: 26, color: 'accent', opacity: 1 },
          at: 0,
          enter: 'none',
          keys: [{ at: 0.2, scale: 0.4, opacity: 0.35, dur: 1, ease: 'out' }],
          origin: [cx, cy],
        },
        {
          type: 'particles',
          x: 0,
          y: 0,
          w,
          h,
          kind: 'dust',
          count: 18,
          seed: 21,
          size: 3,
          speed: 0.3,
          fill: 'ink',
          opacity: 0.25,
          at: 0,
          enter: 'none',
        },
      ],
    };
  },
};
