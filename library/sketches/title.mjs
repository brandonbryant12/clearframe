import { round } from '../../fframes/sketch-kit.mjs';

// The title reveal: one word that fills the frame in a metallic gradient, sharpening out of blur
// on the hit while an anamorphic flare flashes across it and decays, a sweep of light, a slow
// push toward the viewer, then a rule and one line of context.
export default {
  name: 'title',
  order: 13,
  summary:
    'A title reveal: a frame-filling metallic word sharpening out of blur on a flare, a light sweep, a slow push, a rule and one line.',
  use: 'The title in a trailer or opener, the product name in a reveal, the last card before the button. Replace TITLE and A LINE OF CONTEXT; cut into it with a flash.',
  build(w, h) {
    const tallFrame = h > w,
      size = round(tallFrame ? w * 0.24 : h * 0.3),
      cx = round(w / 2),
      cy = round(h * (tallFrame ? 0.5 : 0.54)),
      origin = [cx, round(cy - size * 0.35)];
    return {
      elements: [
        {
          type: 'ellipse',
          cx,
          cy: round(cy - size * 0.35),
          rx: round(w * 0.44),
          ry: round(size * 1.1),
          fill: { gradient: ['accent', 'accent'], radial: true, fade: true },
          opacity: 0.16,
          at: 0,
          enter: 'none',
          loop: { type: 'pulse', period: 5, amount: 0.05 },
        },
        {
          type: 'particles',
          x: 0,
          y: 0,
          w,
          h,
          kind: 'dust',
          count: 40,
          seed: 5,
          fill: 'ink',
          opacity: 0.4,
          size: 3,
          at: 0,
          enter: 'none',
        },
        {
          type: 'group',
          origin,
          at: 0,
          enter: 'none',
          keys: [
            { at: 0, scale: 1.12, dur: 0 },
            { at: 0, scale: 1, dur: 0.7, ease: 'out' },
            { at: 0.7, scale: 1.05, dur: 6, ease: 'linear' },
          ],
          children: [
            {
              type: 'text',
              text: 'TITLE',
              x: cx,
              y: cy,
              size,
              font: 'display',
              anchor: 'middle',
              tracking: 0.2,
              // A long title shrinks to fit the frame instead of running off it.
              fit: round(w * (tallFrame ? 0.82 : 0.84)),
              fill: { gradient: ['muted', 'ink', 'ink', 'muted'], angle: 90 },
              // On screen from the flash, sharpening out of a soft blur.
              enter: 'none',
              at: 0,
              keys: [
                { at: 0, blur: 28, opacity: 0.6, dur: 0 },
                { at: 0, blur: 0, opacity: 1, dur: 0.45, ease: 'out' },
              ],
              shine: { at: 0.6, dur: 1.4, angle: 22, width: 0.26 },
            },
          ],
        },
        // The hit: a horizontal flare through the word that flashes and decays.
        {
          type: 'ellipse',
          cx,
          cy: round(cy - size * 0.36),
          rx: round(w * 0.5),
          ry: round(Math.max(4, h * 0.006)),
          fill: { gradient: ['ink', 'accent'], radial: true, fade: true },
          blend: 'screen',
          at: 0,
          enter: 'none',
          keys: [
            { at: 0, opacity: 0.9, scaleX: 0.6, dur: 0 },
            { at: 0, scaleX: 1.2, dur: 1.2, ease: 'out' },
            { at: 0.1, opacity: 0.25, dur: 1.4, ease: 'out' },
          ],
          origin: [cx, round(cy - size * 0.36)],
        },
        {
          type: 'rect',
          x: round(cx - w * 0.12),
          y: round(cy + size * 0.2),
          w: round(w * 0.24),
          h: 3,
          fill: 'accent',
          glow: { blur: 8, opacity: 0.7 },
          enter: 'grow-x',
          at: 0.9,
          dur: 0.8,
        },
        {
          type: 'text',
          text: 'A LINE OF CONTEXT',
          x: cx,
          y: round(cy + size * 0.2 + (tallFrame ? 76 : 64)),
          size: tallFrame ? 42 : 38,
          font: 'semibold',
          anchor: 'middle',
          tracking: 0.3,
          fit: round(w * 0.8),
          fill: 'muted',
          at: 1.2,
          enter: 'fade',
          dur: 0.7,
        },
      ],
    };
  },
};
