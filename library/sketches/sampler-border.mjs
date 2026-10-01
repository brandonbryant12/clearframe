import { tall, round } from '../../fframes/sketch-kit.mjs';

// A sampler's frame, cross-stitched on linen: an outer border in madder red, an inner one in
// indigo, a heart in each corner and a row of small diamonds along the foot. It lies under a
// block (art: {sketch: "sampler-border"}) and leaves the middle of the frame clear for words.
const STITCH = { style: 'stitch', tile: 16, gap: 2, build: 'sweep' };
const PITCH = 18;
const snap = v => (Math.floor(v / PITCH) + 0.5) * PITCH;

export default {
  name: 'sampler-border',
  order: 44,
  layer: 'under',
  summary: 'A cross-stitched sampler frame: red and indigo borders, a heart in each corner, a row of diamonds along the foot.',
  use: 'Under a statement, quote or lesson about home, care, craft or heritage: art: {sketch: "sampler-border"}. The middle stays clear for native type. Pairs with the sampler treatment.',
  build(w, h) {
    const m = 24,
      inset = 30;
    const heart = (cx, cy, s) => {
      const p = (x, y) => `${round(cx + x * s)} ${round(cy + y * s)}`;
      return {
        type: 'path',
        d: `M ${p(0, 0.35)} C ${p(-0.1, 0.25)} ${p(-0.5, 0)} ${p(-0.5, -0.2)} C ${p(-0.5, -0.45)} ${p(-0.15, -0.5)} ${p(0, -0.25)} C ${p(0.15, -0.5)} ${p(0.5, -0.45)} ${p(0.5, -0.2)} C ${p(0.5, 0)} ${p(0.1, 0.25)} ${p(0, 0.35)} Z`,
        fill: 'accent',
        mosaic: STITCH,
      };
    };
    const corner = m + inset + 76;
    const hearts = [
      [corner, corner],
      [w - corner, corner],
      [corner, h - corner],
      [w - corner, h - corner],
    ].map(([x, y]) => heart(x, y, 120));
    const span = w - 2 * (corner + 120),
      count = Math.max(3, Math.floor(span / 110)),
      foot = snap(h - m - inset - 56);
    const diamonds = Array.from({ length: count }, (_, i) => {
      const x = snap(corner + 120 + ((i + 0.5) * span) / count);
      return {
        type: 'poly',
        points: [
          [round(x), foot - 36],
          [round(x + 36), foot],
          [round(x), foot + 36],
          [round(x - 36), foot],
        ],
        closed: true,
        fill: i % 2 ? 'accent2' : 'accent',
        mosaic: STITCH,
      };
    });
    return {
      layer: 'under',
      elements: [
        { type: 'rect', x: m, y: m, w: w - 2 * m, h: h - 2 * m, fill: 'none', stroke: 'accent', width: 6, mosaic: STITCH, enter: 'draw', at: 0, dur: 1.4 },
        {
          type: 'rect',
          x: m + inset,
          y: m + inset,
          w: w - 2 * (m + inset),
          h: h - 2 * (m + inset),
          fill: 'none',
          stroke: 'accent2',
          width: 6,
          mosaic: STITCH,
          enter: 'draw',
          at: 0.3,
          dur: 1.4,
        },
        { type: 'group', enter: 'none', at: 0.6, stagger: 0.15, children: hearts.map(e => ({ ...e, enter: 'assemble', dur: 0.8 })) },
        { type: 'group', enter: 'none', at: 1, stagger: 0.08, children: diamonds.map(e => ({ ...e, enter: 'assemble', dur: 0.5 })) },
      ],
    };
  },
};
