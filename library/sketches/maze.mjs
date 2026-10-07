import { tall, round, rng } from '../../film/sketch-kit.mjs';

// Finding the way: a maze (generated from the seed, so the same seed always draws the same maze)
// with a person at the entrance and a check at the exit. On GUIDE the one path through draws on
// in the accent and a token follows it; on ARRIVE the exit lights. Complexity you no longer have
// to navigate alone.
const AT = { GUIDE: 1.4, ARRIVE: 4.6 };

// A perfect maze by depth-first search on a cols × rows grid; returns the open walls and the
// path from the top-left cell to the bottom-right one.
function carve(cols, rows, rand) {
  const open = new Set(), seen = new Set(['0,0']), stack = [[0, 0]], parent = new Map();
  const key = (c, r) => `${c},${r}`;
  while (stack.length) {
    const [c, r] = stack.at(-1);
    const next = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) => [c + dc, r + dr]).filter(([nc, nr]) => nc >= 0 && nr >= 0 && nc < cols && nr < rows && !seen.has(key(nc, nr)));
    if (!next.length) { stack.pop(); continue; }
    const [nc, nr] = next[Math.floor(rand() * next.length)];
    open.add([key(c, r), key(nc, nr)].sort().join('|'));
    seen.add(key(nc, nr));
    parent.set(key(nc, nr), [c, r]);
    stack.push([nc, nr]);
  }
  const path = [[cols - 1, rows - 1]];
  while (path.at(-1)[0] || path.at(-1)[1]) path.push(parent.get(key(...path.at(-1))));
  return { isOpen: (a, b) => open.has([key(...a), key(...b)].sort().join('|')), path: path.reverse() };
}

export default {
  name: 'maze',
  order: 77,
  summary:
    'Finding the way: a maze with a person at the entrance and a check at the exit; the one path through draws on in the accent, a token follows it, and the exit lights.',
  use: 'Guidance through complexity: onboarding, "we find the way for you", navigating rules or a process, a clear route through a confusing system. Calm and clarifying; works on light and dark palettes; seed changes the maze. Replace START and FINISH with sketchText; land GUIDE and ARRIVE on words with sketchSay.',
  build(w, h, { seed } = {}) {
    const T = tall(w, h);
    // Sized so the labels stay inside the title-safe middle 80% of the frame.
    const cols = T ? 8 : 15, rows = T ? 12 : 7, cell = T ? 96 : 92;
    const x0 = round((w - cols * cell) / 2), y0 = round(T ? 420 : (h - rows * cell) / 2 + 20);
    const m = carve(cols, rows, rng(seed ?? 11));
    const X = c => x0 + c * cell, Y = r => y0 + r * cell;
    // Walls: every cell edge that is not opened, with gaps for the entrance and the exit.
    const walls = [];
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) {
        if (c + 1 < cols && !m.isOpen([c, r], [c + 1, r])) walls.push(`M ${X(c + 1)} ${Y(r)} L ${X(c + 1)} ${Y(r + 1)}`);
        if (r + 1 < rows && !m.isOpen([c, r], [c, r + 1])) walls.push(`M ${X(c)} ${Y(r + 1)} L ${X(c + 1)} ${Y(r + 1)}`);
      }
    walls.push(`M ${X(0)} ${Y(1)} L ${X(0)} ${Y(rows)} L ${X(cols)} ${Y(rows)}`, `M ${X(0)} ${Y(0)} L ${X(cols)} ${Y(0)} L ${X(cols)} ${Y(rows - 1)}`);
    const mid = ([c, r]) => [X(c) + cell / 2, Y(r) + cell / 2];
    const pts = [[X(0) - cell * 0.6, Y(0) + cell / 2], ...m.path.map(mid), [X(cols) + cell * 0.6, Y(rows - 1) + cell / 2]];
    const route = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${round(x)} ${round(y)}`).join(' ');
    const len = pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
    const end = pts.at(-1), start = pts[0];
    const badge = ([x, y], icon, fill, extra) => ({ type: 'group', ...extra, children: [
      { type: 'circle', cx: x, cy: y, r: round(cell * 0.42), fill, stroke: 'ink', width: 4 },
      { type: 'icon', name: icon, x, y, size: round(cell * 0.45), fill: fill === 'accent' ? 'bg' : 'ink' },
    ] });
    const size = T ? 44 : 40;
    return {
      elements: [
        { type: 'path', d: walls.join(' '), fill: 'none', stroke: 'muted', width: 8, cap: 'square', enter: 'draw', at: 0, dur: 1 },
        { type: 'path', d: route, fill: 'none', stroke: 'accent', width: 12, cap: 'round', join: 'round', enter: 'draw', cue: 'GUIDE', at: AT.GUIDE, dur: round(Math.min(3, len / 900)) },
        badge(start, 'user', 'surface', { enter: 'pop', at: 0.4, dur: 0.3 }),
        badge(end, 'check', 'surface', { enter: 'pop', at: 0.5, dur: 0.3 }),
        badge(end, 'check', 'accent', { enter: 'pop', cue: 'ARRIVE', at: AT.ARRIVE, dur: 0.35 }),
        { type: 'circle', cx: start[0], cy: start[1], r: 16, fill: 'accent2', stroke: 'bg', width: 4, enter: 'pop', cue: 'GUIDE', at: AT.GUIDE, dur: 0.2,
          along: { d: route, cue: 'GUIDE', at: AT.GUIDE, dur: round(Math.min(3, len / 900)), ease: 'linear' }, exit: 'fade', exitCue: 'ARRIVE', exitAt: AT.ARRIVE, exitDur: 0.3 },
        { type: 'text', text: 'START', x: X(0), y: Y(0) - 30, size, font: 'semibold', fill: 'ink', enter: 'fade', at: 0.5, dur: 0.4 },
        { type: 'text', text: 'FINISH', x: X(cols), y: Y(rows) + size + 18, size, font: 'semibold', fill: 'ink', anchor: 'end', enter: 'fade', at: 0.6, dur: 0.4 },
      ],
    };
  },
};
