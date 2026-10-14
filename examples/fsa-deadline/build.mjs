#!/usr/bin/env node
// Writes storyboard-landscape.json and storyboard-vertical.json for the fsa-deadline example: a
// benefits film whose evidence is the plan document itself (a `document` that scrolls to the
// clause the voice reads and marks it) and whose step is done in the app by a `pointer` that
// presses each control by id. Everything (Kestrel, the plan, the figures) is fictional.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const PLAN = 'Kestrel flexible spending account plan document, 2027 (fictional)';

function film(vertical) {
  const [W, H] = vertical ? [1080, 1920] : [1920, 1080];
  // The receipt itself, and the app it goes into: a window (a phone on the tall frame) with its
  // tabs, a new claim with an upload slot, the amount, and Submit. The app names its parts
  // (hub-tab-claims, hub-upload, hub-button), so the pointer presses them by id; everything stays
  // above the caption band.
  const lines = {
    merchant: 'Clearview Optical',
    detail: 'Mar 3, 2027',
    items: [
      { qty: 1, name: 'Frames', price: 160 },
      { qty: 2, name: 'Lenses', price: 50 },
    ],
  };
  const appElements = [
    // The paper receipt stays on the desk; its total is boxed as the voice says "receipt".
    { type: 'receipt', id: 'receipt', ...(vertical ? { x: 348, y: 118, size: 24 } : { x: 170, y: 150, size: 30 }), ...lines, at: 0, enter: 'none', marks: [{ words: '$210.00', style: 'box', say: 'receipt' }] },
    {
      type: 'app',
      id: 'hub',
      ...(vertical ? { x: 200, y: 470, device: 'phone', w: 680 } : { x: 800, y: 110, w: 940 }),
      title: 'Kestrel Hub',
      tabs: ['Benefits', 'Claims'],
      heading: 'New claim',
      open: { say: 'Claims', after: 0.3 },
      // Its photo lands in the slot, and the amount is read off it.
      upload: { label: 'Add receipt', receipt: lines, say: 'receipt', after: 0.35 },
      fields: [
        { label: 'Amount', value: '$210.00', say: 'receipt', after: 0.75 },
        { label: 'Category', value: 'Vision' },
      ],
      button: { label: 'Submit', done: 'Claim sent', say: 'Submit' },
      at: 0,
      enter: 'none',
    },
    {
      type: 'pointer',
      steps: [
        { to: 'hub-tab-benefits', say: 'Benefits' },
        { to: 'hub-tab-claims', say: 'Claims' },
        { to: 'hub-upload', say: 'receipt', point: [0.5, 0.5] },
        { to: 'hub-button', say: 'Submit' },
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
        // From the rule to the step: the next screen arrives as the page leaves.
        transition: 'push',
        vo: 'So claim it before then. Open Benefits, choose Claims, add your receipt, and press Submit.',
        props: { source: PLAN, elements: appElements },
      },
      {
        id: 'close',
        block: 'canvas',
        vo: 'Claim it by December thirty-first.',
        // The film ends on the picture of its one date, not on a card of words.
        props: {
          sketch: 'deadline',
          sketchParams: { days: 31, firstWeekday: 3, start: 1, end: 31 },
          sketchText: { MONTH: 'December 2027', OPENS: 'Claim now', CLOSES: 'Last day to claim' },
          sketchSay: { OPEN: 'Claim', CLOSE: 'thirty-first' },
          source: PLAN,
        },
      },
    ],
  };
}

for (const [name, vertical] of [['landscape', false], ['vertical', true]])
  fs.writeFileSync(path.join(here, `storyboard-${name}.json`), `${JSON.stringify(film(vertical), null, 2)}\n`);
console.log('wrote storyboard-landscape.json and storyboard-vertical.json');
