import { tall } from '../../film/sketch-kit.mjs';

export default {
  name: 'evidence-gap',
  order: 66,
  summary: 'A manuscript has a visible missing middle; an annotation points to the comparison the claim still needs.',
  use: 'The uncertainty turn in a research film. Replace the missing-test label with the actual limitation in the source.',
  build(w, h) {
    const vertical = tall(w, h), short = Math.min(w, h);
    const x = w * 0.12, y = h * (vertical ? 0.2 : 0.24), pw = w * 0.76, ph = h * (vertical ? 0.57 : 0.58);
    const gapY = y + ph * 0.34, gapH = ph * 0.32;
    return {
      elements: [
        { type: 'rect', x, y, w: pw, h: ph, fill: 'surface', at: 0, enter: 'none',
          shadow: { dx: 10, dy: 15, blur: 24, opacity: 0.13 } },
        { type: 'rect', x: x + pw * 0.06, y: y + ph * 0.07, w: pw * 0.23, h: ph * 0.025,
          fill: 'ink', at: 0, enter: 'none' },
        ...[0.16, 0.23, 0.79, 0.86].map((row, i) => ({ type: 'line',
          x1: x + pw * 0.07, y1: y + ph * row, x2: x + pw * (i % 2 ? 0.67 : 0.91), y2: y + ph * row,
          stroke: 'muted', opacity: 0.5, width: 3, at: 0, enter: 'none' })),
        // The missing strip is an absence, not a plotted uncertainty band.
        { type: 'poly', points: [[x - 8, gapY], [x + pw * 0.24, gapY + 13], [x + pw * 0.5, gapY - 5],
          [x + pw * 0.73, gapY + 8], [x + pw + 8, gapY - 4], [x + pw + 8, gapY + gapH],
          [x + pw * 0.72, gapY + gapH - 11], [x + pw * 0.48, gapY + gapH + 7],
          [x + pw * 0.25, gapY + gapH - 5], [x - 8, gapY + gapH + 5]],
          fill: 'bg', at: 0.7, enter: 'wipe', dur: 0.7 },
        { type: 'text', text: 'The missing comparison', x: w * 0.5, y: gapY + gapH * 0.59,
          font: 'serif-display-italic', anchor: 'middle', size: short * 0.062, fit: pw * 0.94,
          fill: 'accent', at: 1.2, enter: 'wipe', dur: 0.6 },
        { type: 'path', d: `M ${x + pw * 0.83} ${y + ph * 0.9} Q ${x + pw * 1.06} ${y + ph * 0.8} ${x + pw * 0.93} ${gapY + gapH * 0.66}`,
          fill: 'none', stroke: 'accent', width: 5, arrow: 'end', head: 18,
          at: 1.5, enter: 'draw', dur: 0.6 },
      ],
    };
  },
};
