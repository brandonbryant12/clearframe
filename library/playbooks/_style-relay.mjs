// Generates style-relay.json (run from the repository root: node library/playbooks/_style-relay.mjs).
// One subject (a sun over the sea) drawn six ways on one sheet of plates, after "Superman in
// Flight": the film opens on the whole sheet, travels plate to plate in one camera (each plate
// a different making: tesserae, woodblock, cross-stitch, letterpress, newsprint, LCD pixels)
// while a bird crosses each plate in that plate's process, and closes on the sheet again.
// The plates are laid in two rows walked as a snake, so the camera never re-crosses a plate.
import fs from 'node:fs';

const r = v => Math.round(v * 10) / 10;
const S = 800, // plate size
  PX = 1300, // column pitch: a sliver of each neighbour shows, never its caption
  PY = 1240; // row pitch (plate, caption, gap)
const view = (cx, cy, w) => [r(cx - w / 2), r(cy - (w * 9) / 32), r(w), r((w * 9) / 16)];
const origin = k => {
  const row = Math.floor(k / 3),
    col = row === 0 ? k % 3 : 2 - (k % 3);
  return [col * PX, row * PY];
};
const hold = { at: 0, dur: 0, enter: 'none' };

// Plate art in plate-local units (0–800): the same sun and sea, made six ways.
const sea = (y = 470) => `M 0 ${y} C 120 ${y - 34} 220 ${y + 30} 340 ${y} C 460 ${y - 30} 560 ${y + 34} 680 ${y} C 740 ${y - 16} 780 ${y - 10} 800 ${y} L 800 800 L 0 800 Z`;
const sun = { type: 'circle', cx: 520, cy: 290, r: 128 };
const PLATES = [
  {
    name: 'Tesserae',
    when: 'Rome, c. 79 AD',
    art: [
      { type: 'rect', x: 0, y: 0, w: S, h: 470, fill: { gradient: ['surface', 'bg'] }, mosaic: { tile: 20, glint: 0.15 } },
      { ...sun, fill: 'accent', mosaic: { tile: 18, glint: 0.4 }, glow: { blur: 30, opacity: 0.35 } },
      { type: 'rect', x: 0, y: 470, w: S, h: 330, fill: { gradient: ['accent2', 'ink'] }, mosaic: { tile: 20, glint: 0.3 } },
    ],
    bird: { stroke: 'ink', width: 12, mosaic: { tile: 10 } },
  },
  {
    name: 'Woodblock',
    when: 'Edo, 1830s',
    art: [
      { type: 'rect', x: 0, y: 0, w: S, h: S, fill: 'bg' },
      { type: 'rect', x: 0, y: 0, w: S, h: 260, fill: { gradient: ['accent2', 'bg'] } },
      { ...sun, fill: 'accent', stroke: 'ink', width: 3 },
      { type: 'path', d: sea(), fill: 'accent2', stroke: 'ink', width: 3, print: { screen: 'lines', ink: 'bg', tone: [0.42, 0.18], angle: -8, cell: 8 } },
    ],
    bird: { stroke: 'ink', width: 5 },
  },
  {
    name: 'Cross-stitch',
    when: 'A sampler, 1840s',
    art: [
      { type: 'rect', x: 0, y: 0, w: S, h: S, fill: 'surface' },
      { ...sun, fill: 'accent', mosaic: { style: 'stitch', tile: 20 } },
      { type: 'rect', x: 40, y: 480, w: 720, h: 280, fill: 'accent2', mosaic: { style: 'stitch', tile: 20 } },
      { type: 'rect', x: 20, y: 20, w: 760, h: 760, fill: 'none', stroke: 'ink', width: 6, mosaic: { style: 'stitch', tile: 20 } },
    ],
    bird: { stroke: 'ink', width: 8, mosaic: { style: 'stitch', tile: 14 } },
  },
  {
    name: 'Letterpress',
    when: 'A two-ink bill, 1890s',
    art: [
      { type: 'rect', x: 0, y: 0, w: S, h: S, fill: 'bg' },
      { ...sun, fill: 'accent', print: 'letterpress' },
      ...[500, 580, 650, 710, 760].map((y, i) => ({ type: 'rect', x: 0, y, w: S, h: 34 - i * 4, fill: 'ink', print: { register: [0, 0], wear: 0.4 } })),
    ],
    bird: { stroke: 'ink', width: 8, print: { wear: 0.4 } },
  },
  {
    name: 'Newsprint',
    when: 'A comic cover, 1938',
    art: [
      { type: 'rect', x: 0, y: 0, w: S, h: S, fill: 'bg', print: { screen: 'dots', ink: 'accent2', tone: [0.08, 0.36], cell: 11, angle: 15 } },
      { ...sun, fill: 'accent', stroke: 'ink', width: 6, print: 'newsprint' },
      { type: 'path', d: sea(), fill: 'accent2', stroke: 'ink', width: 6, print: 'newsprint' },
    ],
    bird: { stroke: 'ink', width: 7 },
  },
  {
    name: 'LCD pixels',
    when: 'A handheld screen, 1989',
    art: [
      { type: 'rect', x: 0, y: 0, w: S, h: S, fill: 'surface' },
      { ...sun, fill: 'accent', mosaic: { style: 'pixel', tile: 22, gap: 3 } },
      { type: 'rect', x: 0, y: 475, w: S, h: 325, fill: 'accent2', mosaic: { style: 'pixel', tile: 22, gap: 3 } },
      { type: 'line', x1: 0, y1: 462, x2: S, y2: 462, stroke: 'ink', width: 6, mosaic: { style: 'pixel', tile: 22, gap: 3 } },
    ],
    bird: { stroke: 'ink', width: 10, mosaic: { style: 'pixel', tile: 12, gap: 2 } },
  },
];

