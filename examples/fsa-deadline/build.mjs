#!/usr/bin/env node
// Writes storyboard-landscape.json and storyboard-vertical.json for the fsa-deadline example: a
// benefits film whose evidence is the plan document itself (a `document` that scrolls to the
// clause the voice reads and marks it) and whose step is done in the app by a `pointer` that
// presses each control by id. Everything (Kestrel, the plan, the figures) is fictional.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const PLAN = 'Kestrel flexible spending account plan document, 2027 (fictional)';

/** A button: a rounded box with its label, as one group the pointer can press by id. */
const button = (id, x, y, w, h, label, { fill = 'surface', ink = 'ink', size = 34 } = {}) => ({
  type: 'group',
  id,
  x,
  y,
  at: 0,
  enter: 'none',
  children: [
    { type: 'rect', x: 0, y: 0, w, h, r: h * 0.22, fill, stroke: fill === 'surface' ? 'muted' : 'none', width: 2 },
    { type: 'text', text: label, x: w / 2, y: h * 0.64, size, anchor: 'middle', font: 'strong', fill: ink },
  ],
});

function film(vertical) {
  const [W, H] = vertical ? [1080, 1920] : [1920, 1080];
  // The app: a window (or a phone screen) with a menu, the claims panel and Submit.
  const app = vertical
    ? { x: 90, y: 300, w: 900, h: 1180 }
    : { x: 230, y: 150, w: 1460, h: 760 };
  const col = vertical ? [app.x + 50, app.x + 50] : [app.x + 50, app.x + 450];
  const appElements = [
    { type: 'rect', ...app, r: 28, fill: 'bg', stroke: 'muted', width: 2, at: 0, enter: 'none' },
    { type: 'text', text: 'Kestrel Hub', x: app.x + 50, y: app.y + 82, size: 42, font: 'display', fill: 'ink', at: 0, enter: 'none' },
    button('benefits', col[0], app.y + 140, vertical ? 380 : 330, 84, 'Benefits'),
    button('pay', vertical ? col[0] + 420 : col[0], vertical ? app.y + 140 : app.y + 250, vertical ? 380 : 330, 84, 'Pay'),
    button('claims', vertical ? col[0] : col[1], vertical ? app.y + 270 : app.y + 140, vertical ? 800 : 420, 84, 'Claims'),
    // The claim being made: the receipt is real, so it is named.
    {
      type: 'group',
      id: 'receipt',
      x: vertical ? col[0] : col[1],
      y: vertical ? app.y + 420 : app.y + 270,
      say: 'Claims',
      after: 0.35,
      enter: 'rise',
      children: [
        { type: 'rect', x: 0, y: 0, w: vertical ? 800 : 860, h: 150, r: 20, fill: 'surface' },
        { type: 'icon', name: 'receipt', x: 70, y: 75, size: 64, stroke: 'accent2' },
        { type: 'text', text: 'Optician receipt', x: 130, y: 66, size: 34, font: 'strong', fill: 'ink' },
        { type: 'text', text: 'Glasses, $210', x: 130, y: 112, size: 30, fill: 'muted' },
      ],
    },
    button('submit', app.x + app.w - (vertical ? 450 : 410), app.y + app.h - (vertical ? 160 : 140), vertical ? 400 : 360, 90, 'Submit', { fill: 'accent', ink: 'bg' }),
    {
      type: 'text',
      text: 'Claim sent',
      x: app.x + app.w - (vertical ? 450 : 410) - 40,
      y: app.y + app.h - (vertical ? 100 : 80),
      size: 34,
      anchor: 'end',
      font: 'strong',
      fill: 'positive',
      say: 'Submit',
      after: 0.45,
      enter: 'rise',
    },
    {
      type: 'pointer',
      steps: [
        { to: 'benefits', say: 'Benefits' },
        { to: 'claims', say: 'Claims' },
        { to: 'receipt', say: 'receipt', point: [0.8, 0.6] },
        { to: 'submit', say: 'Submit' },
      ],
    },
  ];
  // The page stops above the source line and the caption band.
  const doc = vertical ? { x: 90, y: 230, w: 900, h: 1160 } : { x: 420, y: 60, w: 1080, h: 780 };
  return {
    version: 2,
    title: 'Your FSA: claim it before December 31',
    format: { preset: vertical ? 'vertical' : 'landscape', fps: 30 },
    treatment: 'workplace',
    theme: 'meridian',
    type: 'geometric',
    motion: { preset: 'snappy', intensity: 0.6 },
    transition: 'cut',
    backdrop: 'none',
    texture: { grain: 0.05 },
    sfx: 'subtle',
    music: false,
    voice: { style: 'warm, plain, a little playful' },
    sources: [
      {
        id: 'plan',
        claim: 'Up to $640 of unused FSA money carries over; anything above it not claimed is forfeited at the end of the plan year, December 31; claims are made in Kestrel Hub',
        source: PLAN,
      },
    ],
    beats: [
      {
        id: 'stakes',
        block: 'canvas',
        vo: 'You have three thousand two hundred dollars in your flexible spending account. On December thirty-first, only six hundred forty carries over. The rest is gone.',
        props: {
          sketch: 'expire',
          sketchParams: { total: 5, keep: 1, each: 640, prefix: '$' },
          sketchText: { KEEP: 'carries into next year', LOSE: 'is gone', YEAREND: 'Dec 31' },
          sketchSay: { FILL: 'thousand', YEAREND: 'December', KEEP: 'carries' },
          source: PLAN,
        },
      },
      {
        id: 'plan',
        block: 'canvas',
        vo: 'It is all in your plan document. Up to six hundred forty dollars carries over. Anything above that you have not claimed is forfeited at the end of the plan year.',
        props: {
          source: PLAN,
          elements: [
            {
              type: 'document',
              ...doc,
              kicker: 'Kestrel benefits',
              title: 'Flexible spending account',
              size: vertical ? 34 : 30,
              at: 0,
              enter: 'none',
              sections: [
                { heading: 'What it covers', text: 'Medical, dental and vision costs your health plan does not pay: copays, glasses, prescriptions and more.' },
                { heading: 'How to claim', text: 'Upload the receipt in Kestrel Hub within 90 days of the expense. Most claims are paid in five working days.' },
                { heading: 'Who can use it', text: 'Any employee who enrolls during open enrollment, within 30 days of starting, or after a qualifying life event such as a birth or a move.' },
                { heading: 'Carryover', text: 'Up to 640 dollars of unused money carries over into next year.' },
                { heading: 'The deadline', text: 'Anything above the carryover that you have not claimed is forfeited at the end of the plan year, on December 31.' },
              ],
              scroll: [{ to: 'Carryover', say: 'Up' }, { to: 'The deadline', say: 'Anything' }],
              marks: [
                { words: '640 dollars', style: 'circle', say: 'forty' },
                { words: 'forfeited at the end of the plan year', style: 'highlight', say: 'forfeited' },
              ],
            },
          ],
        },
      },
      {
        id: 'claim',
        block: 'canvas',
        vo: 'So claim it before then. Open Benefits, choose Claims, add your receipt, and press Submit.',
        props: { source: PLAN, elements: appElements },
      },
      {
        id: 'close',
        block: 'kinetic',
        vo: 'Claim it by December thirty-first.',
        props: { mode: 'stack', align: 'center', emphasis: ['December', 'thirty-first'], source: '' },
      },
    ],
  };
}

for (const [name, vertical] of [['landscape', false], ['vertical', true]])
  fs.writeFileSync(path.join(here, `storyboard-${name}.json`), `${JSON.stringify(film(vertical), null, 2)}\n`);
console.log('wrote storyboard-landscape.json and storyboard-vertical.json');
