// Generates data-story.json (run from the repository root: node library/playbooks/_data-story.mjs).
// A data film that never leaves its place: a queue of requests in a lit room. The camera finds
// one request and the wait it faces is set into the room; the wait becomes a hundred request
// cards, one per hour, and the edit cuts in to each stage; the spread follows, cut in to the
// few that wait longest; the film ends on the line, now shorter. Shots run three to four
// seconds and cut on what changes in the picture. One dataset: 4.2 days ≈ 100 h = 52 + 30 + 12 + 6.
import fs from 'node:fs';
import queue from '../sketches/queue.mjs';

const W = 1920,
  H = 1080;
const SAMPLE = 'Illustrative sample data · replace before publishing';
const room = queue.build(W, H);
const ours = room.elements.find(el => el.type === 'group' && el.children.some(c => c.glow))?.z ?? 2.4;
const r = v => Math.round(v * 10) / 10;

// The room behind a chart: the same queue, out of focus and dimmed, so every number is seen
// in the place it describes.
const behind = (dim = 0.42) => [
  { type: 'group', at: 0, enter: 'none', blur: 14, opacity: 0.55, children: room.elements.map(el => ({ ...el })) },
  { type: 'rect', x: 0, y: 0, w: W, h: H, fill: 'bg', opacity: dim, at: 0, enter: 'none' },
];

// ------------------------------------------------------------------ the wait, set into the room
// Not a stat card: the figure stands in the upper third of the room, beside the line it
// describes, while focus stays on our request.
const waitType = [
  {
    type: 'text',
    x: 150,
    y: 300,
    size: 190,
    font: 'figures',
    fill: 'ink',
    count: { from: 0, to: 4.2, decimals: 1, suffix: ' days', dur: 0.9 },
    say: 'four',
    enter: 'rise',
    dur: 0.5,
  },
  {
    type: 'text',
    text: 'average time to resolve one request',
    x: 156,
    y: 372,
    size: 44,
    fill: 'muted',
    say: 'days',
    enter: 'fade',
    dur: 0.5,
  },
];

// ------------------------------------------------------------------ a hundred hours, a hundred cards
// One small card per hour, the same card that waits in the queue, filled stage by stage. A unit
// chart reads as the thing itself; the edit cuts in to each stage.
const STAGES = [
  { label: 'Queue', hours: 52, fill: 'accent', words: 'waiting in a queue' },
  { label: 'Routing', hours: 30, fill: 'accent2', words: 'passed between teams' },
  { label: 'Answering', hours: 12, fill: 'ink', words: 'the answer itself' },
  { label: 'Follow-up', hours: 6, fill: 'muted', words: 'following up' },
];
const COLS = 20,
  CW = 66,
  CH = 50,
  GAP = 14,
  GX = (W - COLS * (CW + GAP) + GAP) / 2,
  GY = 220;
const cards = [];
let k = 0;
for (const st of STAGES)
  for (let n = 0; n < st.hours; n++, k++) {
    const x = GX + (k % COLS) * (CW + GAP),
      y = GY + Math.floor(k / COLS) * (CH + GAP);
    cards.push({
      stage: st.label,
      x,
      y,
      el: {
        type: 'group',
        at: r(0.1 + k * 0.009),
        enter: 'pop',
        dur: 0.22,
        children: [
          { type: 'rect', x, y, w: CW, h: CH, r: 7, fill: st.fill, opacity: st.fill === 'muted' ? 0.8 : 1 },
          { type: 'rect', x: x + 9, y: y + 12, w: 30, h: 6, r: 3, fill: 'bg', opacity: 0.55 },
        ],
      },
    });
  }
