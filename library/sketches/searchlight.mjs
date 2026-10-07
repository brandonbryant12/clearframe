import { tall, round, rng } from '../../film/sketch-kit.mjs';

// A dark storeroom searched by one light: shelves of silhouetted boxes, and a torch beam that
// finds three things in turn (a crate, a stack of files, a machine with a blinking light). Each
// is labelled as it is found, and the labels stay. Then the lamps come on, the whole room shows,
// and a thread joins the three finds: they were one story. The light's moves are named cues
// (FIRST, SECOND, THIRD, ALL), so a beat's sketchSay lands each on a spoken word.
const AT = { FIRST: 0.8, SECOND: 2.3, THIRD: 3.8, ALL: 5.4 };

function layout(w, h) {
  if (tall(w, h)) {
    const boards = [380, 620, 860, 1100, 1340, 1560].map(y => round((y * h) / 1920));
    return {
      floor: boards.at(-1),
      units: [80, 560].map(x => ({ x: round((x * w) / 1080), w: round((440 * w) / 1080), boards })),
      finds: [
        { unit: 0, board: 1, cx: round((300 * w) / 1080) },
        { unit: 1, board: 3, cx: round((780 * w) / 1080) },
        { unit: 0, board: 4, cx: round((300 * w) / 1080) },
      ],
      lamps: [300, 780].map(x => round((x * w) / 1080)),
      start: [round(w * 0.72), round(h * 0.9)],
    };
  }
  const boards = [180, 340, 510, 680, 880].map(y => round((y * h) / 1080));
  return {
    floor: boards.at(-1),
    units: [150, 740, 1330].map(x => ({ x: round((x * w) / 1920), w: round((440 * w) / 1920), boards })),
    finds: [
      { unit: 0, board: 2, cx: round((370 * w) / 1920) },
      { unit: 1, board: 3, cx: round((960 * w) / 1920) },
      { unit: 2, board: 1, cx: round((1550 * w) / 1920) },
    ],
    lamps: [370, 960, 1550].map(x => round((x * w) / 1920)),
    start: [round(w * 0.5), round(h * 0.93)],
  };
}

// The three finds, drawn standing on a board at y = b, centred on cx.
const FINDS = [
  (cx, b) => [
    { type: 'rect', x: cx - 95, y: b - 124, w: 190, h: 124, r: 6, fill: 'accent', stroke: 'ink', width: 4 },
    { type: 'line', x1: cx - 88, y1: b - 84, x2: cx + 88, y2: b - 84, stroke: 'bg', width: 7 },
    { type: 'line', x1: cx - 88, y1: b - 44, x2: cx + 88, y2: b - 44, stroke: 'bg', width: 7 },
    { type: 'rect', x: cx + 36, y: b - 112, w: 46, h: 26, r: 4, fill: 'accent2' },
  ],
  (cx, b) => [
    ...[0, 1, 2, 3].map(i => ({ type: 'rect', x: cx - 88 + (i % 2 ? 10 : -4), y: b - 30 - i * 30, w: 176, h: 28, r: 4, fill: i === 3 ? 'accent2' : 'surface', stroke: 'ink', width: 3 })),
    { type: 'rect', x: cx - 70, y: b - 136, w: 54, h: 16, r: 3, fill: 'accent2', stroke: 'ink', width: 3 },
  ],
  (cx, b) => [
    { type: 'rect', x: cx - 90, y: b - 140, w: 180, h: 140, r: 12, fill: 'muted', stroke: 'ink', width: 4 },
    { type: 'circle', cx: cx - 26, cy: b - 72, r: 34, fill: 'bg', stroke: 'ink', width: 4 },
    { type: 'line', x1: cx - 26, y1: b - 72, x2: cx - 6, y2: b - 96, stroke: 'accent2', width: 5 },
    { type: 'rect', x: cx + 30, y: b - 110, w: 40, h: 14, r: 3, fill: 'bg' },
    { type: 'rect', x: cx + 30, y: b - 84, w: 40, h: 14, r: 3, fill: 'bg' },
    { type: 'circle', cx: cx + 50, cy: b - 40, r: 10, fill: 'positive', glow: true, loop: { type: 'blink', period: 0.9 } },
  ],
];
const LABELS = ['FIRST', 'SECOND', 'THIRD'];

