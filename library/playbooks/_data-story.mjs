// Generates data-story.json (run from the repository root: node library/playbooks/_data-story.mjs).
// A data film that never leaves its place: a queue of requests in a lit room. The camera finds
// one request, the wait it faces appears over it, and that number's bar splits into the hours,
// stands up as bars and spreads into the tail, all in front of the same room, softened, until the
// film returns to the line, now shorter. One dataset throughout: 4.2 days = 52 + 31 + 12 + 6 h.
import fs from 'node:fs';
import queue from '../sketches/queue.mjs';
import { chartElements, chartSpec } from '../../fframes/data-canvas.mjs';

const W = 1920,
  H = 1080;
const SAMPLE = 'Illustrative sample data · replace before publishing';
const room = queue.build(W, H);
const ours = room.elements.find(el => el.type === 'group' && el.children.some(c => c.glow))?.z ?? 2.4;

// The room behind a chart: the same queue, out of focus and dimmed, so every number is seen
// in the place it describes.
const behind = (dim = 0.42) => [
  { type: 'group', at: 0, enter: 'none', blur: 14, opacity: 0.55, children: room.elements.map(el => ({ ...el })) },
  { type: 'rect', x: 0, y: 0, w: W, h: H, fill: 'bg', opacity: dim, at: 0, enter: 'none' },
];
const chart = (spec, extra = {}) => ({ source: SAMPLE, chart: spec, elements: [], ...extra });
const hours = highlight => [
  { label: 'Queue', value: 52, ...(highlight === 'Queue' ? { highlight: true } : {}) },
  { label: 'Routing', value: 31, ...(highlight === 'Routing' ? { highlight: true } : {}) },
  { label: 'Answering', value: 12, ...(highlight === 'Answering' ? { highlight: true } : {}) },
  { label: 'Follow-up', value: 6, ...(highlight === 'Follow-up' ? { highlight: true } : {}) },
];

// The number lands over the room: focus racks off our card to the far light as it arrives.
const wait = chartSpec(
  {
    kind: 'number',
    suffix: ' days',
    decimals: 1,
    at: 0.5,
    values: [{ label: 'average time to resolve one request', value: 4.2, id: 'queue' }],
  },
  m => {
    throw new Error(m);
  },
);
const waitElements = [
  ...room.elements,
  { type: 'rect', x: 0, y: 0, w: W, h: H, fill: 'bg', opacity: 0.5, at: 0.3, enter: 'fade', dur: 1 },
  ...chartElements(wait, { w: W, h: H }),
];

// The end: the same room, a shorter line, our request near the front.
const after = queue.build(W, H, { count: 7, ours: 1 });

const beats = [
  { id: 'open', block: 'canvas', vo: 'How long does one request really take?', props: { sketch: 'queue' } },
  {
    id: 'wait',
    block: 'canvas',
    vo: 'On average, four point two days, from the moment it is sent to the moment it is resolved.',
    transition: 'cut',
    props: {
      source: SAMPLE,
      dolly: [
        { at: 0, z: 2.1, dur: 0 },
        { at: 0, z: 2.35, dur: 6, ease: 'out' },
      ],
      focus: { z: ours, aperture: 0.8, keys: [{ say: 'days', z: 9, dur: 1.2 }] },
      elements: waitElements,
    },
  },
  {
    id: 'parts',
    block: 'canvas',
    vo: 'Where do those hundred hours go? Most are spent waiting in a queue, and being passed between teams. The answer itself takes twelve.',
    props: chart(
      {
        kind: 'stack',
        suffix: ' h',
        values: hours('Queue'),
        note: { text: 'the answer itself: 12 hours', to: 'Answering', say: 'twelve' },
      },
      { elements: [] },
    ),
    art: { under: behind() },
    camera: { move: 'in', amount: 0.6 },
  },
  {
    id: 'side',
    block: 'canvas',
    vo: 'Stand them side by side, and routing is the part a better handoff can shrink.',
    props: chart({
      kind: 'bars',
      suffix: ' h',
      values: hours('Routing'),
      note: { text: 'what a better handoff can shrink', to: 'Routing', say: 'handoff' },
    }),
    art: { under: behind() },
    camera: { to: [200, 252, 1457.8, 820], say: 'routing', dur: 2.4 },
    hold: 0.3,
  },
  {
    id: 'tail',
    block: 'canvas',
    vo: 'But the average hides the shape. Almost half are resolved the same day, while a few wait for weeks.',
    transition: 'whip',
    props: chart({
      kind: 'bars',
      id: 'spread',
      suffix: '%',
      values: [
        { label: 'Same day', value: 46 },
        { label: '1–3 days', value: 28 },
        { label: '3–7 days', value: 14 },
        { label: '1–2 weeks', value: 8 },
        { label: '2+ weeks', value: 4, highlight: true },
      ],
      note: { text: 'the few that pull the average up', to: '2+ weeks', say: 'weeks' },
    }),
    art: { under: behind(0.5) },
    camera: { to: [700, 324, 1315.6, 740], say: 'weeks', dur: 2.2 },
    hold: 0.8,
  },
  {
    id: 'end',
    block: 'canvas',
    vo: 'Measure the whole wait, and start with the requests that wait longest.',
    transition: 'dissolve',
    props: {
      dolly: [{ at: 0, z: 0.9, dur: 0 }, { at: 0, z: 0.2, dur: 7, ease: 'out' }],
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
  note: 'One dataset carries the film, in one place: the queue the numbers describe. The average wait (4.2 days) splits into its hours (52 + 31 + 12 + 6 = 101 h), the hours stand up as bars and spread into the tail, always in front of the same room. Replace the figures and keep them consistent: the same label always shows the same value. Draw the place your numbers describe (library/playbooks/_data-story.mjs); end on it, not on a card.',
  beats,
};
fs.writeFileSync('library/playbooks/data-story.json', JSON.stringify(book, null, 2) + '\n');
