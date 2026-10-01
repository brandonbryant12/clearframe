// Generates research-digest.json (run from the repository root: node library/playbooks/_research-digest.mjs).
// A question-led digest that stays on one street: buses arriving in a bunch under the figure
// that frames the report, the mechanism drawn on the same street, the camera tilting up into the
// sky where the evidence stands as bars, and the street again at the end, the buses evenly spaced.
// One dataset: 37% bunched; waits of 6 (timetable), 11 (riders) and 7 minutes (the trial).
import fs from 'node:fs';
import { chartElements, chartSpec } from '../../fframes/data-canvas.mjs';

const SAMPLE = 'Illustrative sample data · replace before publishing';
const ROAD = 800;
const still = el => ({ at: 0, enter: 'none', ...el });
const fail = m => {
  throw new Error(m);
};

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
// The same chart in both beats: the timetable and the riders' wait first, the trial's bar after.
const BOX = [330, -560, 1260, 560];
const values = [
  { label: 'Timetable', value: 6 },
  { label: 'Riders wait', value: 11, highlight: true },
  { label: 'Even gaps (trial)', value: 7 },
];
const evidenceAll = chartElements(
  chartSpec(
    {
      kind: 'bars',
      id: 'wait',
      suffix: ' min',
      max: 12,
      box: BOX,
      values,
      note: { text: 'nearly double the timetable', to: 'Riders wait', say: 'double' },
    },
    fail,
  ),
  { w: 1920, h: 1080 },
);
const trialAll = chartElements(
  chartSpec(
    {
      kind: 'bars',
      id: 'wait',
      suffix: ' min',
      max: 12,
      box: BOX,
      values: values.map(v => ({ ...v, highlight: v.label.startsWith('Even') })),
      note: { text: 'the trial: 7 minutes', to: 'Even gaps (trial)', say: 'seven' },
    },
    fail,
  ),
  { w: 1920, h: 1080 },
);
// The third column's x range: everything drawn there belongs to the trial.
const third = trialAll.find(el => el.id === 'wait-even-gaps-trial');
const inThird = el => (el.x ?? el.x1 ?? 0) >= third.x - 40;
const evidence = evidenceAll.filter(el => !inThird(el) || (el.type === 'line' && el.x1 < third.x - 40));
// The trial's note sits above its own (shorter) bar, clear of the evidence note below.
const trial = [
  ...trialAll.filter(el => inThird(el) && el.type !== 'line' && !(el.type === 'text' && el.fill === 'accent' && el.say)),
  {
    type: 'text',
    text: 'the trial: 7 minutes',
    x: third.x + third.w / 2,
    y: third.y - 150,
    size: 40,
    font: 'bold',
    anchor: 'middle',
    fill: 'accent',
    say: 'seven',
    enter: 'rise',
    dur: 0.45,
  },
  {
    type: 'line',
    x1: third.x + third.w / 2,
    y1: third.y - 128,
    x2: third.x + third.w / 2,
    y2: third.y - 90,
    stroke: 'accent',
    width: 3,
    arrow: 'end',
    head: 12,
    say: 'seven',
    enter: 'draw',
    dur: 0.35,
  },
];

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
    vo: 'Riders wait eleven minutes on average, nearly double what the timetable promises.',
    props: { world: 'street', view: [100, -760, 1920, 1080], viewDur: 1.6, source: SAMPLE, elements: evidence },
  },
  {
    id: 'trial',
    block: 'canvas',
    vo: 'In a trial that held buses to even gaps, the wait fell to seven minutes.',
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
