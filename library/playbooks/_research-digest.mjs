// Generates research-digest.json (run from the repository root: node library/playbooks/_research-digest.mjs).
// A question-led digest that stays on one street: buses arriving in a bunch under the figure
// that frames the report, the mechanism drawn on the same street, the camera tilting up into the
// sky where the evidence stands as bars, and the street again at the end, the buses evenly spaced.
// One dataset: 37% bunched; waits of 6 (timetable), 11 (riders) and 7 minutes (the trial).
import fs from 'node:fs';

const SAMPLE = 'Illustrative sample data · replace before publishing';
const ROAD = 800;
const still = el => ({ at: 0, enter: 'none', ...el });

// ------------------------------------------------------------------ the street
// A row of buildings in the surface colour (seeded, so every film's street is the same), the
// kerb and the road, all present on the first frame.
function street() {
  const out = [];
  let x = -200,
    seed = 12;
  const next = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  while (x < 2200) {
    const w = [150, 190, 230, 270][Math.floor(next() * 4)],
      h = [170, 230, 290, 350][Math.floor(next() * 4)];
    out.push(still({ type: 'rect', x, y: ROAD - h - 60, w: w - 14, h: h + 60, r: 6, fill: 'surface', opacity: 0.75 }));
    // A few lit windows give the blocks scale.
    for (let wy = ROAD - h - 30; wy < ROAD - 120; wy += 64)
      for (let wx = x + 24; wx < x + w - 50; wx += 52)
        if (next() > 0.55)
          out.push(still({ type: 'rect', x: wx, y: wy, w: 22, h: 30, r: 3, fill: 'line', opacity: 0.6 }));
    x += w;
  }
  out.push(still({ type: 'rect', x: -200, y: ROAD + 14, w: 2400, h: 600, fill: 'surface', opacity: 0.5 }));
  out.push(still({ type: 'line', x1: -200, y1: ROAD + 14, x2: 2200, y2: ROAD + 14, stroke: 'line', width: 8 }));
  return out;
}

function stop(x, riders, { at = 0.2, leave } = {}) {
  const out = [
    still({ type: 'line', x1: x, y1: ROAD + 10, x2: x, y2: ROAD - 250, stroke: 'muted', width: 6 }),
    still({ type: 'circle', cx: x, cy: ROAD - 270, r: 22, fill: 'accent2' }),
  ];
  for (let k = 0; k < riders; k++)
    out.push({
      type: 'circle',
      cx: x + 48 + (k % 4) * 46,
      cy: ROAD - 40 - Math.floor(k / 4) * 52,
      r: 19,
      fill: 'muted',
      at: at + k * 0.08,
      enter: 'pop',
      dur: 0.3,
      ...(leave ? { exitAt: leave, exitDur: 0.3 } : {}),
    });
  return out;
}

function bus(x, fill, { label, keys, labelFill = fill } = {}) {
  const W = 380,
    H = 150;
  const children = [
    { type: 'ellipse', cx: x + W / 2, cy: ROAD + 4, rx: W * 0.52, ry: 12, fill: 'ink', opacity: 0.12 },
    { type: 'rect', x, y: ROAD - H - 14, w: W, h: H, r: 30, fill },
    ...[0, 1, 2].map(i => ({
      type: 'rect',
      x: x + 30 + i * 112,
      y: ROAD - H + 8,
      w: 92,
      h: 54,
      r: 10,
      fill: 'bg',
      opacity: 0.85,
    })),
    { type: 'circle', cx: x + 86, cy: ROAD - 12, r: 26, fill: 'ink' },
    { type: 'circle', cx: x + W - 86, cy: ROAD - 12, r: 26, fill: 'ink' },
    ...(label
      ? [
          {
            type: 'text',
            text: label,
            x: x + W / 2,
            y: ROAD - H - 50,
            size: 46,
            font: 'bold',
            anchor: 'middle',
            fill: labelFill,
          },
        ]
      : []),
  ].map(still);
  return { type: 'group', at: 0, enter: 'none', ...(keys ? { keys } : {}), children };
}

// ------------------------------------------------------------------ 1. the hook
const hook = [
  ...street(),
  ...stop(520, 8, { at: 0 }),
  // Three buses arrive together, nose to tail, sliding in from the right.
  ...[0, 1, 2].map(i =>
    bus(1060 + i * 400, i === 0 ? 'accent' : 'ink', {
      keys: [
        { at: 0, x: 500, dur: 0 },
        { at: 0.2, x: 0, dur: 2.6, ease: 'out' },
      ],
    }),
  ),
  {
    type: 'text',
    x: 1060,
    y: 208,
    size: 210,
    font: 'figures',
    anchor: 'middle',
    fill: 'accent',
    count: { from: 0, to: 37, suffix: '%', dur: 1.2 },
    say: 'Thirty-seven',
    enter: 'rise',
    dur: 0.5,
  },
  {
    type: 'text',
    text: 'of buses arrive bunched',
    x: 1060,
    y: 314,
    size: 48,
    font: 'bold',
    anchor: 'middle',
    fill: 'ink',
    say: 'arrive',
    enter: 'fade',
    dur: 0.5,
  },
  {
    type: 'text',
    text: 'within two minutes of the one ahead · Route 12, weekday mornings',
    x: 1060,
    y: 362,
    size: 32,
    anchor: 'middle',
    fill: 'muted',
    fit: 1500,
    say: 'within',
    enter: 'fade',
    dur: 0.5,
  },
];

