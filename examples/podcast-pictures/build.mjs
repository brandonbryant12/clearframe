#!/usr/bin/env node
// Builds the podcast-pictures example: a recorded conversation (Money at Work, host Maya, guest
// Sam) imported as gapless beats, then every beat that carries an idea given its own small
// picture, with pop captions carrying the words underneath. Free and local: the macOS `say`
// voice makes the mock episode, local Whisper measures the words.
//
//   node examples/podcast-pictures/build.mjs [OUT]      (default build/podcast-pictures)
//
// The recording, its timing and every beat's `vo` stay exactly as imported. Pictures are keyed by
// beat id and checked against the words each beat says, so a re-import that moves the cuts
// fails here instead of putting a picture on the wrong line.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.resolve(process.argv[2] ?? 'build/podcast-pictures');
const rel = p => path.relative(process.cwd(), p) || '.';
const cli = (...args) => execFileSync(process.execPath, [path.join(root, 'apps/cli/dist/main.mjs'), ...args], { stdio: 'inherit' });

// ------------------------------------------------------------------ 1. the episode and its import

const episode = path.join(path.dirname(out), 'podcast-fixture/episode.wav');
if (!fs.existsSync(episode)) {
  console.log('making the mock episode with the macOS say voice…');
  execFileSync(process.execPath, [path.join(root, 'bench/enterprise/podcast/make-episode.mjs'), episode], { stdio: 'inherit' });
}
const board = path.join(out, 'storyboard.json');
if (!fs.existsSync(board)) {
  if (fs.existsSync(out) && fs.readdirSync(out).length)
    throw new Error(`${rel(out)} exists but holds no storyboard; ingest needs a new folder. Remove it or pass another.`);
  cli('ingest', rel(out), '--audio', rel(episode), '--script', path.join(root, 'bench/enterprise/podcast/turns.txt'),
    '--speakers', 'host=Maya:Host,guest=Sam:Guest', '--vertical', '--direction', 'podcast-picture');
} else console.log(`reusing the import in ${rel(out)} (delete the folder to import the recording again)`);

// ------------------------------------------------------------------ drawing helpers
// Frame: 1080 × 1920. Pictures live in y 150–1420; the speaker chip, the source line and the pop
// captions take the band below it.

const r = v => Math.round(v);
const SAM = 'Sam, on air';

/** A glass jar: body, an optional money level, a shine and a lid. `enter` applies to the glass. */
function jar(id, { cx, bottom, w, h, lid = 'ink', level = 0, color = 'accent2', show = {}, fillShow = show, extra = {} }) {
  const x = r(cx - w / 2), y = r(bottom - h), lidH = r(h * 0.09), inner = h - 24;
  const els = [
    { type: 'rect', id: `${id}-body`, x, y, w, h, r: r(w * 0.16), fill: 'surface', stroke: 'ink', width: 7, ...show, ...extra },
  ];
  if (level > 0) {
    const fh = r(level * inner);
    els.push({ type: 'rect', id: `${id}-fill`, x: x + 12, y: r(bottom - 12 - fh), w: w - 24, h: fh, r: Math.min(r(w * 0.12), r(fh / 2)), fill: color, origin: [r(cx), r(bottom - 12)], ...fillShow, ...extra });
  }
  els.push(
    { type: 'line', id: `${id}-shine`, x1: r(x + w * 0.16), y1: r(y + h * 0.14), x2: r(x + w * 0.16), y2: r(y + h * 0.42), stroke: 'bg', width: 10, cap: 'round', opacity: 0.85, ...show, ...extra },
    { type: 'rect', id: `${id}-lid`, x: r(cx - w * 0.55), y: y - lidH, w: r(w * 1.1), h: lidH, r: 10, fill: lid, ...show, ...extra },
  );
  return els;
}

/** A level added on top of a jar's fill (rises from `from` to `to` of the jar's inside height). */
function topUp(id, { cx, bottom, w, h, from, to, color = 'accent2', show }) {
  const inner = h - 24, top = bottom - 12 - to * inner, base = bottom - 12 - from * inner + 24;
  return { type: 'rect', id, x: r(cx - w / 2 + 12), y: r(top), w: w - 24, h: r(base - top), r: 8, fill: color, origin: [r(cx), r(base)], enter: 'grow-y', dur: 0.7, ...show };
}

/** Coins in a grid, filled from the bottom row up: one coin is one hundredth of the pile. */
function coinGrid({ cx, bottom, spacing, cols = 10, rows = 10 }) {
  const out = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++)
      out.push({ n: row * cols + col, row, col, x: r(cx + (col - (cols - 1) / 2) * spacing), y: r(bottom - spacing / 2 - row * spacing) });
  return out;
}
const coin = (id, x, y, rad, extra = {}) => ({ type: 'circle', id, cx: x, cy: y, r: rad, fill: 'accent2', stroke: 'bg', width: 3, ...extra });

const text = (id, t, x, y, size, extra = {}) => ({ type: 'text', id, text: t, x, y, size, anchor: 'middle', font: 'bold', fill: 'ink', ...extra });