const gridBottom = GY + Math.ceil(k / COLS) * (CH + GAP) - GAP;
const legendY = gridBottom + 80;
const legend = STAGES.map((st, i) => ({
  type: 'group',
  at: 1.0 + i * 0.1,
  enter: 'fade',
  dur: 0.35,
  children: [
    { type: 'rect', x: GX + i * 400, y: legendY - 28, w: 28, h: 28, r: 5, fill: st.fill },
    { type: 'text', text: `${st.label}  ${st.hours} h`, x: GX + i * 400 + 44, y: legendY - 4, size: 38, fill: 'ink' },
  ],
}));
// A cut-in to one stage: the grid already drawn, the other stages stepped back, the stage's
// hours and words set large below it, and the camera framing that part of the grid.
function stageShot(label) {
  const st = STAGES.find(s => s.label === label);
  const mine = cards.filter(c => c.stage === label);
  const [x0, x1] = [Math.min(...mine.map(c => c.x)), Math.max(...mine.map(c => c.x)) + CW];
  const [y0, y1] = [Math.min(...mine.map(c => c.y)), Math.max(...mine.map(c => c.y)) + CH];
  // A 16:9 rect whose edges fall in the gaps between cards (no card sliced by the frame): a
  // whole number of card pitches wide, the stage and its caption (below the whole grid)
  // centred in it.
  const pitchX = CW + GAP,
    pitchY = CH + GAP;
  const cols = Math.max(Math.ceil((x1 - x0 + 220) / pitchX), 12);
  const w = cols * pitchX,
    vh = (w * 9) / 16;
  const firstCol = Math.round(((x0 + x1) / 2 - w / 2 - GX) / pitchX);
  const left = GX - GAP / 2 + firstCol * pitchX;
  const capY = gridBottom + 110;
  let top = (y0 + capY + 80) / 2 - vh / 2;
  if (top > GY - GAP && top < gridBottom) top = GY - GAP / 2 + Math.floor((top - GY) / pitchY) * pitchY;
  const view = [r(left), r(top), r(w), r(vh)];
  const capX = Math.min(x1, left + w * 0.92);
  return {
    view,
    elements: [
      ...cards.map(c =>
        c.stage === label ? { ...c.el, at: 0, enter: 'none' } : { ...c.el, at: 0, enter: 'none', opacity: 0.18 },
      ),
      {
        type: 'text',
        text: `${st.hours} hours`,
        x: capX,
        y: capY,
        anchor: 'end',
        size: 92,
        font: 'figures',
        fill: st.fill === 'muted' ? 'ink' : st.fill,
        at: 0.15,
        enter: 'rise',
        dur: 0.4,
      },
      {
        type: 'text',
        text: st.words,
        x: capX,
        y: capY + 60,
        anchor: 'end',
        size: 44,
        fill: 'ink',
        at: 0.3,
        enter: 'fade',
        dur: 0.4,
      },
    ],
  };
}

// ------------------------------------------------------------------ the spread
const SPREAD = [
  { label: 'Same day', value: 46 },
  { label: '1–3 days', value: 28 },
  { label: '3–7 days', value: 14 },
  { label: '1–2 weeks', value: 8 },
  { label: '2+ weeks', value: 4, highlight: true },
];
// The cut-in to the tail is a new shot, not a morph: its own ids.
const spread = note => ({
  kind: 'bars',
  id: note ? 'tail' : 'spread',
  suffix: '%',
  values: SPREAD,
  ...(note ? { at: 0, note: { text: 'the few that pull the average up', to: '2+ weeks', say: 'weeks' } } : {}),
});

// The end: the same room, a shorter line, our request near the front.
const after = queue.build(W, H, { count: 7, ours: 1 });

const shot = (id, vo, label, extra = {}) => {
  const s = stageShot(label);
  return {
    id,
    block: 'canvas',
    vo,
    transition: 'cut',
    // Held still (no drift): the crop's edges sit in the gaps between cards.
    props: { source: SAMPLE, view: s.view, viewDrift: 0, elements: s.elements },
    art: { under: behind() },
    ...extra,
  };
};

