#!/usr/bin/env node
// Writes storyboard-landscape.json and storyboard-vertical.json for the open-enrollment example:
// the one rule people miss, told with library pieces only. The elections that carry into next
// year and the one that does not (`carryover`), the guide's own sentence (`document`, entered
// through the $0), the window on the calendar (`deadline`), the step in the app (`app` pages and
// a `pointer`), and the same board at the close (`carryover` with `bookend`). Everything
// (Northwind, the plan, the dates) is fictional.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const GUIDE = 'Northwind Benefits Guide 2028, Open enrollment (fictional)';

function film(vertical) {
  const board = {
    sketch: 'carryover',
    sketchParams: { count: 4, stays: [4], icons: ['heart', 'tooth', 'glasses', 'wallet'] },
    sketchText: { BEFORE: 'This year', AFTER: 'From January 1', ITEM1: 'Medical', ITEM2: 'Dental', ITEM3: 'Vision', ITEM4: 'Health FSA', RESET: '$0' },
    source: GUIDE,
  };
  return {
    version: 2,
    title: 'Open enrollment: the one thing that does not carry over',
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
      {
        id: 'guide',
        claim:
          'Medical, dental and vision elections carry over to 2028; a health FSA election does not and must be made again each year, or the contribution is $0. Open enrollment runs November 3 to 19, 2027, in Northwind Hub under Benefits, Enroll. The FSA amount shown is an example.',
        source: GUIDE,
      },
    ],
    beats: [
      {
        id: 'board',
        block: 'canvas',
        vo: 'Do nothing this open enrollment, and your medical, dental and vision carry over into next year. Your health FSA does not. It goes back to zero.',
        props: { ...board, sketchSay: { CARD1: 'medical', CARD2: 'dental', CARD3: 'vision', CARD4: 'FSA', RESET: 'zero' } },
        hold: 0.6,
      },
      {
        id: 'clause',
        block: 'canvas',
        // Through the $0, into the sentence that put it there.
        transition: 'into',
        into: 'carryover-reset-4',
        vo: 'The benefits guide says it plainly. Your FSA election does not carry over. You must make it again, every year.',
        props: {
          source: GUIDE,
          elements: [
            {
              type: 'document',
              ...(vertical ? { x: 110, y: 230, w: 860, h: 1100, size: 40 } : { x: 330, y: 70, w: 1260, h: 720, size: 42 }),
              kicker: 'Northwind Benefits Guide 2028',
              title: 'Open enrollment',
              sections: [
                { heading: 'What is new', text: 'Vision covers a second pair of glasses.' },
                {
                  heading: 'If you do nothing',
                  text: 'Your medical, dental and vision elections carry over to 2028. Your health FSA election does not carry over. You must make a new FSA election every year, or your contribution will be $0.',
                },
              ],
              scroll: [{ to: 'If you do nothing', say: 'plainly' }],
              marks: [
                { words: 'does not carry over', style: 'highlight', say: 'carry' },
                { words: 'You must make a new FSA election every year', style: 'box', say: 'again' },
              ],
              at: 0,
              enter: 'none',
            },
          ],
        },
      },
      {
        id: 'when',
        block: 'canvas',
        vo: 'Enrollment opens on November third, and closes on the nineteenth.',
        props: {
          sketch: 'deadline',
          sketchParams: { days: 30, firstWeekday: 1, start: 3, end: 19 },
          sketchText: { MONTH: 'November 2027', SUN: 'SUN', MON: 'MON', TUE: 'TUE', WED: 'WED', THU: 'THU', FRI: 'FRI', SAT: 'SAT', OPENS: 'Opens', CLOSES: 'Closes' },
          sketchSay: { OPEN: 'third', CLOSE: 'nineteenth' },
          source: GUIDE,
        },
      },
      {
        id: 'step',
        block: 'canvas',
        vo: 'So in Northwind Hub, open Benefits, then Enroll. Tap Health FSA, choose your amount, and press Save.',
        props: {
          source: GUIDE,
          elements: [
            {
              type: 'app',
              id: 'hub',
              ...(vertical ? { x: 160, y: 260, device: 'phone', w: 760 } : { x: 370, y: 90, w: 1180 }),
              title: 'Northwind Hub',
              pages: [
                { heading: 'Good morning', rows: ['Pay', 'Benefits', 'Time off'], at: 0 },
                { heading: 'Benefits', rows: ['Enroll for 2028', 'My plans', 'Documents'], say: 'Benefits', after: 0.3 },
                {
                  // The screen says what the board said.
                  heading: 'Your elections for 2028',
                  rows: [
                    { label: 'Medical', badge: 'Carries over' },
                    { label: 'Dental', badge: 'Carries over' },
                    { label: 'Vision', badge: 'Carries over' },
                    { label: 'Health FSA', badge: 'Not elected', tone: 'negative' },
                  ],
                  say: 'Enroll',
                  after: 0.3,
                },
                {
                  heading: 'Health FSA for 2028',
                  fields: [{ label: 'Yearly amount', value: '$1,200', say: 'amount' }],
                  button: { label: 'Save', done: 'Saved for 2028', say: 'Save' },
                  say: 'FSA',
                  after: 0.3,
                },
              ],
              at: 0,
              enter: 'none',
            },
            {
              type: 'pointer',
              steps: [
                { to: 'hub-row-benefits', say: 'Benefits' },
                { to: 'hub-row-enroll-for-2028', say: 'Enroll' },
                { to: 'hub-row-health-fsa', say: 'FSA' },
                { to: 'hub-button', say: 'Save' },
              ],
            },
          ],
        },
        // Long enough to see it saved.
        hold: 1.5,
      },
      {
        id: 'close',
        block: 'canvas',
        vo: 'Make your FSA election by the nineteenth, and all four come with you.',
        props: { ...board, sketchParams: { ...board.sketchParams, bookend: true }, sketchSay: { FIX: 'election' } },
        hold: 1.2,
      },
    ],
  };
}

for (const [name, vertical] of [['landscape', false], ['vertical', true]])
  fs.writeFileSync(path.join(here, `storyboard-${name}.json`), `${JSON.stringify(film(vertical), null, 2)}\n`);
console.log('wrote storyboard-landscape.json and storyboard-vertical.json');
