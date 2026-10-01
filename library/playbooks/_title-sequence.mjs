// Generates title-sequence.json (run from the repository root: node library/playbooks/_title-sequence.mjs).
// Cut paper: one red shape becomes each other shape across the cuts (same id, so it morphs): a
// sun, a line, a door, a lit doorway that throws a wedge of light and a long shadow, and the sun
// again over the title. Type is set into the composition like another shape.
import fs from 'node:fs';

const hold = { at: 0, dur: 0 };
const panels = (lw, rw, rightFill = 'ink', extra = {}) => [
  { id: 'left', type: 'rect', x: -40, y: -40, w: lw, h: 1160, fill: 'ink', ...hold, ...extra },
  { id: 'right', type: 'rect', x: 1960 - rw, y: -40, w: rw, h: 1160, fill: rightFill, ...hold, ...extra },
];
const push = { move: 'in', amount: 0.8 };

const beats = [
  // A sun on cream stock, framed by two black panels that are there from the first frame.
  {
    id: 'disc',
    block: 'canvas',
    transition: 'cut',
    vo: 'Every story starts with a shape.',
    camera: push,
    props: {
      elements: [
        ...panels(420, 420, 'ink', { enter: 'none' }),
        {
          id: 'sun',
          type: 'circle',
          cx: 960,
          cy: 520,
          r: 190,
          fill: 'accent',
          enter: 'pop',
          at: 0.15,
          dur: 0.5,
          loop: { type: 'pulse', period: 2.2, amount: 0.04 },
        },
        // A thin navy horizon the sun sits on.
        { type: 'rect', x: 380, y: 760, w: 1160, h: 10, fill: 'accent2', enter: 'grow-x', at: 0.5, dur: 0.6 },
      ],
    },
  },
  // The sun stretches into a line; the panels part around it; the series line runs up the navy.
  {
    id: 'bar',
    block: 'canvas',
    vo: 'Then it becomes a line,',
    camera: push,
    props: {
      elements: [
        { id: 'sun', type: 'rect', x: 900, y: 120, w: 120, h: 840, fill: 'accent', ...hold },
        ...panels(780, 780, 'accent2'),
        {
          type: 'text',
          text: 'SEASON ONE',
          x: 1300,
          y: 540,
          size: 72,
          font: 'display',
          anchor: 'middle',
          tracking: 0.32,
          fill: 'bg',
          rotate: 90,
          origin: [1300, 540],
          enter: 'type',
          at: 0.4,
        },
      ],
    },
  },
  // The line widens into a door; one beat of silence and a knob.
  {
    id: 'door',
    block: 'canvas',
    duration: 1.4,
    camera: push,
    props: {
      elements: [
        { id: 'sun', type: 'rect', x: 780, y: 260, w: 360, h: 560, fill: 'accent', ...hold },
        ...panels(820, 820),
        { id: 'floor', type: 'rect', x: -40, y: 820, w: 2000, h: 300, fill: 'ink', ...hold },
        { id: 'lintel', type: 'rect', x: 760, y: -40, w: 400, h: 300, fill: 'ink', enter: 'wipe', at: 0, dur: 0.3 },
        { id: 'knob', type: 'circle', cx: 1090, cy: 560, r: 16, fill: 'bg', enter: 'pop', at: 0.5, dur: 0.3 },
      ],
    },
  },
  // The door opens: the doorway is light, a wedge of it falls across the floor toward us, and
  // someone steps into it with a long shadow.
  {
    id: 'step',
    block: 'canvas',
    vo: 'a door, and a way through.',
    camera: push,
    props: {
      elements: [
        { id: 'sun', type: 'rect', x: 780, y: 260, w: 360, h: 560, fill: 'bg', ...hold },
        ...panels(820, 820),
        { id: 'floor', type: 'rect', x: -40, y: 820, w: 2000, h: 300, fill: 'ink', ...hold },
        { id: 'lintel', type: 'rect', x: 760, y: -40, w: 400, h: 300, fill: 'ink', ...hold },
        {
          type: 'poly',
          points: [
            [780, 820],
            [1140, 820],
            [1560, 1100],
            [420, 1100],
          ],
          closed: true,
          fill: 'bg',
          enter: 'wipe',
          at: 0.1,
          dur: 0.6,
        },
        {
          type: 'poly',
          points: [
            [935, 820],
            [985, 820],
            [1010, 1100],
            [890, 1100],
          ],
          closed: true,
          fill: 'ink',
          opacity: 0.9,
          enter: 'grow-y',
          at: 0.65,
          dur: 0.5,
        },
        { id: 'figure', type: 'rect', x: 930, y: 590, w: 60, h: 230, fill: 'accent', enter: 'grow-y', at: 0.45, dur: 0.5 },
        { id: 'head', type: 'circle', cx: 960, cy: 552, r: 36, fill: 'accent', enter: 'pop', at: 0.75, dur: 0.3 },
      ],
    },
  },
  // The light becomes the sun again, over the title.
  {
    id: 'title',
    block: 'canvas',
    hold: 1.7,
    vo: 'Through Lines.',
    camera: push,
    props: {
      elements: [
        { id: 'sun', type: 'circle', cx: 1560, cy: 360, r: 140, fill: 'accent', ...hold },
        { id: 'left', type: 'rect', x: -40, y: -40, w: 0, h: 1160, fill: 'ink', ...hold },
        { id: 'right', type: 'rect', x: 1960, y: -40, w: 0, h: 1160, fill: 'ink', ...hold },
        { id: 'floor', type: 'rect', x: -40, y: 1080, w: 2000, h: 0, fill: 'ink', ...hold },
        { id: 'lintel', type: 'rect', x: 760, y: -40, w: 400, h: 0, fill: 'ink', ...hold },
        {
          type: 'text',
          text: 'THROUGH',
          x: 740,
          y: 520,
          size: 176,
          font: 'display',
          anchor: 'middle',
          tracking: 0.08,
          fill: 'ink',
          enter: 'type',
          at: 0.25,
        },
        {
          type: 'text',
          text: 'LINES',
          x: 740,
          y: 690,
          size: 176,
          font: 'display',
          anchor: 'middle',
          tracking: 0.08,
          fill: 'accent2',
          enter: 'type',
          at: 0.55,
        },
        { id: 'rule', type: 'rect', x: 300, y: 740, w: 880, h: 16, fill: 'accent', enter: 'grow-x', at: 0.9, dur: 0.5 },
        {
          type: 'text',
          text: 'A PODCAST ABOUT HOW THINGS CONNECT',
          x: 740,
          y: 822,
          size: 38,
          font: 'bold',
          anchor: 'middle',
          tracking: 0.26,
          fit: 1100,
          fill: 'muted',
          enter: 'type',
          at: 0.85,
        },
      ],
    },
  },
  // The button: a red panel wipes across with the day it airs.
  {
    id: 'button',
    block: 'canvas',
    vo: 'New episodes every Tuesday.',
    transition: 'panel',
    hold: 0.8,
    props: {
      elements: [
        { type: 'rect', x: -40, y: -40, w: 2000, h: 1160, fill: 'accent', ...hold, enter: 'none' },
        { type: 'circle', cx: 1560, cy: 360, r: 140, fill: 'bg', enter: 'pop', at: 0.2, dur: 0.4 },
        {
          type: 'text',
          text: 'NEW EPISODES',
          x: 200,
          y: 560,
          size: 120,
          font: 'display',
          tracking: 0.06,
          fill: 'bg',
          enter: 'type',
          at: 0.3,
        },
        {
          type: 'text',
          text: 'EVERY TUESDAY',
          x: 200,
          y: 700,
          size: 120,
          font: 'display',
          tracking: 0.06,
          fill: 'ink',
          enter: 'type',
          at: 0.7,
        },
      ],
    },
  },
];

const book = {
  order: 33,
  title: 'A title sequence: bold cut-paper shapes that become each other on the beat, ending on the title',
  audience: 'The first thirty seconds of a series, a podcast, an event or a film',
  inputs: 'A title, a season or series line, the day it airs, a music bed with a clear beat',
  theme: 'bass',
  motion: 'snappy',
  backdrop: 'paper',
  transition: 'cut',
  sfx: 'normal',
  textMotion: 'letters',
  texture: { grain: 0.25, vignette: 0.2 },
  note: 'Each beat is one move and one hold, cut on the music. Shapes carry across cuts by id (morph): keep the ids when you restyle. Replace the title, the season line and the day it airs; if you add credits, give every role its name.',
  beats,
};
fs.writeFileSync('library/playbooks/title-sequence.json', JSON.stringify(book, null, 2) + '\n');