/** A "?" speech bubble: the question people send in. */
const bubble = (id, x, y, side, say) => ({
  type: 'group', id, x, y, say, enter: 'pop', dur: 0.4,
  children: [
    { type: 'rect', x: -78, y: -58, w: 156, h: 116, r: 36, fill: 'bg', stroke: 'ink', width: 5 },
    { type: 'poly', points: side < 0 ? [[38, 50], [74, 92], [12, 56]] : [[-38, 50], [-74, 92], [-12, 56]], closed: true, fill: 'bg', stroke: 'ink', width: 5 },
    { type: 'rect', x: side < 0 ? 10 : -42, y: 44, w: 32, h: 14, fill: 'bg' },
    { type: 'text', text: '?', x: 0, y: 30, size: 84, font: 'bold', fill: 'accent', anchor: 'middle' },
  ],
});

/** A round badge holding an icon (a lock, a tick, a cross). */
const badge = (id, x, y, icon, fill, show, extra = {}) => [
  { type: 'circle', id: `${id}-bg`, cx: x, cy: y, r: 50, fill, stroke: 'bg', width: 6, ...show, ...extra },
  { type: 'icon', id: `${id}-ic`, name: icon, x, y, size: 60, stroke: fill === 'bg' ? 'ink' : 'bg', ...show, ...extra },
];

// ------------------------------------------------------------------ the shared geometry

// The opening jar (the question), and the three jars of the answer (too little, enough, too much).
const BIG = { cx: 540, bottom: 1300, w: 420, h: 560 };
const THREE = [220, 540, 860].map(cx => ({ cx, bottom: 1000, w: 250, h: 400 }));
// The checking jar, centre stage, and the same jar beside a savings jar at the end.
const CHECK = { cx: 540, bottom: 1220, w: 420, h: 600 };
const LEFT = { cx: 270, bottom: 1150, w: 320, h: 457 };
const RIGHT = { cx: 810, bottom: 1150, w: 320, h: 457 };
const K = LEFT.w / CHECK.w; // how much the checking jar shrinks when it moves aside
const PILE = coinGrid({ cx: CHECK.cx, bottom: CHECK.bottom - 14, spacing: 36 });
const pileAt = (c, j = LEFT) => ({ x: r(j.cx + (c.x - CHECK.cx) * K), y: r(j.bottom - (CHECK.bottom - c.y) * K) });
// The top row loses three coins for each year of 3% price rises (Sam's figure): 3, 6, then 9.
const FADED = [[0, 1, 2], [3, 4, 5], [6, 7, 8]].map(g => g.map(col => 90 + col));
const LOST = new Set(FADED.flat());
// The emergency fund that moves out: rows 5–8 of the pile, into the bottom rows of the savings jar.
const MOVED = PILE.filter(c => c.row >= 5 && c.row <= 8);
const movedTo = c => pileAt({ ...c, y: c.y + 5 * 36 }, RIGHT);

// Six empty month slots where the calendars land (the cast row places three 240 px pages 302 px
// apart), so the months scene has a picture from its first frame.
const SLOTS = [680, 960].flatMap(y => [238, 540, 842].map(x => [x, y]));
const slots = () => SLOTS.map(([x, y], i) => ({ type: 'rect', id: `slot-${i}`, x: x - 101, y: y - 91, w: 202, h: 201, r: 16, fill: 'none', stroke: 'line', width: 4, dash: [14, 10], at: 0, enter: 'none' }));

const jarsOfTheAnswer = (state = 'end') => {
  // The three jars as the guest's answer leaves them: most people low, enough in the middle,
  // some people overflowing. `state: 'end'` draws them settled (no entrances).
  const [a, b, c] = THREE;
  const still = state === 'end';
  return [
    ...jar('jar-a', { ...a, level: 0.16, show: still ? {} : { say: 'more', enter: 'rise', dur: 0.5 }, fillShow: still ? {} : { say: 'more', after: 0.3, enter: 'grow-y', dur: 0.6 } }),
    ...jar('jar-b', { ...b, level: 0.3 }),
    topUp('jar-b-top', { ...b, from: 0.3, to: 0.58, show: still ? { enter: 'none' } : { say: 'have' } }),
    ...jar('jar-c', { ...c, level: 1, show: still ? {} : { say: 'less', enter: 'rise', dur: 0.5 }, fillShow: still ? {} : { say: 'some', enter: 'grow-y', dur: 0.7 } }),
    ...[[820, 540], [866, 540], [843, 500]].map(([x, y], i) => coin(`spill-${i}`, x, y, 22, still ? {} : { say: 'hoard', after: i * 0.08, enter: 'drop', dur: 0.35 })),
    text('lab-a', 'Most people', a.cx, 1085, 46, { width: 250, leading: 1.05, fill: 'muted', font: 'semibold', ...(still ? {} : { say: 'most', enter: 'rise' }) }),
    text('lab-c', 'Some people', c.cx, 1085, 46, { width: 250, leading: 1.05, fill: 'muted', font: 'semibold', ...(still ? {} : { say: 'some', enter: 'rise' }) }),
    text('lab-b', 'Enough', b.cx, 1100, 58, { fill: 'accent2', ...(still ? {} : { say: 'have', after: 0.3, enter: 'rise' }) }),
  ];
};

// ------------------------------------------------------------------ 2. the pictures, beat by beat
// `words` is what the beat must say (the check that the cuts have not moved). Everything else
// replaces the imported kinetic captions: block, props, and a few beat settings.