// One plate on the sheet, there from the first frame: frame, art and its number. The caption
// arrives with the camera (see `caption`), so the sheet opens as pictures, not a page of words.
const plate = (p, k) => {
  const [x, y] = origin(k);
  return {
    type: 'group',
    x,
    y,
    ...hold,
    children: [
      { type: 'rect', x: 0, y: 0, w: S, h: S, fill: 'bg', shadow: { dy: 14, blur: 26, opacity: 0.18 }, ...hold },
      ...p.art.map(e => ({ ...e, ...hold })),
      { type: 'rect', x: 0, y: 0, w: S, h: S, fill: 'none', stroke: 'line', width: 2, ...hold },
      { type: 'text', text: String(k + 1).padStart(2, '0'), x: S / 2, y: S + 96, size: 72, font: 'serif-italic', anchor: 'middle', fill: 'accent', ...hold },
    ],
  };
};
// The catalogue line under plate k: the making in tracked caps, then where and when.
const caption = (k, at) => {
  const [x, y] = origin(k);
  const p = PLATES[k];
  return [
    { type: 'text', text: p.name, x: x + S / 2, y: y + S + 150, size: 30, font: 'semibold', tracking: 0.22, upper: true, anchor: 'middle', fill: 'ink', at, enter: 'rise', dur: 0.5 },
    { type: 'text', text: p.when, x: x + S / 2, y: y + S + 198, size: 36, font: 'serif-italic', anchor: 'middle', fill: 'muted', at: at + 0.15, enter: 'rise', dur: 0.5 },
  ];
};

// A bird crossing plate k in that plate's own making, gone before the camera leaves.
const bird = k => {
  const [x, y] = origin(k);
  const b = PLATES[k].bird;
  return {
    type: 'path',
    d: `M ${x + 30} ${y + 170} q 22 -24 44 0 q 22 -24 44 0`,
    fill: 'none',
    cap: 'round',
    ...b,
    at: 0.3,
    enter: 'fade',
    dur: 0.3,
    keys: [{ at: 0.3, x: 560, y: -40, dur: 3.2, ease: 'linear', hold: false }],
    loop: { type: 'float', period: 0.9, amount: 10 },
    exitAt: 3.3,
    exit: 'fade',
    exitDur: 0.3,
  };
};

