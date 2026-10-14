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
  // The receipt itself, and the app it goes into: a window (a phone screen on the tall frame)
  // with its tabs, a new-claim panel with an upload slot, the amount, and Submit. Everything the
  // pointer presses has an id; everything stays above the caption band.
  const app = vertical ? { x: 90, y: 760, w: 900, h: 760 } : { x: 800, y: 110, w: 940, h: 690 };
  const pad = 48;
  const receiptAt = vertical ? { x: 300, y: 150 } : { x: 170, y: 150 };
  const slot = vertical
    ? { x: app.x + pad, y: app.y + 330, w: 330, h: 220 }
    : { x: app.x + pad, y: app.y + 300, w: 300, h: 230 };
  const shrink = 0.42;
  const field = { x: slot.x + slot.w + 40, w: app.x + app.w - pad - (slot.x + slot.w + 40) };
  const submit = { x: app.x + app.w - pad - 330, y: app.y + app.h - pad - 92, w: 330, h: 92 };
  const lines = {
    merchant: 'Clearview Optical',
    detail: 'Mar 3, 2027',
    items: [
      { qty: 1, name: 'Frames', price: 160 },
      { qty: 2, name: 'Lenses', price: 50 },
    ],
  };
  // The photo is the receipt at the size of an attachment, centred in the slot (its paper is
  // 16 lines wide and about 13 tall at this type size).
  const photo = { w: 30 * 16 * shrink, h: 395 * shrink };
  const appElements = [
    // The paper receipt stays on the desk; its total is boxed as the voice says "receipt".
    { type: 'receipt', id: 'receipt', ...receiptAt, size: 30, ...lines, at: 0, enter: 'none', marks: [{ words: '$210.00', style: 'box', say: 'receipt' }] },
    { type: 'rect', ...app, r: 30, fill: 'paper', shadow: true, at: 0, enter: 'none' },
    { type: 'text', text: 'Kestrel Hub', x: app.x + pad, y: app.y + 78, size: 40, font: 'display', fill: 'ink', at: 0, enter: 'none' },
    button('benefits', app.x + app.w - pad - 460, app.y + 32, 220, 72, 'Benefits', { size: 32 }),
    button('claims', app.x + app.w - pad - 220, app.y + 32, 220, 72, 'Claims', { size: 32 }),
    { type: 'line', x1: app.x, y1: app.y + 136, x2: app.x + app.w, y2: app.y + 136, stroke: 'line', width: 2, at: 0, enter: 'none' },
    // The new claim, opened by Claims.
    {
      type: 'group',
      say: 'Claims',
      after: 0.3,
      enter: 'rise',
      dist: 24,
      children: [
        { type: 'text', text: 'New claim', x: app.x + pad, y: app.y + 222, size: 44, font: 'strong', fill: 'ink' },
        { type: 'group', id: 'upload', children: [
          { type: 'rect', ...slot, r: 18, fill: 'none', stroke: 'muted', width: 3, dash: [12, 9] },
          { type: 'text', text: 'Add receipt', x: slot.x + slot.w / 2, y: slot.y + slot.h + 46, size: 30, anchor: 'middle', fill: 'muted' },
        ] },
        { type: 'text', text: 'Amount', x: field.x, y: slot.y + 30, size: 30, fill: 'muted' },
        { type: 'rect', x: field.x, y: slot.y + 52, w: field.w, h: 84, r: 14, fill: 'bg', stroke: 'line', width: 2 },
        { type: 'text', text: 'Category', x: field.x, y: slot.y + 182, size: 30, fill: 'muted' },
        { type: 'text', text: 'Vision', x: field.x + 26, y: slot.y + 232, size: 36, font: 'strong', fill: 'ink' },
      ],
    },
    // Its photo lands in the upload slot.
    {
      type: 'receipt',
      id: 'receipt-photo',
      x: Math.round(slot.x + (slot.w - photo.w) / 2),
      y: Math.round(slot.y + (slot.h - photo.h) / 2),
      size: 30,
      ...lines,
      scale: shrink,
      origin: [Math.round(slot.x + (slot.w - photo.w) / 2), Math.round(slot.y + (slot.h - photo.h) / 2)],
      say: 'receipt',
      after: 0.35,
      enter: 'pop',
    },
    // The amount is read off the receipt once it lands.
    { type: 'text', text: '$210.00', x: field.x + 26, y: slot.y + 108, size: 40, font: 'figures', fill: 'ink', say: 'receipt', after: 0.75, enter: 'type', dur: 0.45 },
    // Submit, pressed, becomes the confirmation in its place.
    { ...button('submit', submit.x, submit.y, submit.w, submit.h, 'Submit', { fill: 'accent', ink: 'bg' }), exitSay: 'Submit', exitAfter: 0.3, exit: 'fade' },
    { ...button('sent', submit.x, submit.y, submit.w, submit.h, 'Claim sent', { fill: 'positive', ink: 'bg' }), at: undefined, say: 'Submit', after: 0.3, enter: 'pop', dur: 0.3 },
    {
      type: 'pointer',
      steps: [
        { to: 'benefits', say: 'Benefits' },
        { to: 'claims', say: 'Claims' },
        { to: 'upload', say: 'receipt', point: [0.5, 0.5] },
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
