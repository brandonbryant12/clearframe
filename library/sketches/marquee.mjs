import { round } from '../../fframes/sketch-kit.mjs';

// A poster end card ringed by a marquee: a line of type runs around all four edges of the frame
// (top and bottom one way, the sides the other), while the title is set big inside an arch.
// The border never stops, so the held end card stays alive.
export default {
  name: 'marquee',
  order: 26,
  summary:
    'A poster end card ringed by a marquee: one line of type runs around the frame edges while the title is set big inside an arch.',
  use: 'The end card of a promo, an event or a series: name, date, where to go. Replace TITLE, DETAIL and RUN (the short phrase that repeats around the edge) with sketchText.',
  build(w, h) {
    const tallFrame = h > w,
      band = round(Math.min(w, h) * 0.06),
      size = round(band * 0.42),
      cx = round(w / 2),
      // The arch: a rounded panel inside the border.
      ax = round(band * 1.6),
      ay = round(band * 2.2),
      aw = round(w - band * 3.2),
      ah = round(h - band * 3.8),
      title = round(tallFrame ? w * 0.16 : h * 0.2);
    // One edge of the marquee: the phrase repeated at a fixed pitch (keep RUN under about 28
    // characters), sliding one pitch every 8 s for as long as the shot lasts.
    const pitch = round(size * 20);
    const edge = (x, y, vertical, dir) => {
      const length = vertical ? h : w,
        copies = Math.ceil(length / pitch) + 9;
      return {
        type: 'group',
        enter: 'none',
        at: 0,
        children: Array.from({ length: copies }, (_, k) => {
          const px = round(vertical ? x : x - 4 * pitch + k * pitch),
            py = round(vertical ? y - 4 * pitch + k * pitch : y);
          return {
            type: 'text',
            text: 'RUN',
            x: px,
            y: py,
            size,
            font: 'semibold',
            tracking: 0.2,
            upper: true,
            fill: 'bg',
            ...(vertical ? { rotate: 90, origin: [px, py] } : {}),
            enter: 'none',
          };
        }),
        keys: [{ at: 0, [vertical ? 'y' : 'x']: round(dir * pitch * 4), dur: 32, ease: 'linear', hold: false }],
      };
    };
    return {
      elements: [
        { type: 'rect', x: 0, y: 0, w, h, fill: 'ink', enter: 'none', at: 0 },
        edge(0, round(band * 0.64), false, 1),
        edge(0, round(h - band * 0.36), false, -1),
        edge(round(band * 0.36), 0, true, -1),
        edge(round(w - band * 0.64), 0, true, 1),
        { type: 'rect', x: band, y: band, w: w - 2 * band, h: h - 2 * band, fill: 'accent', enter: 'none', at: 0 },
        {
          type: 'path',
          d: `M ${ax} ${ay + ah} L ${ax} ${round(ay + aw / 2)} A ${round(aw / 2)} ${round(aw / 2)} 0 0 1 ${ax + aw} ${round(ay + aw / 2)} L ${ax + aw} ${ay + ah} Z`,
          fill: 'surface',
          enter: 'wipe-up',
          at: 0.1,
          dur: 0.6,
        },
        {
          type: 'text',
          text: 'TITLE',
          x: cx,
          y: round(ay + ah * 0.62),
          size: title,
          font: 'poster',
          anchor: 'middle',
          fill: 'ink',
          fit: round(aw * 0.84),
          enter: 'rise',
          at: 0.45,
        },
        {
          type: 'text',
          text: 'DETAIL',
          x: cx,
          y: round(ay + ah * 0.62 + title * 0.55),
          size: round(title * 0.18),
          font: 'semibold',
          anchor: 'middle',
          fill: 'ink',
          tracking: 0.16,
          upper: true,
          fit: round(aw * 0.7),
          enter: 'rise',
          at: 0.8,
        },
      ],
    };
  },
};
