#!/usr/bin/env node
// Writes storyboard-landscape.json and storyboard-vertical.json for the expense-policy example:
// a policy change told with library pieces only. A share of claims sent back (`share`), the card
// slip that is not a receipt beside the itemised one (`receipt`, a `stamp` mark), the claim
// made in the app (`app`, `pointer`), the claim window cut from 60 days to 30 (`was-now`), and the same
// share at the close. Everything (Fairhaven, the policy, the figures) is fictional.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const POLICY = 'Fairhaven Travel & Expense Policy v4, effective January 1, 2028 (fictional)';
const REPORT = 'Fairhaven finance operations, 2027 claims review (fictional)';

function film(vertical) {
  const lunch = {
    merchant: 'Harbor Grill',
    detail: 'Dock Street · Mar 14, 2028',
    items: [
      { qty: 2, name: 'Crab cakes', price: 32 },
      { qty: 1, name: 'Iced tea', price: 4.5 },
    ],
    tax: 3.06,
  };
  // The slip and the receipt side by side (stacked on a tall frame), each named above it.
  const size = vertical ? 34 : 40;
  const slipAt = vertical ? { x: 319, y: 200 } : { x: 280, y: 243 };
  const receiptAt = vertical ? { x: 268, y: 680 } : { x: 1000, y: 130 };
  const label = (text, x, y, extra = {}) => ({ type: 'text', text, x, y, size: 36, font: 'strong', fill: 'muted', ...extra });
  return {
    version: 2,
    title: 'Expense claims: 30 days, itemised, in the app',
    format: { preset: vertical ? 'vertical' : 'landscape', fps: 30 },
    treatment: 'workplace',
    theme: 'daylight',
    type: 'geometric',
    motion: { preset: 'snappy', intensity: 0.6 },
    transition: 'cut',
    backdrop: 'none',
    texture: { grain: 0.05 },
    sfx: 'subtle',
    music: false,
    voice: { style: 'plain and friendly, a colleague explaining' },
    sources: [
      { id: 'report', claim: '31% of expense claims were sent back in 2027, most for a missing itemised receipt', source: REPORT },
      { id: 'policy', claim: 'From January 1, 2028, claims are due within 30 days (was 60); itemised receipts are needed over $25; claims are made in the Fairhaven Expenses app', source: POLICY },
    ],
    beats: [
      {
        id: 'hook',
        block: 'canvas',
        vo: 'Last year, we sent back thirty-one percent of expense claims. Almost always, for the receipt.',
        props: {
          sketch: 'share',
          sketchParams: { count: 31, tone: 'negative' },
          sketchText: { WHAT: 'of expense claims came back last year' },
          sketchSay: { COUNT: 'thirty-one', ISOLATE: 'Almost' },
          source: REPORT,
        },
      },
      {
        id: 'slip',
        block: 'canvas',
        // Through one of the claims that came back, into the paper that sent it back.
        into: 'share-31',
        vo: 'A card slip is not a receipt. Over twenty-five dollars, we need the itemised one: what you bought, and what it cost.',
        props: {
          source: `${POLICY}; the receipt is an example`,
          elements: [
            label('Card slip', slipAt.x, slipAt.y - 34, { at: 0, enter: 'none' }),
            { type: 'receipt', id: 'slip', ...slipAt, size, slip: true, merchant: lunch.merchant, total: 39.56, at: 0, enter: 'none', marks: [{ words: 'APPROVED', style: 'stamp', label: 'Not a receipt', say: 'not' }] },
            label('Itemised receipt', receiptAt.x, receiptAt.y - 34, { say: 'itemised', enter: 'fade' }),
            {
              type: 'receipt',
              id: 'lunch',
              ...receiptAt,
              size,
              ...lunch,
              footer: 'Example',
              say: 'itemised',
              enter: 'rise',
              marks: [
                { words: 'Crab cakes', style: 'highlight', say: 'bought' },
                { words: '$39.56', style: 'box', say: 'cost' },
              ],
            },
          ],
        },
      },
      {
        id: 'app',
        block: 'canvas',
        vo: 'So use the app. Photograph the receipt, check the amount, and press Submit.',
        props: {
          source: `${POLICY}; the receipt is an example`,
          elements: [
            // The same receipt, carried across the cut by its id, now beside the app.
            // (Drawn at the same size and scaled, so the cut is one move.)
            { type: 'receipt', id: 'lunch', ...(vertical ? { x: 268, y: 40, scale: 0.65 } : { x: 150, y: 150, scale: 0.75 }), size, ...lunch, footer: 'Example', at: 0, enter: 'none' },
            {
              type: 'app',
              id: 'exp',
              ...(vertical ? { x: 200, y: 520, device: 'phone', w: 680 } : { x: 800, y: 110 }),
              title: 'Fairhaven Expenses',
              heading: 'New claim',
              upload: { label: 'Photograph receipt', receipt: lunch, say: 'Photograph', after: 0.4 },
              fields: [
                { label: 'Amount', value: '$39.56', say: 'amount' },
                { label: 'Date', value: 'Mar 14, 2028', say: 'amount', after: 0.35 },
              ],
              button: { label: 'Submit', done: 'Sent', say: 'Submit' },
              at: 0,
              enter: 'none',
            },
            {
              type: 'pointer',
              steps: [
                { to: 'exp-upload', say: 'Photograph', point: [0.5, 0.5] },
                { to: 'exp-button', say: 'Submit' },
              ],
            },
          ],
        },
      },
      {
        id: 'window',
        block: 'canvas',
        vo: 'And from January first, you have thirty days to do it, not sixty. After that, a director has to approve it.',
        props: {
          sketch: 'was-now',
          sketchParams: { was: 60, now: 30, note: true },
          sketchText: { WHAT: 'Time to submit a claim', WASLABEL: 'until now', NOWLABEL: 'from January 1', NOTE: 'After day 30, a director has to approve it' },
          sketchSay: { CHANGE: 'thirty', NOTE: 'director' },
          source: POLICY,
        },
      },
      {
        id: 'close',
        block: 'canvas',
        vo: 'Thirty days, an itemised receipt, the app. Then none of these come back.',
        props: {
          sketch: 'share',
          sketchParams: { count: 31, tone: 'negative', fix: true },
          sketchText: { WHAT: 'of claims came back last year' },
          sketchSay: { COUNT: 'Thirty', ISOLATE: 'receipt', FIX: 'none' },
          source: REPORT,
        },
      },
    ],
  };
}

for (const [name, vertical] of [['landscape', false], ['vertical', true]])
  fs.writeFileSync(path.join(here, `storyboard-${name}.json`), `${JSON.stringify(film(vertical), null, 2)}\n`);
console.log('wrote storyboard-landscape.json and storyboard-vertical.json');