// ------------------------------------------------------------------ 2. the mechanism
const mechanism = [
  ...street(),
  ...stop(580, 2, { leave: 1.9 }),
  ...stop(1660, 8),
  bus(-480, 'ink', { label: 'next bus', keys: [{ at: 0.6, x: 1170, dur: 6.2, ease: 'inOut' }] }),
  bus(120, 'accent', {
    label: 'late bus',
    keys: [
      { at: 0.5, x: 420, dur: 2.4, ease: 'inOut' },
      { at: 3.0, x: 980, dur: 3.6, ease: 'out' },
    ],
  }),
];

// ------------------------------------------------------------------ 3–4. the evidence, in the sky
// The chart is made of the buses themselves: each row is 42 minutes of one stop, a small bus
// for every arrival. The timetable spaces them six minutes apart; in practice they arrive in
// pairs, so the gap a rider meets is far longer; the trial evens them out again. The figure at
// the end of each row is the average gap a rider meets (illustrative).
const X0 = 520,
  X1 = 1440,
  PER_MIN = (X1 - X0) / 42;
const marker = (minute, y, fill, at) => ({
  type: 'group',
  at,
  enter: 'pop',
  dur: 0.25,
  children: [
    { type: 'rect', x: X0 + minute * PER_MIN - 23, y: y - 30, w: 46, h: 24, r: 6, fill },
    { type: 'circle', cx: X0 + minute * PER_MIN - 12, cy: y - 5, r: 5, fill: 'ink' },
    { type: 'circle', cx: X0 + minute * PER_MIN + 12, cy: y - 5, r: 5, fill: 'ink' },
  ],
});
const row = (y, label, minutes, figure, { at = 0.2, fill = 'muted', figureSay } = {}) => [
  {
    type: 'text',
    text: label,
    x: 480,
    y: y - 8,
    size: 38,
    font: 'bold',
    anchor: 'end',
    fill: 'ink',
    at,
    enter: 'fade',
    dur: 0.4,
  },
  { type: 'line', x1: X0 - 30, y1: y, x2: X1 + 30, y2: y, stroke: 'line', width: 4, at, enter: 'draw', dur: 0.6 },
  ...minutes.map((m, i) => marker(m, y, fill, at + 0.3 + i * 0.07)),
  {
    type: 'text',
    text: figure,
    x: X1 + 70,
    y: y + 4,
    size: 72,
    font: 'figures',
    fill: fill === 'muted' ? 'ink' : fill,
    ...(figureSay ? { say: figureSay } : { at: at + 0.9 }),
    enter: 'rise',
    dur: 0.45,
  },
];
const EVEN = [0, 6, 12, 18, 24, 30, 36, 42];
const BUNCHED = [0, 2.3, 13, 15.3, 26, 28.3, 39, 41.3];
const TRIAL = [0, 6.5, 12, 18.5, 24, 30.5, 36, 42];
const evidence = [
  {
    type: 'text',
    text: 'ARRIVALS AT ONE STOP, OVER 42 MINUTES',
    x: X0 - 30,
    y: -650,
    size: 30,
    font: 'mono',
    tracking: 0.12,
    fill: 'muted',
    at: 0.1,
    enter: 'fade',
    dur: 0.5,
  },
  ...row(-560, 'Timetable', EVEN, '6 min', { at: 0.2, fill: 'muted' }),
  ...row(-330, 'In practice', BUNCHED, '11 min', { at: 0.9, fill: 'accent', figureSay: 'eleven' }),
  // The long gap a rider is most likely to meet, bracketed on the word.
  {
    type: 'path',
    d: `M ${X0 + 2.3 * PER_MIN + 30} -392 L ${X0 + 2.3 * PER_MIN + 30} -404 L ${X0 + 13 * PER_MIN - 30} -404 L ${X0 + 13 * PER_MIN - 30} -392`,
    stroke: 'accent',
    width: 3,
    say: 'meets',
    enter: 'draw',
    dur: 0.4,
  },
  {
    type: 'text',
    text: 'the gap most riders meet',
    x: X0 + 7.65 * PER_MIN,
    y: -420,
    size: 34,
    font: 'bold',
    anchor: 'middle',
    fill: 'accent',
    say: 'meets',
    enter: 'rise',
    dur: 0.4,
  },
];
const trial = [...row(-100, 'Trial', TRIAL, '7 min', { at: 0.2, fill: 'accent2', figureSay: 'seven' })];

