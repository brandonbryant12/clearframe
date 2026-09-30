import { round } from '../../fframes/sketch-kit.mjs';

// A trailer's type card: one short phrase in wide-tracked caps, centred on black,
// sharpening out of blur and easing slowly toward the viewer while it holds.
export default {
  name: 'card',
  order: 19,
  summary: 'A type card: one short phrase in wide-tracked caps, sharpening out of blur and easing toward the viewer.',
  use: 'Between montage shots in a trailer or opener ("BEFORE THE NOISE", "THIS FALL"). Replace CARD with sketchText; keep it to one to four words.',
  build(w, h) {
    const tallFrame = h > w;
    return {
      elements: [
        {
          type: 'text',
          text: 'CARD',
          x: round(w / 2),
          y: round(h / 2 + (tallFrame ? w * 0.03 : w * 0.018)),
          size: round(tallFrame ? w * 0.085 : w * 0.05),
          font: 'display',
          anchor: 'middle',
          // Wraps and fits: one line across a landscape frame, a two-line poster in a tall one.
          width: round(w * 0.84),
          tracking: 0.3,
          fill: 'ink',
          enter: 'blur',
          at: 0,
          dur: 0.28,
          keys: [
            { at: 0, scale: 0.97, dur: 0 },
            { at: 0, scale: 1.03, dur: 3.5, ease: 'linear' },
          ],
          origin: [round(w / 2), round(h / 2)],
        },
      ],
    };
  },
};
