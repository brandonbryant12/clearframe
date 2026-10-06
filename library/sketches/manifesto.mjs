import { tall, round } from '../../film/sketch-kit.mjs';

// A constructivist poster in two inks on cream: a red circle, a black bar driving up the
// diagonal with the word reversed out of it, a red wedge striking into the circle and a
// halftone field where a photograph would be screened. Everything leans; the inks sit a
// little off register and wear like letterpress.
export default {
  name: 'manifesto',
  order: 42,
  summary:
    'A two-ink poster: a red circle, a black diagonal bar with the word reversed out, a red wedge striking in, a halftone field, all slightly off register.',
  use: 'A demand, a campaign line, a launch with a cause, a number stated as a fact to act on. Replace TITLE (one or two words) and DETAIL (a short line) with sketchText. Pairs with the constructivist treatment.',
  build(w, h) {
    const tallFrame = tall(w, h),
      s = Math.min(w, h),
      angle = tallFrame ? -28 : -16;
    const circle = tallFrame
      ? { cx: round(w * 0.62), cy: round(h * 0.3), r: round(s * 0.36) }
      : { cx: round(w * 0.7), cy: round(h * 0.4), r: round(s * 0.34) };
    const bar = { x: round(-0.2 * w), y: round(h * (tallFrame ? 0.52 : 0.56)), w: round(1.4 * w), h: round(s * 0.2) };
    const pivot = [round(w / 2), round(bar.y + bar.h / 2)];
    const title = round(bar.h * 0.74);
    return {
      elements: [
        // Where a photograph would be screened: a dot field fading in from the left.
        {
          type: 'rect',
          x: 0,
          y: round(h * 0.5),
          w: round(w * 0.62),
          h: round(h * 0.5),
          fill: 'none',
          print: { screen: 'dots', ink: 'ink', tone: [0.55, 0.0], axis: 0, cell: 12, angle: 45 },
          enter: 'wipe',
          at: 0.1,
          dur: 0.7,
        },
        {
          type: 'circle',
          ...circle,
          fill: 'accent',
          print: 'letterpress',
          origin: [circle.cx, circle.cy],
          enter: 'none',
          at: 0,
          keys: [
            { at: 0, scale: 0.25, dur: 0 },
            { at: 0.05, scale: 1, dur: 0.5, ease: 'spring' },
          ],
        },
        // The wedge strikes from the lower left into the circle.
        {
          type: 'poly',
          points: [
            [round(w * 0.04), h + 20],
            [round(circle.cx - circle.r * 0.2), round(circle.cy + circle.r * 0.25)],
            [round(w * (tallFrame ? 0.4 : 0.24)), h + 20],
          ],
          closed: true,
          fill: 'accent',
          print: 'letterpress',
          enter: 'wipe-up',
          at: 0.35,
          dur: 0.45,
        },
        {
          type: 'group',
          rotate: angle,
          origin: pivot,
          enter: 'none',
          at: 0,
          children: [
            { type: 'rect', ...bar, fill: 'ink', print: { wear: 0.25 }, enter: 'grow-x', at: 0.2, dur: 0.45 },
            {
              type: 'text',
              text: 'TITLE',
              x: round(w * (tallFrame ? 0.16 : 0.2)),
              y: round(bar.y + bar.h / 2 + title * 0.36),
              size: title,
              font: 'poster',
              fill: 'bg',
              upper: true,
              fit: round(w * (tallFrame ? 0.78 : 0.62)),
              enter: 'wipe',
              at: 0.55,
              dur: 0.45,
            },
          ],
        },
        {
          type: 'text',
          text: 'DETAIL',
          x: tallFrame ? 110 : 130,
          y: tallFrame ? round(h * 0.08) : 140,
          size: tallFrame ? 40 : 44,
          font: 'semibold',
          fill: 'ink',
          upper: true,
          tracking: 0.2,
          fit: round(w * (tallFrame ? 0.86 : 0.42)),
          enter: 'rise',
          at: 0.9,
        },
      ],
    };
  },
};