const beats = [
  { id: 'open', block: 'canvas', vo: 'How long does one request really take?', props: { sketch: 'queue' } },
  {
    id: 'wait',
    block: 'canvas',
    vo: 'On average, four point two days.',
    transition: 'cut',
    props: {
      source: SAMPLE,
      dolly: [
        { at: 0, z: 2.1, dur: 0 },
        { at: 0, z: 2.3, dur: 4, ease: 'out' },
      ],
      focus: { z: ours, aperture: 0.8 },
      elements: [...room.elements, ...waitType],
    },
  },
  {
    id: 'hours',
    block: 'canvas',
    vo: 'About a hundred hours. Here is where they go.',
    transition: 'dissolve',
    props: {
      source: SAMPLE,
      elements: [
        {
          type: 'text',
          text: 'ONE CARD = ONE HOUR OF ONE REQUEST',
          x: GX,
          y: GY - 50,
          size: 30,
          font: 'mono',
          tracking: 0.12,
          fill: 'muted',
          at: 0.1,
          enter: 'fade',
          dur: 0.5,
        },
        ...cards.map(c => c.el),
        ...legend,
      ],
    },
    art: { under: behind() },
    camera: { move: 'in', amount: 0.4 },
  },
  shot('queue', 'Fifty-two are spent waiting in a queue.', 'Queue'),
  shot('routing', 'Thirty more go to passing it between teams.', 'Routing'),
  shot('answer', 'The answer itself takes twelve.', 'Answering', { hold: 0.4 }),
  {
    id: 'shape',
    block: 'canvas',
    vo: 'But the average hides the shape.',
    transition: 'whip',
    props: { source: SAMPLE, chart: spread(false), elements: [] },
    art: { under: behind(0.5) },
  },
  {
    id: 'tail',
    block: 'canvas',
    vo: 'Almost half are resolved the same day. A few wait for weeks.',
    transition: 'cut',
    props: { source: SAMPLE, view: [760, 324, 1315.6, 740], chart: spread(true), elements: [] },
    art: { under: behind(0.5) },
    hold: 0.6,
  },
  {
    id: 'end',
    block: 'canvas',
    vo: 'Measure the whole wait, and start with the requests that wait longest.',
    transition: 'dissolve',
    props: {
      dolly: [
        { at: 0, z: 0.9, dur: 0 },
        { at: 0, z: 0.2, dur: 7, ease: 'out' },
      ],
      focus: { z: after.focus.z, aperture: 0.7 },
      elements: [
        ...after.elements,
        {
          type: 'text',
          text: 'Measure the whole wait.',
          x: 960,
          y: 250,
          size: 104,
          font: 'display',
          anchor: 'middle',
          fit: 1500,
          fill: 'ink',
          say: 'Measure',
          enter: 'rise',
          dur: 0.7,
        },
        {
          type: 'text',
          text: 'Start with the requests that wait longest.',
          x: 960,
          y: 330,
          size: 40,
          anchor: 'middle',
          fit: 1400,
          fill: 'muted',
          say: 'start',
          enter: 'fade',
          dur: 0.6,
        },
      ],
    },
    hold: 1.2,
  },
];

const book = {
  order: 19,
  title: 'Tell a story with a few trustworthy numbers',
  audience: 'A general audience meeting the numbers for the first time',
  inputs: 'Three to five sourced figures, their dates and denominators',
  theme: 'midnight',
  backdrop: 'none',
  heading: 'bottom',
  textMotion: 'words',
  transition: 'cut',
  sfx: 'subtle',
  texture: { grain: 0.3, vignette: 0.45 },
  lens: { grade: 'cool', gradeAmount: 0.3, handheld: 0.12, blur: 0.5 },
  note: 'One dataset carries the film, in one place: the queue the numbers describe. The average wait (4.2 days ≈ 100 hours) becomes a hundred request cards, one per hour; the edit cuts in to each stage (52 + 30 + 12 + 6), then to the spread and its tail, always in front of the same room. Shots run three to four seconds and cut on what changes in the picture. Replace the figures and keep them consistent; draw the place your numbers describe (library/playbooks/_data-story.mjs); end on it, not on a card.',
  beats,
};
fs.writeFileSync('library/playbooks/data-story.json', JSON.stringify(book, null, 2) + '\n');
