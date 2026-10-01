import { round } from '../../fframes/sketch-kit.mjs';

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
      big = round(tallFrame ? w * 0.22 : h * 0.27),
      lead = round(tallFrame ? w * 0.06 : h * 0.06),
      base = round(h / 2 + big * 0.42),
      origin = [cx, round(h / 2)];
    const push = [
      { at: 0, scale: 0.985, dur: 0 },
      { at: 0, scale: 1.07, dur: 4.5, ease: 'linear' },
    ];
    return {
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
        {
          type: 'group',
          origin,
          keys: push,
          at: 0,
          enter: 'none',
          children: [
            {
              type: 'text',
              text: 'LEAD',
              x: cx,
              y: round(base - big * 0.98 - lead * 0.3),
              size: lead,
              font: 'semibold',
              anchor: 'middle',
              tracking: 0.42,
              fit: round(w * 0.7),
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
              font: 'display',
              anchor: 'middle',
              tracking: 0.08,
              fit: round(w * (tallFrame ? 0.88 : 0.84)),
              fill: { gradient: ['muted', 'ink', 'ink', 'muted'], angle: 90 },
              // On screen from the cut, sharpening out of a soft blur.
              at: 0,
              enter: 'none',
              keys: [
                { at: 0, blur: 22, opacity: 0.55, dur: 0 },
                { at: 0, blur: 0, opacity: 1, dur: 0.3, ease: 'out' },
              ],
              shine: { at: 0.35, dur: 1.1, angle: 24, width: 0.22 },
            },
          ],
        },
        // An anamorphic streak crossing behind the words: the light that sweeps them.
        {
          type: 'ellipse',
          cx,
          cy: round(base - big * 0.36),
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
      ],
    };
  },
};
