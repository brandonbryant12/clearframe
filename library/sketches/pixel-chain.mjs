import { tall, round } from '../../film/sketch-kit.mjs';

// One action sets off a chain, in a handheld game level: a player steps onto a pressure plate,
// a signal runs cell by cell along a buried wire and up a gate post, the gate drops, crates roll
// through it and down the level to a machine, and the machine's screen lights with the result.
// Cause and effect stay in space: each link is where the last one ends. Every shape is laid in
// LCD cells on one 30 px grid; moving things step at 8 fps. Its moments are named cues (PRESS,
// SIGNAL, OPEN, ROLL, RESULT) for a beat's sketchSay.
const C = 30;
const PX = { style: 'pixel', tile: 27, gap: 3 };
const AT = { PRESS: 0.6, SIGNAL: 1.3, OPEN: 2.4, ROLL: 3.0, RESULT: 5.6 };

// Levels in cells. Landscape (64 × 36): a high platform, stairs down to the right, the machine
// on the floor. Vertical (36 × 64): a ledge, a drop down the shaft beside it, the machine on the
// floor beneath the ledge.
function level(w, h) {
  if (tall(w, h))
    return {
      bar: 9,
      ground: [[0, 26, 26, 8], [0, 52, 36, 12]],
      player: [1, 20], step: 5, plate: [6, 25, 4],
      wire: [[10, 27, 10, 1], [19, 19, 1, 8]],
      gate: { x: 19, top: 18, bottom: 26, width: 5 },
      crates: [11, 15].map(x => [x, 23]),
      route: (cx, cy, i) => [[cx, cy], [27.5, cy], [27.5, 50.5], [15.5 + 3 * i, 50.5]],
      machine: { x: 2, y: 38, w: 12, h: 14, screen: [3, 40, 10, 6], intake: 10 },
      smoke: false,
    };
  const stairs = [0, 1, 2, 3].map(k => [34 + 2 * k, 22 + 2 * k, 2, 14]);
  return {
    bar: 6,
    ground: [[0, 20, 34, 16], ...stairs, [42, 30, 22, 6]],
    player: [1, 14], step: 6, plate: [7, 19, 4],
    wire: [[11, 21, 14, 1], [24, 11, 1, 10]],
    gate: { x: 24, top: 10, bottom: 20, width: 5 },
    crates: [12, 16, 20].map(x => [x, 17]),
    route: (cx, cy, i) => {
      const pts = [[cx, cy], [35.5, cy]];
      for (let k = 0; k < 5; k++) pts.push([35.5 + 2 * (k + 1), cy + 2 * k], [35.5 + 2 * (k + 1), cy + 2 * (k + 1)]);
      return [...pts, [49.5 - 3 * i, 28.5]];
    },
    machine: { x: 51, y: 18, w: 10, h: 12, screen: [52, 20, 8, 5], intake: 0 },
    smoke: true,
  };
}

// A block of cells as one pixel mosaic, or, for the smallest shapes, as single inset squares
// (a mosaic needs a few tiles to read).
const cells = (x, y, cw, ch, fill, extra = {}) =>
  cw * ch > 8 && Math.min(cw, ch) > 1
    ? { type: 'rect', x: x * C, y: y * C, w: cw * C, h: ch * C, fill, mosaic: { ...PX, outline: false }, ...extra }
    : {
        type: 'group', ...extra,
        children: Array.from({ length: cw * ch }, (_, i) => ({ type: 'rect', x: (x + (i % cw)) * C + PX.gap / 2, y: (y + Math.floor(i / cw)) * C + PX.gap / 2, w: PX.tile, h: PX.tile, fill })),
      };
const length = pts => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