const PICTURES = {
  // Host. The question is on screen from the first frame (the hook), over the film's object: a jar.
  s001: {
    words: "Welcome back to Money at Work. I'm Maya.",
    props: {
      elements: [
        text('kicker', 'MONEY AT WORK', 540, 230, 42, { fill: 'accent2', tracking: 0.16, at: 0, enter: 'none' }),
        text('q1', 'How much cash', 540, 400, 108, { at: 0, enter: 'none', fit: 860 }),
        text('q2', 'should you keep?', 540, 520, 108, { fill: 'accent', at: 0, enter: 'none', fit: 860 }),
        ...jar('jar-b', { ...BIG, show: { say: 'Welcome', enter: 'rise', dur: 0.6 } }),
      ],
    },
  },
  // Host. The question arrives every week (bubbles pile up), the cash goes in, and the level the
  // question asks about searches up and down the jar.
  s002: {
    words: 'Today, one question we get every single week: how much cash should you actually keep around?',
    props: {
      elements: [
        text('kicker', 'MONEY AT WORK', 540, 230, 42, { fill: 'accent2', tracking: 0.16 }),
        text('q1', 'How much cash', 540, 400, 108, { fit: 860 }),
        text('q2', 'should you keep?', 540, 520, 108, { fill: 'accent', fit: 860 }),
        ...jar('jar-b', { ...BIG, level: 0.3, fillShow: { say: 'cash', enter: 'grow-y', dur: 0.8 } }),
        bubble('ask-1', 880, 800, 1, 'question'),
        bubble('ask-2', 195, 900, -1, 'every'),
        bubble('ask-3', 885, 1010, 1, 'single'),
        bubble('ask-4', 190, 1120, -1, 'week'),
        { type: 'line', id: 'level', x1: 300, y1: 1121, x2: 780, y2: 1121, stroke: 'accent', width: 6, dash: [18, 12], say: 'should', enter: 'draw', dur: 0.35,
          keys: [{ say: 'keep', y: -230, dur: 0.9, ease: 'thereAndBack' }] },
      ],
    },
  },
  // Guest. "More than most people have, less than some people hoard": three jars, three levels.
  s003: {
    words: 'And the honest answer is, more than most people have, and less than some people hoard.',
    props: { elements: jarsOfTheAnswer('build') },
  },
  // Host. Short poster type; the answer's jar opens.
  s004: {
    words: 'Okay, unpack that.',
    props: {
      elements: [
        text('unpack', 'Unpack that.', 540, 300, 116, { say: 'unpack', enter: 'rise' }),
        ...jarsOfTheAnswer().map(el =>
          el.id === 'jar-b-lid'
            ? { ...el, keys: [{ say: 'unpack', y: -70, rotate: -16, dur: 0.5, ease: 'overshoot' }] }
            : /^(jar-a|jar-c|spill|lab-a|lab-c)/.test(el.id)
              ? { ...el, keys: [{ say: 'unpack', opacity: 0.25, dur: 0.5 }] }
              : el,
        ),
      ],
    },
  },
  // Guest. The cast of the film: calendar pages that count months. Three, then six.
  s005: {
    words: 'So the rule of thumb is three to six months of essential expenses.',
    props: {
      source: SAM,
      elements: [
        ...slots(),
        text('rule', 'RULE OF THUMB', 540, 215, 44, { fill: 'muted', tracking: 0.16, at: 0, enter: 'none' }),
        text('n3', '3', 245, 430, 210, { font: 'figures', fill: 'accent2', say: 'three', enter: 'rise' }),
        text('to', 'to', 390, 430, 72, { fill: 'muted', font: 'semibold', say: 'to', enter: 'fade' }),
        text('n6', '6', 525, 430, 210, { font: 'figures', fill: 'accent', say: 'six', enter: 'rise' }),
        text('months', 'months', 610, 430, 92, { anchor: 'start', say: 'months', enter: 'rise' }),
      ],
      cast: {
        objects: [
          ...['m1', 'm2', 'm3'].map(id => ({ id, shape: 'calendar', color: 'accent2', size: 240, enter: 'pop' })),
          ...['m4', 'm5', 'm6'].map(id => ({ id, shape: 'calendar', color: 'surface', size: 240, enter: 'pop' })),
        ],
        formations: [
          { form: 'row', ids: ['m1', 'm2', 'm3'], center: [540, 680], say: 'three', stagger: 0.08 },
          { form: 'row', ids: ['m4', 'm5', 'm6'], center: [540, 950], say: 'six', stagger: 0.08 },
        ],
      },
    },
  },
  // Guest. Not the paycheck (crossed out): what a month costs. Each essential lands on its word.
  s006: {
    words: 'Not your salary. Rent, groceries, insurance, the car.',
    props: {
      source: SAM,
      elements: [
        ...slots(),
        text('rule', 'RULE OF THUMB', 540, 215, 44, { fill: 'muted', tracking: 0.16 }),
        text('n3', '3', 245, 430, 210, { font: 'figures', fill: 'accent2' }),
        text('to', 'to', 390, 430, 72, { fill: 'muted', font: 'semibold' }),
        text('n6', '6', 525, 430, 210, { font: 'figures', fill: 'accent' }),
        text('months', 'months', 610, 430, 92, { anchor: 'start' }),
        text('each', 'EACH MONTH', 540, 1135, 40, { fill: 'muted', tracking: 0.14, say: 'groceries', enter: 'fade' }),
      ],
      cast: {
        objects: [
          { id: 'pay', shape: 'paycheck', color: 'surface', size: 250, enter: 'pop' },
          { id: 'rent', icon: 'home', color: 'ink', size: 150, enter: 'pop' },
          { id: 'food', icon: 'shopping-cart', color: 'ink', size: 150, enter: 'pop' },
          { id: 'cover', icon: 'umbrella', color: 'ink', size: 150, enter: 'pop' },
          { id: 'car', icon: 'car', color: 'ink', size: 150, enter: 'pop' },
        ],
        formations: [
          { form: 'row', ids: ['pay'], center: [540, 1250], at: 0 },
          { form: 'mark', mark: 'cross', ids: ['pay'], say: 'salary' },
          { form: 'exit', ids: ['pay'], say: 'Rent' },
          { form: 'row', ids: ['rent'], center: [205, 1250], say: 'Rent' },
          { form: 'row', ids: ['food'], center: [428, 1250], say: 'groceries' },
          { form: 'row', ids: ['cover'], center: [652, 1250], say: 'insurance' },
          { form: 'row', ids: ['car'], center: [875, 1250], say: 'the' },
        ],
      },
    },
  },
  // Guest. Sam's range, two bars that grow on their words.
  s007: {
    words: "For a lot of people that's maybe twelve to eighteen thousand dollars.",
    props: {
      source: SAM,
      elements: [
        text('dollars', '3 to 6 months, in dollars', 540, 300, 60, { fill: 'muted', font: 'semibold', at: 0, enter: 'none', fit: 860 }),
        // The six calendar pages, small: the months become the dollars below them.
        ...[0, 1, 2, 3, 4, 5].map(i => ({ type: 'icon', id: `mini-${i}`, name: 'calendar', x: 290 + i * 100, y: 400, size: 70, stroke: i < 3 ? 'accent2' : 'muted', at: 0.05 * i, enter: 'pop', dur: 0.3 })),
      ],
      chart: {
        kind: 'bars',
        prefix: '$',
        box: [150, 560, 780, 620],
        values: [
          { label: 'Low end', value: 12000, say: 'twelve' },
          { label: 'High end', value: 18000, say: 'eighteen', highlight: true },
        ],
      },
    },
  },
  // Host. The same bars, and her reaction as short poster type.
  s008: {
    words: "That sounds like a lot when you're starting out.",
    props: {
      source: SAM,
      elements: [
        // A 2.3 s line: on screen from the start so it can be read (a cue on "lot" would stretch the beat).
        text('alot', 'Sounds like a lot', 540, 330, 96, { at: 0.15, enter: 'rise', fit: 860 }),
      ],
      chart: {
        kind: 'bars',
        prefix: '$',
        box: [150, 560, 780, 620],
        values: [
          { label: 'Low end', value: 12000 },
          { label: 'High end', value: 18000, highlight: true },
        ],
      },
    },
  },
  // Guest. The calendars come back: a month's costs fold into the first; months two to six are
  // crossed out on "six".
  s009: {
    words: "It is. So don't start with six months.",
    props: {
      source: SAM,
      elements: [
        ...slots(),
        text('n6', '6 months', 540, 430, 120, { fill: 'accent', say: "don't", enter: 'rise' }),
        { type: 'line', id: 'n6-strike', x1: 300, y1: 392, x2: 780, y2: 392, stroke: 'ink', width: 12, cap: 'round', say: 'six', enter: 'draw', dur: 0.4 },
      ],
      cast: {
        formations: [
          { form: 'merge', ids: ['rent', 'food', 'cover', 'car'], into: 'm1', at: 0.2, stagger: 0.08 },
          { form: 'mark', mark: 'cross', ids: ['m2', 'm3', 'm4', 'm5', 'm6'], say: 'six', stagger: 0.03 },
        ],
      },
    },
  },
  // Guest. One month steps forward; a car repair is a crisis, then only an annoyance.
  s010: {
    words: 'Start with one. One month turns a car repair from a crisis into an annoyance.',
    props: {
      source: SAM,
      elements: [text('one-month', 'One month', 540, 960, 100, { fill: 'accent2', say: 'one', after: 0.3, enter: 'rise' })],
      cast: {
        objects: [
          { id: 'crisis', word: 'Crisis', color: 'accent', size: 210, enter: 'pop' },
          { id: 'annoy', word: 'Annoyance', color: 'surface', size: 210, enter: 'pop' },
        ],
        formations: [
          { form: 'exit', ids: ['m2', 'm3', 'm4', 'm5', 'm6'], at: 0.1, stagger: 0.05 },
          { form: 'hero', ids: ['m1'], hero: 'm1', center: [540, 600], say: 'one' },
          { form: 'row', ids: ['car'], center: [260, 1240], say: 'car' },
          { form: 'row', ids: ['crisis'], center: [720, 1240], say: 'crisis' },
          { form: 'swap', out: 'crisis', in: 'annoy', say: 'into' },
        ],
      },
    },
  },
  // Host. The one kinetic line: the host repeats the guest's line, so it is the one to remember.
  s011: {
    words: 'I like that. Crisis into annoyance.',
    block: 'kinetic',
    transition: 'fade',
    tone: 'accent',
    props: { mode: 'stack', align: 'center', emphasis: ['Crisis', 'annoyance'], upper: false },
  },
  // Guest. The chapter turn: back to the three jars; the ring moves from too little to too much.
  s012: {
    words: 'Right. And then the second thing, where people go wrong, is the opposite.',
    props: {
      elements: [
        text('second', 'THE SECOND THING', 540, 330, 46, { fill: 'muted', tracking: 0.14, say: 'second', enter: 'fade' }),
        ...jarsOfTheAnswer().map(el => ({ ...el, at: 0, enter: 'none' })),
        { type: 'ellipse', id: 'ring', cx: 220, cy: 780, rx: 160, ry: 258, fill: 'none', stroke: 'accent', width: 9, say: 'thing', enter: 'draw', dur: 0.45,
          keys: [{ say: 'is', x: 640, dur: 0.6, ease: 'inOut' }] },
      ],
    },
  },
  // Guest. The overflowing jar comes forward: $40,000 in checking, a pile of 100 coins, a lock.
  s013: {
    words: 'They keep forty thousand dollars in a checking account earning nothing, because it feels safe.',
    props: {
      source: SAM,
      elements: [
        // The other two jars clear away as the third comes forward.
        ...jarsOfTheAnswer().filter(el => !/^(jar-c|ring)/.test(el.id)).map(el => ({ ...el, at: 0, enter: 'none', exitAt: 0.1, exit: 'fade', exitDur: 0.35 })),
        ...jar('jar-c', { ...CHECK, level: 1, fillShow: { exitSay: 'thousand', exit: 'fade', exitDur: 0.5 } }),
        ...PILE.map(c => coin(`coin-${c.n}`, c.x, c.y, 15, { say: 'forty', after: r(c.n * 0.007 * 100) / 100, enter: 'drop', dur: 0.35, dist: 220 })),
        { type: 'rect', id: 'tag', x: 390, y: 650, w: 300, h: 76, r: 14, fill: 'bg', stroke: 'ink', width: 4, say: 'checking', enter: 'pop' },
        text('tag-t', 'CHECKING', 540, 703, 42, { tracking: 0.08, say: 'checking', enter: 'pop' }),
        text('fig', '$40,000', 540, 330, 156, { font: 'figures', say: 'forty', enter: 'rise', count: { from: 0, to: 40000, prefix: '$', dur: 0.9 } }),
        text('nothing', 'earning nothing', 540, 1320, 56, { fill: 'accent', say: 'earning', enter: 'rise' }),
        ...badge('lock', 760, 625, 'lock', 'positive', { say: 'safe', enter: 'pop' }),
      ],
    },
  },
  // Host. One second: the lock wobbles, a question mark lands.
  s014: {
    words: "And it isn't?",
    props: {
      source: SAM,
      elements: [
        ...jar('jar-c', { ...CHECK }),
        ...PILE.map(c => coin(`coin-${c.n}`, c.x, c.y, 15)),
        { type: 'rect', id: 'tag', x: 390, y: 650, w: 300, h: 76, r: 14, fill: 'bg', stroke: 'ink', width: 4 },
        text('tag-t', 'CHECKING', 540, 703, 42, { tracking: 0.08 }),
        text('fig', '$40,000', 540, 330, 156, { font: 'figures' }),
        text('nothing', 'earning nothing', 540, 1320, 56, { fill: 'accent' }),
        ...badge('lock', 760, 625, 'lock', 'positive', {}, { keys: [{ say: "isn't", rotate: 16, dur: 0.6, ease: 'wiggle' }], origin: [760, 625] }),
        text('isnt', '?', 900, 610, 170, { fill: 'accent', at: 0.35, enter: 'pop' }),
      ],
    },
  },
  // Guest. Safe from the market (a tick), not safe from prices going up (a cross).
  s015: {
    words: "It's safe from the stock market. It's not safe from prices going up.",
    props: {
      source: SAM,
      elements: [
        ...jar('jar-c', { ...CHECK }),
        ...PILE.map(c => coin(`coin-${c.n}`, c.x, c.y, 15)),
        { type: 'rect', id: 'tag', x: 390, y: 650, w: 300, h: 76, r: 14, fill: 'bg', stroke: 'ink', width: 4 },
        text('tag-t', 'CHECKING', 540, 703, 42, { tracking: 0.08 }),
        text('fig', '$40,000', 540, 330, 156, { font: 'figures' }),
        ...badge('lock2', 760, 625, 'lock', 'positive'),
        // Left: the market, wild but held off.
        { type: 'path', id: 'market', d: 'M 72 930 L 118 860 L 160 900 L 205 800 L 248 870 L 300 770', fill: 'none', stroke: 'ink', width: 7, join: 'round', cap: 'round', say: 'stock', enter: 'draw', dur: 0.7 },
        text('market-l', 'Stock market', 186, 1010, 44, { width: 250, leading: 1.05, say: 'stock', enter: 'fade' }),
        ...badge('tick', 186, 700, 'check', 'positive', { say: 'market', enter: 'pop' }),
        // Right: prices, climbing.
        { type: 'path', id: 'prices', d: 'M 790 960 L 850 905 L 900 925 L 985 790', fill: 'none', stroke: 'accent', width: 9, join: 'round', cap: 'round', arrow: 'end', head: 26, say: 'prices', enter: 'draw', dur: 0.6 },
        text('prices-l', 'Prices', 890, 1040, 50, { fill: 'accent', say: 'prices', enter: 'fade' }),
        ...badge('cross', 890, 700, 'close', 'negative', { say: 'going', enter: 'pop' }),
      ],
    },
  },
  // Guest. What the pile buys: three coins in every hundred go grey each year (3% a year).
  s016: {
    words: 'If prices rise three percent a year, that pile buys about three percent less every year it sits there.',
    props: {
      source: SAM,
      elements: [
        ...jar('jar-c', { ...CHECK }),
        ...PILE.map(c => coin(`coin-${c.n}`, c.x, c.y, 15,
          LOST.has(c.n) ? { keys: [{ say: ['less', 'every', 'sits'][FADED.findIndex(g => g.includes(c.n))], after: 0.2 + (c.n % 3) * 0.08, opacity: 0.12, scale: 0.8, dur: 0.4 }] } : {})),
        { type: 'rect', id: 'tag', x: 390, y: 650, w: 300, h: 76, r: 14, fill: 'bg', stroke: 'ink', width: 4 },
        text('tag-t', 'CHECKING', 540, 703, 42, { tracking: 0.08 }),
        // What the pile buys, in today's money: it counts down from $40,000 to $36,500 (3% less a
        // year for three years: 40,000 x 0.97^3) while three coins in every hundred go grey a year.
        text('fig', '$40,000', 540, 330, 156, { font: 'figures', exitSay: 'less', exit: 'fade', exitDur: 0.15 }),
        text('fig-3', '$36,500', 540, 330, 156, { font: 'figures', fill: 'accent', say: 'less', enter: 'none', count: { from: 40000, to: 36500, prefix: '$', dur: 1.5 } }),
        text('buys-0', 'what it buys today', 540, 420, 48, { fill: 'muted', font: 'semibold', say: 'pile', enter: 'fade', dur: 0.3, exitSay: 'less', exit: 'fade', exitDur: 0.2 }),
        text('buys-3', 'what it buys after 3 years', 540, 420, 48, { fill: 'accent', font: 'semibold', say: 'less', after: 0.2, enter: 'fade', dur: 0.3 }),
        text('rise', 'prices +3% a year', 540, 1320, 56, { fill: 'accent', say: 'three', enter: 'rise' }),
      ],
    },
  },
  // Host. Poster question; the checking jar moves aside and an empty place waits beside it.
  s017: {
    words: 'So where should the emergency money live?',
    props: {
      elements: [
        text('where1', 'Where should', 540, 290, 112, { say: 'where', enter: 'rise' }),
        text('where2', 'it live?', 540, 410, 112, { fill: 'accent', say: 'where', after: 0.15, enter: 'rise' }),
        ...jar('jar-c', { ...LEFT }),
        ...PILE.filter(c => c.row < 9).map(c => { const p = pileAt(c); return coin(`coin-${c.n}`, p.x, p.y, 11); }),
        { type: 'rect', id: 'tag', x: 150, y: 735, w: 240, h: 64, r: 12, fill: 'bg', stroke: 'ink', width: 4 },
        text('tag-t', 'CHECKING', 270, 780, 36, { tracking: 0.06 }),
        { type: 'rect', id: 'empty', x: RIGHT.cx - RIGHT.w / 2, y: RIGHT.bottom - RIGHT.h, w: RIGHT.w, h: RIGHT.h, r: r(RIGHT.w * 0.16), fill: 'none', stroke: 'muted', width: 6, dash: [22, 16], say: 'emergency', enter: 'draw', dur: 0.6 },
        text('empty-q', '?', RIGHT.cx, 990, 190, { fill: 'muted', at: 1.9, enter: 'pop' }),
      ],
    },
  },
  // Guest. Boring (a plain jar), separate (the fund moves and a wall goes up), paying interest.
  s018: {
    words: 'Somewhere boring, separate, and paying interest.',
    props: { elements: twoJars('separate') },
  },
  // Guest. The plain jar gets its name, and a tick.
  s019: {
    words: 'A high yield savings account is fine.',
    props: { elements: twoJars('named') },
  },
  // Guest. Why separate matters: money left in checking flies off into a Tuesday's shopping.
  s020: {
    words: "Separate matters more than people think, because if it's in your checking account, you'll spend it on a Tuesday.",
    props: { elements: twoJars('spend') },
  },
  // Host. The line worth repeating goes on a mug: the words first, then the mug draws round them.
  s021: {
    words: "Spend it on a Tuesday. That's going on a mug.",
    props: mug({ build: true }),
  },
  // Host and guest. The mug stays; the two things to remember land under it.
  s022: {
    words: 'Sam, thank you.',
    props: mug({ build: false, lines: [{ at: 0.35 }] }),
  },
  s023: {
    words: 'Anytime.',
    pace: 'hold',
    hold: 1.5,
    props: mug({ build: false, lines: [{}, { say: 'Anytime' }] }),
  },
};

