import { tall, round } from '../../film/sketch-kit.mjs';

// A cut-paper workbench: scraps of coloured paper lie scattered and turned on a cutting mat
// beside a pencil and a few offcuts. On BUILD they lift and fly into place, each landing a beat
// after the last, and become one product card: a frame, a title bar, a picture with its sun, lines
// of copy and a button. On REVEAL the finished card lifts off the mat and its words type in. Soft
// shadows keep every layer a separate piece of paper.
const AT = { BUILD: 1.0, REVEAL: 3.4 };
const SHADOW = { dx: 5, dy: 8, blur: 12, opacity: 0.22 };

// The product card's pieces in frame pixels, and where each one starts on the mat:
// [dx, dy, degrees, scale] from its place in the card.
function layout(w, h) {
  if (tall(w, h)) {
    const x = 160, y = 520, cw = 760, ch = 900;
    return {
      mat: [70, 260, w - 140, h - 520], grid: 90,
      card: [x, y, cw, ch],
      pieces: [
        ['frame', [x, y, cw, ch], 'bg', [-60, 40, -6, 0.6]],
        ['bar', [x, y, cw, 90], 'accent', [-30, -170, 9, 0.7]],
        ['picture', [x + 40, y + 130, cw - 80, 380], 'accent2', [180, 520, -12, 0.55]],
        ['sun', [x + cw - 190, y + 180, 100, 100], 'accent', [-470, 600, 0, 0.8]],
        ['line1', [x + 40, y + 550, 520, 30], 'muted', [-130, 495, 14, 0.8]],
        ['line2', [x + 40, y + 600, 440, 30], 'muted', [180, -640, -10, 0.8]],
        ['line3', [x + 40, y + 650, 360, 30], 'muted', [440, -545, 6, 0.8]],
        ['button', [x + 40, y + 740, 300, 100], 'accent', [440, 280, -16, 0.75]],
      ],
      pencil: [940, 1100, 80], offcuts: [[180, 360, 20], [150, 1180, -30], [860, 380, 50]],
      size: 46,
    };
  }
  const x = 560, y = 230, cw = 800, ch = 620;
  return {
    mat: [120, 90, w - 240, h - 180], grid: 80,
    card: [x, y, cw, ch],
    pieces: [
      ['frame', [x, y, cw, ch], 'bg', [-60, 30, -5, 0.6]],
      ['bar', [x, y, cw, 80], 'accent', [-470, -40, 9, 0.6]],
      ['picture', [x + 40, y + 120, 400, 300], 'accent2', [-520, 330, -12, 0.7]],
      ['sun', [x + 320, y + 160, 80, 80], 'accent', [-780, 60, 0, 0.8]],
      ['line1', [x + 480, y + 140, 280, 26], 'muted', [470, -100, 14, 0.8]],
      ['line2', [x + 480, y + 190, 240, 26], 'muted', [520, 120, -10, 0.8]],
      ['line3', [x + 480, y + 240, 200, 26], 'muted', [430, 300, 8, 0.8]],
      ['button', [x + 480, y + 330, 260, 80], 'accent', [480, 400, -16, 0.75]],
    ],
    pencil: [330, 900, -18], offcuts: [[260, 200, 20], [1640, 860, -30], [1640, 220, 50]],
    size: 40,
  };
}