export default {
  name: 'pixel-chain',
  order: 70,
  summary:
    'A game level of cause and effect: a player steps on a plate, a signal runs along a buried wire, a gate drops, crates roll down the level into a machine, and its screen lights with the result.',
  use: 'One action that sets off the rest: automation, a trigger and its effects, a deploy or release pipeline, "press one button and…". Playful and mechanical; pairs with the lcd palette and the handheld treatment. Replace TITLE (the status bar) and RESULT (the machine screen) with sketchText; land PRESS, SIGNAL, OPEN, ROLL and RESULT on words with sketchSay (cue all five, or none).',
  build(w, h) {
    const L = level(w, h);
    const [px, py] = L.player,
      [plx, ply, plw] = L.plate,
      g = L.gate,
      m = L.machine,
      [sx, sy, sw, sh] = m.screen;
    // The signal: one cell at a time along the wire, then up the gate post.
    const signal = L.wire.flatMap(([x, y, cw, ch]) =>
      cw >= ch ? Array.from({ length: cw }, (_, i) => [x + i, y]) : Array.from({ length: ch }, (_, i) => [x, y + ch - 1 - i]),
    );
    const routes = L.crates.map(([x, y], i) => L.route(x + 1.5, y + 1.5, L.crates.length - 1 - i));
    const square = ([x, y]) => ({ type: 'rect', x: x * C + PX.gap / 2, y: y * C + PX.gap / 2, w: PX.tile, h: PX.tile, fill: 'bg', enter: 'pop', dur: 0.08 });
    return {
      elements: [
        // The gate drops into the ground on its cue: it is drawn first, so the ground covers it.
        cells(g.x + 1, g.top + 1, g.width - 2, g.bottom - g.top - 1, 'muted', { enter: 'none', at: 0, fps: 8, keys: [{ cue: 'OPEN', at: AT.OPEN, y: (g.bottom - g.top) * C, dur: 0.6, ease: 'in' }] }),
        // The level: ground, the buried wire (dark until lit) and the gate frame.
        ...L.ground.map(([x, y, cw, ch]) => cells(x, y, cw, ch, 'accent2', { enter: 'none', at: 0 })),
        ...L.wire.map(([x, y, cw, ch]) => ({ type: 'group', enter: 'none', at: 0, children: Array.from({ length: cw * ch }, (_, i) => ({ ...square(cw >= ch ? [x + i, y] : [x, y + i]), fill: 'ink', enter: 'none' })) })),
        cells(g.x + g.width - 1, g.top, 1, g.bottom - g.top, 'ink', { enter: 'none', at: 0 }),
        cells(g.x, g.top, g.width, 1, 'ink', { enter: 'none', at: 0 }),
        { type: 'group', enter: 'none', cue: 'SIGNAL', at: AT.SIGNAL, stagger: round(1 / signal.length), children: signal.map(square) },
        // The crates wait behind the gate, then roll the whole route to the machine.
        ...L.crates.map(([x, y], i) => ({
          type: 'rect', x: x * C, y: y * C, w: 3 * C, h: 3 * C, fill: 'bg', stroke: 'ink', mosaic: { ...PX, outline: true },
          enter: 'none', at: 0, fps: 8,
          along: { d: routes[i].map(([ax, ay], j) => `${j ? 'L' : 'M'} ${ax * C} ${ay * C}`).join(' '), cue: 'ROLL', at: AT.ROLL, dur: round(length(routes[i]) / 14), ease: 'inOut' },
        })),
        // The plate sinks as the player steps onto it.
        cells(plx, ply, plw, 1, 'bg', { enter: 'none', at: 0, fps: 8, keys: [{ cue: 'PRESS', at: AT.PRESS, y: C, dur: 0.6, ease: 'in' }] }),
        {
          type: 'group', enter: 'none', at: 0, fps: 8, loop: { type: 'float', period: 0.5, amount: C / 3 },
          keys: [{ cue: 'PRESS', at: AT.PRESS, x: L.step * C, dur: 0.6, ease: 'linear' }],
          children: [cells(px + 1, py, 2, 2, 'ink'), cells(px, py + 2, 4, 2, 'accent2'), cells(px, py + 4, 1, 2, 'ink'), cells(px + 3, py + 4, 1, 2, 'ink')],
        },
        // The machine: dark until the crates arrive, then its screen lights with the result.
        cells(m.x, m.y, m.w, m.h, 'ink', { enter: 'none', at: 0 }),
        cells(m.x + m.intake, m.y + m.h - 4, 2, 4, 'bg', { enter: 'none', at: 0 }),
        cells(sx, sy, sw, sh, 'muted', { enter: 'none', at: 0 }),
        cells(sx, sy, sw, sh, 'bg', { enter: 'pop', cue: 'RESULT', at: AT.RESULT, dur: 0.3 }),
        { type: 'text', text: 'RESULT', x: (sx + sw / 2) * C, y: (sy + sh / 2) * C + 20, size: 56, font: 'mono', fill: 'ink', anchor: 'middle', upper: true, fit: (sw - 1) * C, enter: 'type', cue: 'RESULT', at: AT.RESULT },
        cells(m.x + m.w / 2 - 1, m.y - 2, 2, 2, 'bg', { enter: 'pop', cue: 'RESULT', at: AT.RESULT, dur: 0.2, loop: { type: 'blink', period: 0.6 } }),
        ...(L.smoke
          ? [
              cells(m.x + m.w - 3, m.y - 4, 2, 4, 'ink', { enter: 'none', at: 0 }),
              { type: 'group', enter: 'none', cue: 'RESULT', at: AT.RESULT, stagger: 0.25, children: [[-2.5, -7], [-1, -9], [1, -11]].map(([dx, dy]) => cells(m.x + m.w + dx, m.y + dy, 2, 2, 'surface', { enter: 'pop', dur: 0.2, loop: { type: 'float', period: 1.2, amount: C / 2 } })) },
            ]
          : []),
        // The status bar of the handheld.
        { type: 'rect', x: 0, y: 0, w, h: L.bar * C, fill: 'surface', enter: 'none', at: 0 },
        { type: 'text', text: 'TITLE', x: round(w * 0.12), y: L.bar * C - 36, size: 44, font: 'mono', fill: 'ink', upper: true, fit: round(w * 0.76), enter: 'type', at: 0.2 },
      ],
    };
  },
};