/**
 * The checking jar beside a savings jar (s018–s020). Each stage keeps the last one's picture (same
 * ids, so the cuts are invisible) and adds its own moves: `separate` moves the emergency fund over
 * and puts up a wall, `named` names the savings jar, `spend` sends money from checking to a cart.
 * The savings jar is drawn before any coin so the coins that land in it stay in front of its glass.
 */
function twoJars(stage) {
  const on = (where, cue) => (stage === where ? cue : {});
  const named = stage !== 'separate';
  const kept = PILE.filter(c => c.row < 9 && !(named && MOVED.includes(c)));
  return [
    ...jar('jar-c', { ...LEFT }),
    ...(named ? [] : [{ type: 'rect', id: 'empty', x: RIGHT.cx - RIGHT.w / 2, y: RIGHT.bottom - RIGHT.h, w: RIGHT.w, h: RIGHT.h, r: r(RIGHT.w * 0.16), fill: 'none', stroke: 'muted', width: 6, dash: [22, 16], exitSay: 'boring', exit: 'fade', exitDur: 0.3 }]),
    ...jar('jar-s', { ...RIGHT, lid: 'muted', show: on('separate', { say: 'boring', enter: 'fade', dur: 0.4 }) }),
    ...kept.map(c => {
      const p = pileAt(c);
      if (stage === 'separate' && MOVED.includes(c)) {
        const q = movedTo(c);
        return coin(`coin-${c.n}`, p.x, p.y, 11, { keys: [{ say: 'separate', after: r((c.n - 50) * 0.012 * 100) / 100, x: q.x - p.x, y: q.y - p.y, dur: 0.55, ease: 'inOut' }] });
      }
      // Five coins from the everyday jar fly up into a Tuesday's shopping cart.
      const spent = stage === 'spend' && c.row === 4 && c.col >= 3 && c.col <= 7;
      return coin(`coin-${c.n}`, p.x, p.y, 11, spent ? { keys: [
        { say: 'spend', after: (c.col - 3) * 0.1, x: 270 - p.x, y: 380 - p.y, scale: 0.6, dur: 0.6, ease: 'inOut' },
        { say: 'spend', after: 0.6 + (c.col - 3) * 0.1, opacity: 0, dur: 0.15 }] } : {});
    }),
    ...(named ? MOVED.map(c => { const q = movedTo(c); return coin(`saved-${c.n}`, q.x, q.y, 11); }) : []),
    { type: 'rect', id: 'tag', x: 150, y: 735, w: 240, h: 64, r: 12, fill: 'bg', stroke: 'ink', width: 4 },
    text('tag-t', 'CHECKING', 270, 780, 36, { tracking: 0.06 }),
    { type: 'rect', id: 'wall', x: 536, y: 600, w: 8, h: 600, r: 4, fill: 'ink', origin: [540, 900],
      ...on('separate', { say: 'separate', after: 0.55, enter: 'grow-y', dur: 0.5 }), ...on('spend', { keys: [{ say: 'matters', scaleX: 3.5, dur: 0.7, ease: 'thereAndBack' }] }) },
    ...[[760, 1130], [810, 1118], [860, 1130]].map(([x, y], i) => coin(`int-${i}`, x, y - 112, 11, { fill: 'positive', ...on('separate', { say: 'interest', after: i * 0.12, enter: 'drop', dur: 0.35 }) })),
    // "+ interest" stays on screen through the next two beats, so it is cued by time here.
    text('int-t', '+ interest', RIGHT.cx, 610, 52, { fill: 'positive', ...on('separate', { at: 1.85, enter: 'rise' }) }),
    ...(named ? [
      { type: 'rect', id: 'stag', x: 690, y: 735, w: 240, h: 64, r: 12, fill: 'bg', stroke: 'accent2', width: 4, ...on('named', { say: 'savings', enter: 'pop' }) },
      text('stag-t', 'SAVINGS', 810, 780, 36, { tracking: 0.06, fill: 'accent2', ...on('named', { say: 'savings', enter: 'pop' }) }),
      text('hy', 'high-yield', RIGHT.cx, 1235, 48, { fill: 'accent2', font: 'semibold', ...on('named', { say: 'high', enter: 'rise' }) }),
      text('ck', 'everyday', LEFT.cx, 1235, 48, { fill: 'muted', font: 'semibold', ...on('named', { say: 'high', enter: 'rise' }) }),
      ...badge('fine', 960, 700, 'check', 'positive', on('named', { say: 'is', enter: 'pop' })),
    ] : []),
    ...(stage === 'spend' ? [
      { type: 'ellipse', id: 'ring', cx: LEFT.cx, cy: 905, rx: 200, ry: 285, fill: 'none', stroke: 'accent', width: 8, say: 'checking', enter: 'draw', dur: 0.45 },
      { type: 'icon', id: 'cart', name: 'shopping-cart', x: 270, y: 370, size: 170, stroke: 'accent', say: 'spend', enter: 'pop' },
      text('tuesday', 'Tuesday', 270, 540, 66, { fill: 'accent', say: 'Tuesday', enter: 'rise' }),
    ] : []),
  ];
}