export default {
  name: 'searchlight',
  order: 69,
  summary:
    'A dark storeroom searched by one torch: the light finds three things on the shelves in turn, each labelled as it is found, then the lamps come on and a thread joins them.',
  use: 'Discovery and investigation: what nobody had looked at, finding the cause, an audit, "three things were hiding". Feels like a quiet detective story; best on a dark palette (noir, ink, midnight). Replace FIRST, SECOND and THIRD with sketchText; land the light with sketchSay cues FIRST, SECOND, THIRD and ALL (the lights come up).',
  build(w, h, { seed } = {}) {
    const L = layout(w, h),
      rand = rng(seed ?? 7),
      boardH = 12,
      size = tall(w, h) ? 44 : 38;
    const finds = L.finds.map(f => ({ ...f, x: f.cx, b: L.units[f.unit].boards[f.board] }));
    // Clutter: boxes on every board, left to right, leaving room for a find.
    const clutter = [];
    for (const [u, unit] of L.units.entries())
      unit.boards.slice(1).forEach((b, i) => {
        const gap = b - unit.boards[i];
        let x = unit.x + 18 + rand() * 20;
        while (x < unit.x + unit.w - 60) {
          const bw = round(40 + rand() * 70),
            bh = round(gap * (0.35 + rand() * 0.4));
          const clear = finds.every(f => f.unit !== u || f.b !== b || x + bw < f.x - 110 || x > f.x + 110);
          if (clear && x + bw < unit.x + unit.w - 16)
            clutter.push({ type: 'rect', x: round(x), y: b - bh, w: bw, h: bh, r: 3, fill: rand() < 0.5 ? 'surface' : 'muted' });
          x += bw + 8 + rand() * 22;
        }
      });
    const shelves = L.units.flatMap(unit => [
      { type: 'rect', x: unit.x, y: unit.boards[0], w: 14, h: L.floor - unit.boards[0], fill: 'muted' },
      { type: 'rect', x: unit.x + unit.w - 14, y: unit.boards[0], w: 14, h: L.floor - unit.boards[0], fill: 'muted' },
      ...unit.boards.map(b => ({ type: 'rect', x: unit.x, y: b, w: unit.w, h: boardH, fill: 'muted' })),
    ]);
    // The torch: a pool of light that leaves the room dark around it, carried find to find.
    const [sx, sy] = L.start,
      r = round(Math.min(w, h) * 0.17);
    const moves = finds.map((f, i) => ({ cue: LABELS[i], at: AT[LABELS[i]], x: f.x - sx, y: f.b - 70 - sy, dur: 0.7, ease: 'inOut' }));
    const thread = finds.map((f, i) => `${i ? 'L' : 'M'} ${f.x} ${f.b - 60}`).join(' ');
    return {
      elements: [
        { type: 'rect', x: 0, y: L.floor, w, h: h - L.floor, fill: 'surface', opacity: 0.55, enter: 'none', at: 0 },
        { type: 'group', enter: 'none', at: 0, children: [...shelves, ...clutter] },
        // The thread runs behind the finds, from one to the next, once the room is lit.
        { type: 'path', d: thread, fill: 'none', stroke: 'accent2', width: 6, dash: [16, 12], enter: 'draw', cue: 'ALL', at: AT.ALL + 0.3, dur: 1.2 },
        ...finds.map((f, i) => ({ type: 'group', id: `find-${i + 1}`, enter: 'none', at: 0, children: FINDS[i](f.x, f.b) })),
        // Lamps hang dark until the room is lit.
        ...L.lamps.flatMap(x => [
          { type: 'line', x1: x, y1: 0, x2: x, y2: round(L.units[0].boards[0] * 0.45), stroke: 'muted', width: 3, enter: 'none', at: 0 },
          { type: 'path', d: `M ${x - 34} ${round(L.units[0].boards[0] * 0.45) + 34} L ${x - 14} ${round(L.units[0].boards[0] * 0.45)} L ${x + 14} ${round(L.units[0].boards[0] * 0.45)} L ${x + 34} ${round(L.units[0].boards[0] * 0.45) + 34} Z`, fill: 'muted', enter: 'none', at: 0 },
          { type: 'circle', cx: x, cy: round(L.units[0].boards[0] * 0.45) + 40, r: 12, fill: 'accent2', glow: { blur: 30, opacity: 0.9 }, enter: 'fade', cue: 'ALL', at: AT.ALL, dur: 0.5 },
        ]),
        {
          type: 'spotlight', cx: sx, cy: sy, r, dim: 0.86, enter: 'none', at: 0,
          keys: moves, exit: 'fade', exitCue: 'ALL', exitAt: AT.ALL, exitDur: 0.8,
        },
        // Warm light in the pool, riding with it.
        {
          type: 'circle', cx: sx, cy: sy, r: round(r * 1.05), fill: { gradient: ['accent2', 'accent2'], radial: true, fade: true }, opacity: 0.22, blend: 'screen', enter: 'none', at: 0,
          keys: moves, exit: 'fade', exitCue: 'ALL', exitAt: AT.ALL, exitDur: 0.8,
        },
        // Each find keeps its label once found, fading in as the light arrives.
        ...finds.flatMap((f, i) => [
          { type: 'rect', x: f.x - 160, y: f.b + 24, w: 320, h: size + 30, r: 10, fill: 'bg', opacity: 0.9, enter: 'fade', cue: LABELS[i], at: AT[LABELS[i]], dur: 0.8 },
          { type: 'text', text: LABELS[i], x: f.x, y: f.b + 24 + round(size * 1.05), size, font: 'semibold', fill: 'ink', anchor: 'middle', fit: 296, enter: 'fade', cue: LABELS[i], at: AT[LABELS[i]], dur: 0.8 },
        ]),
      ],
    };
  },
};