// ------------------------------------------------------------------ 6. the street again
const after = [
  ...street(),
  ...stop(560, 1, { at: 0 }),
  ...stop(1500, 2, { at: 0 }),
  // Evenly spaced, moving together: the fix, drawn.
  ...[-700, 300, 1300].map((x, i) =>
    bus(x, i === 1 ? 'accent' : 'ink', { keys: [{ at: 0, x: 420, dur: 8, ease: 'linear', hold: false }] }),
  ),
  {
    type: 'text',
    text: 'Space the buses evenly, and the wait shrinks.',
    x: 1060,
    y: 230,
    size: 70,
    font: 'display',
    anchor: 'middle',
    fit: 1300,
    fill: 'ink',
    say: 'Space',
    enter: 'rise',
    dur: 0.7,
  },
  {
    type: 'text',
    text: 'Method, routes and limits are in the full study.',
    x: 1060,
    y: 300,
    size: 36,
    anchor: 'middle',
    fit: 1300,
    fill: 'muted',
    say: 'method',
    enter: 'fade',
    dur: 0.6,
  },
];

const STREET = [200, 190, 1720, 967.5];
// The street low in the frame with open sky above it, where the figure and the last line sit.
const SKY = [100, -80, 1920, 1080];
const beats = [
  {
    id: 'hook',
    block: 'canvas',
    vo: 'Thirty-seven percent of buses on Route 12 arrive within two minutes of the one ahead.',
    props: { source: SAMPLE, view: SKY, elements: hook },
  },
  {
    id: 'question',
    block: 'kinetic',
    vo: 'So why does adding buses barely shorten the wait?',
    transition: 'cut',
    props: { mode: 'stack', align: 'center', emphasis: ['barely'], emphasisStyle: 'serif' },
  },
  {
    id: 'mechanism',
    block: 'canvas',
    vo: 'A late bus finds more people at every stop. Boarding takes longer, so it falls further behind, until the next bus catches up.',
    transition: 'cut',
    props: { world: 'street', view: STREET, elements: mechanism },
    // The late bus hisses to a stop at each crowded stop; the next one brakes behind it.
    sfx: [
      { src: 'brake', at: 'word:Boarding', volume: 0.35 },
      { src: 'brake', at: 'word:catches', volume: 0.45 },
    ],
    camera: { move: 'right', amount: 0.4 },
  },
  {
    id: 'evidence',
    block: 'canvas',
    vo: 'The timetable spaces buses six minutes apart. In practice they arrive in pairs, and the average rider meets a gap of eleven minutes.',
    props: { world: 'street', view: [100, -760, 1920, 1080], viewDur: 1.6, source: SAMPLE, elements: evidence },
  },
  {
    id: 'trial',
    block: 'canvas',
    vo: 'In a trial that held buses to even gaps, that fell to seven.',
    props: { world: 'street', view: [100, -760, 1920, 1080], source: SAMPLE, elements: trial },
    hold: 0.8,
  },
  {
    id: 'turn',
    block: 'kinetic',
    vo: 'The problem was never too few buses. It was uneven gaps.',
    transition: 'cut',
    props: { mode: 'stack', align: 'center', emphasis: ['uneven gaps'], emphasisStyle: 'serif' },
  },
  {
    id: 'end',
    block: 'canvas',
    vo: 'Space the buses evenly, and the wait shrinks. The method and its limits are in the full study.',
    transition: 'dissolve',
    props: { view: SKY, source: SAMPLE, elements: after },
    hold: 1,
  },
];

const book = {
  order: 24,
  title: 'Turn a long report into a question-led short film',
  audience: 'Busy readers who will not open the report',
  inputs: 'An evidence brief (clearframe ingest --markdown): the question, 3–5 sourced claims, one tension',
  theme: 'noir',
  backdrop: 'none',
  motion: 'gentle',
  texture: { grain: 0.35, vignette: 0.5 },
  note: "Start from clearframe ingest --markdown report.md: it writes BRIEF.md with every figure, its sentence and its source. Replace every sample claim and keep one dataset: the same label always shows the same value and unit. Stay in the report's place: open on the figure over the thing it measures, ask the question it raises, draw the mechanism, let the camera find the evidence in the same world, turn, and end on the place changed (library/playbooks/_research-digest.mjs). Charts carry a narration-cued note instead of a heading.",
  heading: 'top',
  textMotion: 'words',
  transition: 'cut',
  sfx: 'subtle',
  lens: { grade: 'warm', gradeAmount: 0.35, leak: 0.1, handheld: 0.15, blur: 0.5 },
  beats,
};
fs.writeFileSync('library/playbooks/research-digest.json', JSON.stringify(book, null, 2) + '\n');
