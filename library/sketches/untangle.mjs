import { tall, round } from '../../film/sketch-kit.mjs';

// From a tangle to a line: six cards (a message, a person, a document, settings, a database, a
// check) lie scattered and turned, joined by crossing curves with friction points pulsing on them.
// On UNTANGLE the curves let go and the cards glide into one row (a column on tall frames); on FLOW
// one clean line draws through them and a packet runs along it, again and again. The same pieces,
// in order: simplification you can watch.
const AT = { UNTANGLE: 1.6, FLOW: 3.4 };
const ICONS = ['mail', 'user', 'file', 'settings', 'database', 'check'];
const FILLS = ['surface', 'surface', 'surface', 'surface', 'surface', 'accent'];
const PAIRS = [[0, 3], [1, 4], [2, 5], [0, 2], [3, 1], [4, 5], [5, 0], [1, 2], [3, 5]];

function layout(w, h) {
  if (tall(w, h)) {
    const ys = [500, 720, 940, 1160, 1380, 1600];
    return {
      card: [240, 160], icon: 88,
      aligned: ys.map(y => [540, y]),
      scattered: [[330, 600], [760, 1480], [770, 760], [300, 1320], [800, 1120], [330, 980]],
      tags: [round(w * 0.12), 330], size: 46,
    };
  }
  const xs = [300, 564, 828, 1092, 1356, 1620];
  return {
    card: [220, 160], icon: 84,
    aligned: xs.map(x => [x, 560]),
    scattered: [[440, 330], [1380, 780], [780, 800], [1560, 330], [300, 780], [1060, 360]],
    tags: [round(w * 0.12), 190], size: 42,
  };
}

export default {
  name: 'untangle',
  order: 73,
  summary:
    'From a tangle to a line: six scattered cards joined by crossing curves with pulsing friction points glide into one row as the curves let go, then one clean line draws through them and work flows along it.',
  use: 'Simplification and clarity: a messy process made simple, before and after a redesign, "everything in one place", fewer handoffs, an integration. Works on light and dark palettes. Replace BEFORE and AFTER (the corner tags) with sketchText; land UNTANGLE and FLOW on words with sketchSay.',
  build(w, h) {
    const L = layout(w, h),
      [cw, ch] = L.card;
    // Crossing curves between the scattered cards, bowed hard to either side so they cross.
    const curves = PAIRS.map(([a, b], i) => {
      const [x1, y1] = L.scattered[a], [x2, y2] = L.scattered[b];
      const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2], len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const [nx, ny] = [-(y2 - y1) / len, (x2 - x1) / len], k = (i % 2 ? 1 : -1) * len * 0.45;
      return `M ${x1} ${y1} C ${round(mx + nx * k)} ${round(my + ny * k)} ${round(mx - nx * k * 0.6)} ${round(my - ny * k * 0.6)} ${x2} ${y2}`;
    });
    const friction = [0, 3, 6].map(i => {
      const [a, b] = PAIRS[i], [x1, y1] = L.scattered[a], [x2, y2] = L.scattered[b];
      return { type: 'circle', cx: round((x1 + x2) / 2), cy: round((y1 + y2) / 2), r: 14, fill: 'negative', loop: { type: 'pulse', period: 0.9 }, enter: 'pop', at: 0.3 + i * 0.1, dur: 0.3, exit: 'fade', exitCue: 'UNTANGLE', exitAt: AT.UNTANGLE, exitDur: 0.4 };
    });
    const line = L.aligned.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ');
    const [tx, ty] = L.tags;
    return {
      elements: [
        // The tangle lets go as the cards move.
        { type: 'path', d: curves.join(' '), fill: 'none', stroke: 'muted', width: 4, opacity: 0.8, enter: 'none', at: 0, exit: 'fade', exitCue: 'UNTANGLE', exitAt: AT.UNTANGLE, exitDur: 0.5 },
        ...friction,
        // The clean line, under the cards.
        { type: 'path', d: line, fill: 'none', stroke: 'accent', width: 8, cap: 'round', enter: 'draw', cue: 'FLOW', at: AT.FLOW, dur: 1 },
        // The cards: scattered and turned, then each glides into its place in order.
        ...L.aligned.map(([x, y], i) => {
          const [sx, sy] = L.scattered[i];
          return {
            type: 'group', enter: 'none', at: 0, origin: [x, y],
            keys: [
              { at: 0, x: sx - x, y: sy - y, rotate: (i % 2 ? 9 : -7) + i, dur: 0 },
              { cue: 'UNTANGLE', at: AT.UNTANGLE, x: 0, y: 0, rotate: 0, dur: round(0.8 + i * 0.1), ease: 'inOut' },
            ],
            children: [
              { type: 'rect', x: x - cw / 2, y: y - ch / 2, w: cw, h: ch, r: 18, fill: FILLS[i], stroke: 'ink', width: 3, shadow: { dx: 0, dy: 6, blur: 14, opacity: 0.18 } },
              { type: 'icon', name: ICONS[i], x, y, size: L.icon, fill: i === 5 ? 'bg' : 'ink' },
            ],
          };
        }),
        // The work that flows along the line, over the cards.
        { type: 'circle', cx: L.aligned[0][0], cy: L.aligned[0][1], r: 16, fill: 'accent2', stroke: 'bg', width: 4, enter: 'pop', cue: 'FLOW', at: AT.FLOW + 0.8, dur: 0.2, along: { d: line, cue: 'FLOW', at: AT.FLOW + 0.8, dur: 2.4, ease: 'inOut', loop: true } },
        { type: 'text', text: 'BEFORE', x: tx, y: ty, size: L.size, font: 'semibold', fill: 'muted', upper: true, tracking: 0.08, enter: 'fade', at: 0.2, exit: 'fade', exitCue: 'UNTANGLE', exitAt: AT.UNTANGLE, exitDur: 0.4 },
        { type: 'text', text: 'AFTER', x: tx, y: ty, size: L.size, font: 'semibold', fill: 'accent', upper: true, tracking: 0.08, enter: 'fade', cue: 'FLOW', at: AT.FLOW, dur: 0.5 },
      ],
    };
  },
};
