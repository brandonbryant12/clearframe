import { round } from '../../fframes/sketch-kit.mjs';

// The main title: one frame-filling word that arrives as a silhouette cut out of light opening
// behind it, then fills with brushed metal and catches a sweep, over one tracked line of context.
// Designed to outrank the type cards (sketch card) in scale and treatment.
export default {
  name: 'title',
  order: 13,
  summary:
    'A main-title lockup: a frame-filling word that arrives as a silhouette against light opening behind it, then fills with brushed metal and catches a sweep; one tracked line.',
  use: 'The title in a trailer or opener, the product name in a reveal, the last card before the button. Replace TITLE and A LINE OF CONTEXT; cut into it with a flash.',
  build(w, h) {
    const tallFrame = h > w,
      size = round(tallFrame ? w * 0.34 : h * 0.5),
      cx = round(w / 2),
      mid = round(h * (tallFrame ? 0.46 : 0.47)),
      base = round(mid + size * 0.35),
      fit = round(w * (tallFrame ? 0.74 : 0.86)),
      word = extra => ({
        type: 'text',
        text: 'TITLE',
        x: cx,
        y: base,
        size,
        font: 'poster',
        anchor: 'middle',
        tracking: 0.04,
        // A long title shrinks to fit the frame instead of running off it.
        fit,
        at: 0,
        enter: 'none',
        ...extra,
      });
    return {
      // A slow push for the whole lockup (a camera move, so it cuts against the moving shots).
      view: [round(w * 0.025), round(h * 0.025), round(w * 0.95), round(h * 0.95)],
      viewFrom: [0, 0, w, h],
      viewAt: 0,
      viewDur: 6,
      elements: [
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
          opacity: 0.35,
          size: 3,
          at: 0,
          enter: 'none',
        },
        // The main title is lit from behind: a slit of light opens behind the word, so the
        // letters arrive as silhouettes cut out of it (a different treatment from the cards).
        {
          type: 'ellipse',
          cx,
          cy: mid,
          rx: round(w * (tallFrame ? 0.6 : 0.5)),
          ry: round(size * 0.8),
          fill: { gradient: ['ink', 'accent'], radial: true, fade: true },
          opacity: 0.6,
          origin: [cx, mid],
          at: 0,
          enter: 'none',
          keys: [
            { at: 0, scaleY: 0.04, dur: 0 },
            { at: 0, scaleY: 1, dur: 0.6, ease: 'out' },
            { at: 1.4, opacity: 0.32, dur: 1.6, ease: 'inOut' },
          ],
        },
        {
          type: 'group',
          origin: [cx, mid],
          at: 0,
          enter: 'none',
          keys: [
            { at: 0, scale: 1.06, dur: 0 },
            { at: 0, scale: 1, dur: 0.8, ease: 'out' },
          ],
          children: [
            word({ fill: 'bg' }),
            // Then the light comes through: the face fills with brushed metal and catches a sweep.
            word({
              fill: { gradient: ['muted', 'ink', 'ink', 'muted'], angle: 90 },
              keys: [
                { at: 0, opacity: 0, dur: 0 },
                { at: 0.7, opacity: 1, dur: 1, ease: 'inOut' },
              ],
              shine: { at: 1.8, dur: 1.3, angle: 22, width: 0.24 },
            }),
          ],
        },
        {
          type: 'text',
          text: 'A LINE OF CONTEXT',
          x: cx,
          y: round(base + size * 0.3 + 24),
          size: tallFrame ? 40 : 34,
          font: 'semibold',
          anchor: 'middle',
          tracking: 0.42,
          fit: round(w * (tallFrame ? 0.68 : 0.7)),
          fill: 'muted',
          at: 1.3,
          enter: 'fade',
          dur: 0.7,
        },
      ],
    };
  },
};