/** The mug: "Spend it on a Tuesday" printed on it. `lines` adds the two takeaways under it. */
function mug({ build, lines = [] }) {
  const cue = (say, extra = {}) => (build ? { say, ...extra } : {});
  const takeaways = [
    ['take-1', 'Start with one month.', 'ink'],
    ['take-2', 'Keep it separate.', 'accent2'],
  ];
  return {
    // The closing lines are Sam's advice and one of them is a figure ("one month"): attribute it.
    ...(lines.length ? { source: SAM } : {}),
    elements: [
      ...(build ? [] : [text('show', 'MONEY AT WORK', 540, 300, 42, { fill: 'accent2', tracking: 0.16, ...(lines.length === 1 ? { at: 0.2, enter: 'fade' } : {}) })]),
      { type: 'rect', id: 'mug-fill', x: 260, y: 600, w: 480, h: 520, r: 40, fill: 'surface', ...cue('Spend', { enter: 'fade', dur: 0.4 }) },
      text('mug-1', 'Spend it', 500, 770, 86, { ...cue('Spend', { enter: 'type', dur: 0.4 }) }),
      text('mug-2', 'on a', 500, 850, 58, { font: 'serif-italic', fill: 'muted', ...cue('on', { enter: 'fade', dur: 0.3 }) }),
      text('mug-3', 'Tuesday.', 500, 965, 96, { fill: 'accent', fit: 370, ...cue('Tuesday', { enter: 'rise', dur: 0.4 }) }),
      { type: 'rect', id: 'mug-line', x: 260, y: 600, w: 480, h: 520, r: 40, fill: 'none', stroke: 'ink', width: 12, ...cue('going', { enter: 'draw', dur: 0.5 }) },
      { type: 'path', id: 'mug-handle', d: 'M 742 700 C 905 700 905 1000 742 1000', fill: 'none', stroke: 'ink', width: 30, cap: 'round', ...cue('mug', { enter: 'draw', dur: 0.35 }) },
      ...[400, 500, 600].map((x, i) => ({ type: 'path', id: `steam-${i}`, d: `M ${x} 560 C ${x - 30} 525 ${x + 30} 495 ${x} 455`, fill: 'none', stroke: 'muted', width: 8, cap: 'round',
        ...(build ? { say: 'mug', after: 0.1 + i * 0.08, enter: 'draw', dur: 0.4 } : {}), loop: { type: 'float', period: 2.4 + i * 0.3, amount: 10 } })),
      ...takeaways.flatMap(([id, t, fill], i) => (lines[i] ? [text(id, t, 540, 1250 + i * 92, 64, { fill, ...(lines[i].say ? { say: lines[i].say, enter: 'rise' } : lines[i].at != null ? { at: lines[i].at, enter: 'rise' } : {}) })] : [])),
    ],
  };
}