export default {
  name: 'cut-paper',
  order: 71,
  summary:
    'A cut-paper workbench: scraps of coloured paper scattered on a cutting mat fly into place one after another and become one product card, which lifts off the mat as its words type in.',
  use: 'Building something from parts: scattered ideas or feedback becoming one product, a launch, "how it came together", a design process. Tactile and handmade; best on a light palette (paper, sketchbook, sorbet), where the shadows read. Replace PRODUCT (the card title) and ACTION (the button) with sketchText; land BUILD and REVEAL on words with sketchSay.',
  build(w, h) {
    const L = layout(w, h),
      [mx, my, mw, mh] = L.mat,
      [cx, cy, cw, ch] = L.card;
    const grid = [];
    for (let gx = mx + L.grid; gx < mx + mw; gx += L.grid) grid.push(`M ${gx} ${my + 16} L ${gx} ${my + mh - 16}`);
    for (let gy = my + L.grid; gy < my + mh; gy += L.grid) grid.push(`M ${mx + 16} ${gy} L ${mx + mw - 16} ${gy}`);
    const [px, py, pr] = L.pencil;
    const pieces = L.pieces.map(([id, [x, y, pw, ph], fill, [dx, dy, deg, s]], i) => {
      const round_ = id === 'sun' ? { type: 'circle', cx: x + pw / 2, cy: y + ph / 2, r: pw / 2 } : { type: 'rect', x, y, w: pw, h: ph, r: id === 'button' ? ph / 2 : id === 'frame' ? 18 : 6 };
      return {
        ...round_, id: `paper-${id}`, fill, shadow: SHADOW, origin: [x + pw / 2, y + ph / 2], enter: 'none', at: 0,
        keys: [
          { at: 0, x: dx, y: dy, rotate: deg, scale: s, dur: 0 },
          { cue: 'BUILD', at: AT.BUILD, x: 0, y: 0, rotate: 0, scale: 1, dur: round(0.6 + i * 0.16), ease: 'out' },
        ],
      };
    });
    return {
      // A slow push in over the bench, so the scattered scraps are never a held still.
      dolly: [{ at: 0, z: 0.12, dur: 8, ease: 'out' }],
      elements: [
        // The workbench: a cutting mat with its grid, a pencil and offcuts that stay where they lie.
        { type: 'rect', x: mx, y: my, w: mw, h: mh, r: 28, fill: 'surface', enter: 'none', at: 0 },
        { type: 'path', d: grid.join(' '), fill: 'none', stroke: 'muted', width: 2, opacity: 0.22, enter: 'none', at: 0 },
        { type: 'group', enter: 'none', at: 0, origin: [px, py], rotate: pr, children: [
          { type: 'rect', x: px - 210, y: py - 14, w: 360, h: 28, r: 4, fill: 'accent2', shadow: SHADOW },
          { type: 'poly', points: [[px + 150, py - 14], [px + 210, py], [px + 150, py + 14]], closed: true, fill: 'bg', shadow: SHADOW },
          { type: 'poly', points: [[px + 192, py - 4], [px + 210, py], [px + 192, py + 4]], closed: true, fill: 'ink' },
        ] },
        ...L.offcuts.map(([ox, oy, deg]) => ({ type: 'poly', points: [[ox - 40, oy + 26], [ox + 46, oy + 20], [ox - 6, oy - 34]], closed: true, fill: 'accent2', opacity: 0.85, shadow: SHADOW, origin: [ox, oy], rotate: deg, enter: 'none', at: 0 })),
        // The card: its pieces fly in on BUILD; on REVEAL the whole card lifts and its words type in.
        {
          type: 'group', enter: 'none', at: 0, origin: [cx + cw / 2, cy + ch / 2],
          keys: [{ cue: 'REVEAL', at: AT.REVEAL, scale: 1.04, y: -12, dur: 0.7, ease: 'out' }],
          children: [
            ...pieces,
            { type: 'text', text: 'PRODUCT', x: cx + 40, y: cy + round(L.pieces[1][1][3] * 0.68), size: L.size, font: 'semibold', fill: 'bg', fit: cw - 80, enter: 'type', cue: 'REVEAL', at: AT.REVEAL + 0.2 },
            { type: 'text', text: 'ACTION', x: L.pieces[7][1][0] + L.pieces[7][1][2] / 2, y: L.pieces[7][1][1] + round(L.pieces[7][1][3] * 0.64), size: L.size - 6, font: 'semibold', fill: 'bg', anchor: 'middle', fit: L.pieces[7][1][2] - 40, enter: 'fade', cue: 'REVEAL', at: AT.REVEAL + 0.2, dur: 0.5 },
          ],
        },
      ],
    };
  },
};
