import { round } from '../../film/sketch-kit.mjs';

// A trailer's type card, set like a poster: a short lead line in wide-tracked caps over one or
// two huge words that fill the frame. The words sharpen out of blur, a light sweeps across
// them, an anamorphic streak crosses behind, and the whole card keeps pushing toward the viewer.
export default {
  name: 'card',
  order: 19,
  summary:
    'A trailer type card: a small lead line over huge words that fill the frame, sharpening out of blur under a light sweep while the card pushes in.',
  use: 'Between montage shots in a trailer or opener. Replace LEAD (one to three words, or "" for none) and CARD (one or two words) with sketchText: {"LEAD": "BEFORE", "CARD": "THE NOISE"}.',
  build(w, h) {
    const tallFrame = h > w,
      cx = round(w / 2),
      // Landscape cards sit in the middle of a 2.39 letterbox: ~0.74 of the frame height.
      big = round(tallFrame ? w * 0.2 : h * 0.24),
      lead = round(tallFrame ? w * 0.06 : h * 0.06),
      base = round(h / 2 + big * 0.38);
    return {
      // The camera keeps pushing in while the card holds: a moving shot, cut against moving shots.
      view: [round(w * 0.035), round(h * 0.035), round(w * 0.93), round(h * 0.93)],
      viewFrom: [0, 0, w, h],
      viewAt: 0,
      viewDur: 4.5,
      elements: [
        // A low warm haze behind the type, so black is never flat.
        {
          type: 'ellipse',
          cx,
          cy: round(h / 2),
          rx: round(w * 0.42),
          ry: round(big * 0.9),
          fill: { gradient: ['accent', 'accent'], radial: true, fade: true },
          opacity: 0.1,
          at: 0,
          enter: 'none',
        },
        {
          type: 'particles',
          x: 0,
          y: round(h * 0.2),
          w,
          h: round(h * 0.6),
          kind: 'dust',
          count: 26,
          seed: 9,
          size: 3,
          speed: 0.5,
          fill: 'ink',
          opacity: 0.35,
          at: 0,
          enter: 'none',
        },
        // An anamorphic streak crossing behind the words (drawn first, so it never strikes through them).
        {
          type: 'ellipse',
          cx,
          cy: round(base + big * 0.07),
          rx: round(w * 0.36),
          ry: round(Math.max(3, h * 0.004)),
          fill: { gradient: ['ink', 'accent'], radial: true, fade: true },
          opacity: 0.7,
          blend: 'screen',
          at: 0.2,
          enter: 'fade',
          dur: 0.2,
          keys: [
            { at: 0.2, x: round(-w * 0.5), dur: 0 },
            { at: 0.2, x: round(w * 0.5), dur: 1.6, ease: 'inOut' },
            { at: 1.4, opacity: 0, dur: 0.4 },
          ],
        },
        {
          type: 'group',
          at: 0,
          enter: 'none',
          children: [
            {
              type: 'text',
              text: 'LEAD',
              x: cx,
              y: round(base - big * 0.86 - lead * 0.3),
              size: lead,
              font: 'semibold',
              anchor: 'middle',
              tracking: 0.42,
              fit: round(w * (tallFrame ? 0.56 : 0.7)),
              fill: 'muted',
              at: 0,
              enter: 'none',
            },
            {
              type: 'text',
              text: 'CARD',
              x: cx,
              y: base,
              size: big,
              font: 'poster',
              anchor: 'middle',
              tracking: 0.04,
              // Tall frames keep stacked type inside the middle 80%, even at the end of the push.
              fit: round(w * (tallFrame ? 0.72 : 0.84)),
              // Flat, matte type: the main title alone gets the metal and the backlight.
              fill: 'ink',
              // On screen from the cut, sharpening out of a soft blur.
              at: 0,
              enter: 'none',
              keys: [
                { at: 0, blur: 8, opacity: 0.8, dur: 0 },
                { at: 0, blur: 0, opacity: 1, dur: 0.14, ease: 'out' },
              ],
            },
          ],
        },
      ],
    };
  },
};