// ------------------------------------------------------------------ 3. apply, checking the words

const norm = s => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const sb = JSON.parse(fs.readFileSync(board, 'utf8'));
const byId = new Map(sb.beats.map(b => [b.id, b]));
const moved = [];
for (const [id, pic] of Object.entries(PICTURES)) {
  const beat = byId.get(id);
  if (!beat) moved.push(`${id}: no such beat`);
  else if (norm(beat.vo) !== norm(pic.words)) moved.push(`${id}: says "${beat.vo}", the picture was made for "${pic.words}"`);
}
if (moved.length) {
  console.error(`The import's cuts moved; no picture was changed. Map the pictures to the new beats by hand:\n  ${moved.join('\n  ')}`);
  process.exit(1);
}

// "Sam, on air" goes on the speaker chip's row, right-aligned: the engine's own source line sits
// just above the pop captions and collides with a two-line caption. As a `sourceElement` it is a
// static ink line that the frame audit still checks.
// Its id is the beat's own, so it does not morph across cuts (a morph links the two beats).
const onAir = (id, { source, sourceSize, ...props }) => (source == null ? props : {
  ...props,
  sourceElement: `on-air-${id}`,
  elements: [...(props.elements ?? []), text(`on-air-${id}`, source, 955, 1547, 36, { anchor: 'end', font: 'semibold', at: 0, enter: 'none' })],
});

