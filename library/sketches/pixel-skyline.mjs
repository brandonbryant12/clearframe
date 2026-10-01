import { tall, round } from '../../fframes/sketch-kit.mjs';

// A level on a 1989 handheld: a city in two shades laid in LCD pixels, a pixel sun, a ground
// row, a small player who hops right in stepped motion, and a status bar. Every shape is a
// pixel mosaic on one grid, so neighbouring shapes share cells as they would on the screen.
const PX = { style: 'pixel', tile: 18, gap: 2 };
const CELL = 20;
const snap = v => Math.round(v / CELL) * CELL;

export default {
  name: 'pixel-skyline',
  order: 43,
  summary:
    'A handheld game screen: a two-shade pixel city, a pixel sun, a ground row, a player hopping right in stepped motion and a status bar.',
  use: 'Games and retro technology, a level or a stage in a process, progress through steps. Replace TITLE and DETAIL (status-bar words: LEVEL 2, 3/5) with sketchText. Pairs with the handheld treatment and lcd palette.',
  build(w, h) {
    const tallFrame = tall(w, h),
      ground = snap(h * (tallFrame ? 0.7 : 0.78));
    // Two rows of towers: far ones in the mid shade, near ones dark with lit windows.
    const far = [],
      near = [],
      windows = [];
    let x = -CELL * 2,
      i = 0;
    while (x < w + CELL * 4) {
      const width = CELL * (5 + ((i * 7) % 5)),
        height = CELL * (9 + ((i * 11) % 9));
      far.push({ type: 'rect', x: snap(x + CELL * 3), y: ground - height - CELL * 4, w: width, h: height + CELL * 4, fill: 'accent2', mosaic: PX });
      const nh = CELL * (5 + ((i * 5) % 8)),
        nw = CELL * (4 + ((i * 3) % 4));
      near.push({ type: 'rect', x: snap(x), y: ground - nh, w: nw, h: nh, fill: 'ink', mosaic: { ...PX, outline: false } });
      for (let r = 1; r < nh / CELL - 1; r += 2)
        for (let c = 1; c < nw / CELL - 1; c += 2)
          if ((r * 3 + c * 5 + i) % 4)
            windows.push({ type: 'rect', x: snap(x) + c * CELL, y: ground - nh + r * CELL, w: CELL, h: CELL, fill: 'bg', mosaic: PX });
      x += nw + CELL * (1 + (i % 2));
      i++;
    }
    const sun = { cx: snap(w * 0.8), cy: snap(h * (tallFrame ? 0.24 : 0.26)), r: CELL * 5 };
    // The player: a head, a body and two legs, standing on the ground row.
    const px = snap(w * 0.12);
    const player = [
      { type: 'rect', x: px + CELL, y: ground - CELL * 6, w: CELL * 2, h: CELL * 2, fill: 'ink' },
      { type: 'rect', x: px, y: ground - CELL * 4, w: CELL * 4, h: CELL * 2, fill: 'bg' },
      { type: 'rect', x: px, y: ground - CELL * 2, w: CELL, h: CELL * 2, fill: 'ink' },
      { type: 'rect', x: px + CELL * 3, y: ground - CELL * 2, w: CELL, h: CELL * 2, fill: 'ink' },
    ].map(r => ({ ...r, mosaic: { ...PX, outline: false } }));
    const run = snap(w * 0.6);
    return {
      elements: [
        { type: 'circle', ...sun, fill: 'accent2', mosaic: { ...PX, outline: false }, enter: 'assemble', at: 0, dur: 0.6 },
        { type: 'group', enter: 'none', at: 0, stagger: 0.06, children: far.map(e => ({ ...e, enter: 'assemble', dur: 0.5 })) },
        { type: 'group', enter: 'none', at: 0.2, stagger: 0.05, children: near.map(e => ({ ...e, enter: 'assemble', dur: 0.5 })) },
        // Windows light one by one: each is a single cell that takes the tower's pixel.
        { type: 'group', enter: 'none', at: 0.8, stagger: round(1.2 / Math.max(1, windows.length)), children: windows.map(e => ({ ...e, enter: 'pop', dur: 0.15 })) },
        { type: 'rect', x: -CELL, y: ground, w: w + CELL * 2, h: h - ground + CELL, fill: 'accent', mosaic: { ...PX, outline: false }, enter: 'none', at: 0 },
        {
          type: 'group',
          enter: 'pop',
          at: 0.5,
          fps: 8,
          shadow: { dx: 4, dy: 4, blur: 0, opacity: 0.25 },
          keys: [{ at: 0.9, x: run, dur: 4.5, ease: 'linear', hold: false }],
          loop: { type: 'float', period: 0.5, amount: CELL / 2 },
          children: player,
        },
        { type: 'rect', x: 0, y: 0, w, h: CELL * 7, fill: 'surface', enter: 'none', at: 0 },
        { type: 'text', text: 'TITLE', x: 110, y: CELL * 5, size: 44, font: 'mono', fill: 'ink', upper: true, fit: round(w * 0.5), enter: 'type', at: 0.2 },
        { type: 'text', text: 'DETAIL', x: w - 110, y: CELL * 5, size: 44, font: 'mono', fill: 'ink', anchor: 'end', upper: true, fit: round(w * 0.36), enter: 'type', at: 0.5 },
      ],
    };
  },
};