const VO = [
  'In Rome, it was set in stone: thousands of tesserae, each one cut by hand.',
  'But in Edo, a carver cut the sea into lines, and the printer wiped blue into the sky.',
  'In the 1840s, a schoolgirl worked it on linen, one cross-stitch at a time.',
  'Then came the press, so by the 1890s it was two inks, never quite in register.',
  'In 1938 it reached the newsstand, its sky a field of dots.',
  'And by 1989, it fit on a screen four shades deep.',
];

const sheetW = 2 * PX + S, // 3400
  sheetH = PY + S + 220; // 2260
// The whole sheet with its title above and the closing line below, inside the title-safe area.
const whole = view(sheetW / 2, 1000, 6000);
const W = (id, vo, v, elements, extra = {}, props = {}) => ({
  id,
  block: 'canvas',
  vo,
  ...extra,
  props: { world: 'plates', view: v, elements, ...props },
});

const title = [
  { type: 'text', text: 'One sun, six makings', x: sheetW / 2, y: -260, size: 220, font: 'serif-display', anchor: 'middle', fill: 'ink', at: 0, enter: 'rise', dur: 0.8 },
  { type: 'text', text: 'From the mosaic floor to the pocket screen', x: sheetW / 2, y: -115, size: 84, font: 'serif-italic', anchor: 'middle', fill: 'muted', at: 0.3, enter: 'fade', dur: 0.8 },
  { type: 'rect', x: sheetW / 2 - 260, y: -56, w: 520, h: 6, fill: 'accent', at: 0.5, enter: 'grow-x', dur: 0.6 },
];

const book = {
  order: 35,
  title: 'A style relay: one subject on a sheet of plates, each made a different way, travelled by one camera',
  audience: 'Histories of a medium or an idea, comparisons across eras or styles, collections and catalogues',
  inputs:
    'One subject that survives every version, four to eight eras or processes in order, and one line for each about how it was made',
  theme: 'gallery',
  motion: 'gentle',
  backdrop: 'paper',
  transition: 'cut',
  sfx: 'subtle',
  texture: { grain: 0.2, vignette: 0.25 },
  note: 'One sheet of plates, travelled as a world (library/playbooks/_style-relay.mjs). Keep the subject constant and change only the making: print presets (benday, engraving, newsprint, letterpress, halftone), mosaic styles (tesserae, pixel, stitch), materials, rough. Plates are equal and beats near-equal, so set the music so each plate is a bar and the camera crosses each border on a downbeat. Replace the subject, eras and lines with your own; keep dates you can stand behind.',
  beats: [
    W(
      'sheet',
      'One sun over one sea, made six ways across two thousand years. So what changes when only the making does?',
      whole,
      [...PLATES.map(plate), ...title],
      { hold: 0.6 },
      { viewFrom: view(sheetW / 2, 1000, 6600), viewAt: 0, viewDur: 4, viewDrift: 0.02 },
    ),
    ...PLATES.map((p, k) => {
      const [x, y] = origin(k);
      return W(`plate-${k + 1}`, VO[k], view(x + S / 2, y + 545, 2100), [...caption(k, 0.5), bird(k)], { hold: 0.4 }, { viewDur: 1.1, viewDrift: 0.03 });
    }),
    W(
      'whole',
      'Same sun, same sea. Only the making changed, and that is the whole story.',
      whole,
      [{ type: 'text', text: 'Only the making changed.', x: sheetW / 2, y: sheetH + 170, size: 120, font: 'serif-italic', anchor: 'middle', fill: 'accent', at: 1.2, enter: 'rise', dur: 0.8 }],
      { hold: 1 },
      { viewAt: 0, viewDur: 2.4, viewDrift: 0 },
    ),
  ],
};
fs.writeFileSync('library/playbooks/style-relay.json', JSON.stringify(book, null, 2) + '\n');