for (const [id, { words, block = 'canvas', props, ...beatSettings }] of Object.entries(PICTURES)) {
  const beat = byId.get(id);
  beat.block = block;
  beat.props = block === 'canvas' ? onAir(id, props) : props;
  // A re-run starts from the import's settings, then applies this beat's own.
  for (const k of ['transition', 'tone', 'pace', 'hold']) delete beat[k];
  Object.assign(beat, beatSettings);
}
sb.title = 'How much cash should you keep?';
sb.sources = [
  ...sb.sources.filter(s => s.id !== 'sam'),
  {
    id: 'sam',
    claim: 'Three to six months of essential expenses; about $12,000 to $18,000 for a lot of people; $40,000 in checking; prices rising 3% a year (and what that pile buys after one, two and three years, at 3% less each year)',
    source: 'Sam (guest), Money at Work: his rules of thumb, said on air',
  },
];
fs.writeFileSync(board, JSON.stringify(sb, null, 1) + '\n');

const drawn = Object.values(PICTURES).filter(p => (p.block ?? 'canvas') === 'canvas').length;
console.log(`gave ${drawn} of ${sb.beats.length} beats a picture (${Object.keys(PICTURES).length - drawn} kinetic line) in ${rel(board)}

next:
  clearframe draft ${rel(out)}        critique, check, sheet, draft MP4 and the motion verdict
  open ${rel(out)}/build/sheet.png ${rel(out)}/build/qa/phone.png`);
