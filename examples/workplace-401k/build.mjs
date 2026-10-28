#!/usr/bin/env node
// Writes storyboard-landscape.json and storyboard-vertical.json for the workplace-401k example:
// one storyboard, two frames. Every picture is a fill-in-the-blank sketch or a cued chart.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const PLAN = 'Alder Street Retirement Plan summary, 2027 plan year';

// The company's four coins on offer, as faint outlines on its plate from the first frame: the free
// money on the table. Three fill on "adds" (today's match); the fourth, the money a 3% saver
// leaves, fills on "four". They are canvas elements, drawn in the sketch's own space with the
// geometry of its company stack (an art layer is placed in frame space and missed the plate).
const round2 = n => Math.round(n * 100) / 100;
const ghostCoins = vertical => {
  const [x, base, rx, ry, t, step] = vertical ? [755, 1300, 190, 50, 34, 44] : [1220, 760, 150, 40, 32, 42];
  return [0, 1, 2, 3].map(i => {
    const y = base - i * step;
    return {
      type: 'group',
      enter: 'fade',
      at: 0.5 + i * 0.12,
      dur: 0.35,
      // Each fades as its coin starts to fall into place (the coins drop 0.14 s apart).
      exit: 'fade',
      exitSay: i < 3 ? 'adds' : 'four',
      exitAfter: i < 3 ? round2(i * 0.14) : 0,
      exitDur: 0.3,
      children: [
        { type: 'ellipse', cx: x, cy: y + t, rx, ry, fill: 'accent2', opacity: 0.14 },
        { type: 'rect', x: x - rx, y, w: 2 * rx, h: t, fill: 'accent2', opacity: 0.14 },
        { type: 'ellipse', cx: x, cy: y, rx, ry, fill: 'none', stroke: 'accent2', width: 3, dash: [10, 8], opacity: 0.75 },
      ],
    };
  });
};

const film = vertical => ({
  version: 2,
  title: 'Your 401(k) match: free money, every paycheck',
  format: { preset: vertical ? 'vertical' : 'landscape', fps: 30 },
  treatment: 'workplace',
  theme: 'meridian',
  type: 'geometric',
  motion: { preset: 'snappy', intensity: 0.6 },
  transition: 'cut',
  backdrop: 'none',
  texture: { grain: 0.05 },
  sfx: 'subtle',
  // Captions are on (broadcast style), as on every narrated film: most people watch muted.
  music: false,
  voice: { style: 'warm, plain, a little playful' },
  sources: [
    {
      id: 'plan',
      claim: 'Alder Street matches 100% of the first 3% and 50% of the next 2%; at a $60,000 salary that is $1,800 a year at 3% and $2,400 at 5%; the match vests 33/66/100% over three years',
      source: `${PLAN} (fictional sample plan)`,
    },
  ],
  beats: [
    {
      // The film opens on its picture: the company's coins on offer are on the table from the first
      // frame, and today's coins drop into place as they are named.
      id: 'raise',
      block: 'canvas',
      vo: 'Most new hires leave free money on the table. Right now you save three percent, and Alder Street adds three. Raise it to five, and they add four. That is nine percent of your pay, every paycheck.',
      props: {
        source: PLAN,
        sketch: 'match',
        sketchParams: { you: 5, match: 4, fromYou: 3, fromMatch: 3, suffix: '%', again: 3, start: 'empty' },
        sketchText: { YOU: 'You put in', EMPLOYER: 'Alder Street adds', EACH: 'Each coin is 1% of your pay', TOTAL: 'of your pay', AGAIN: 'every paycheck, all year' },
        sketchSay: { NOWYOU: 'save', NOWMATCH: 'adds', YOU: 'five', MATCH: 'four', TOTAL: 'nine', AGAIN: 'every' },
        elements: ghostCoins(vertical),
      },
    },
    {
      id: 'dollars',
      block: 'canvas',
      // The next step of the same idea, what the match is worth in dollars: the coins and the chart
      // move as one strip. (Going `into` the coin stack overfilled the frame with a teal blur and
      // then cut to a cream chart.)
      transition: 'push',
      vo: 'On a sixty thousand dollar salary, the match goes from eighteen hundred dollars a year to twenty-four hundred. Six hundred more, for two points.',
      props: {
        source: `${PLAN} · example: a $60,000 salary`,
        // The salary lands first, so the lead-in has its own fact instead of an empty baseline.
        elements: [
          { type: 'text', text: 'On a $60,000 salary', x: vertical ? 132 : 192, y: vertical ? 420 : 130, size: vertical ? 54 : 50, font: 'strong', fill: 'muted', say: 'sixty' },
        ],
        chart: {
          kind: 'bars',
          prefix: '$',
          // Clear of the lead-in above and the captions below, with room for the top value. The tall
          // frame's default box put the $2,400 label against the lead-in, so it is set there too.
          box: vertical ? [108, 560, 864, 707] : [192, 250, 1536, 430],
          values: [
            { label: 'Match at 3%', value: 1800, say: 'eighteen' },
            { label: 'Match at 5%', value: 2400, say: 'twenty-four', highlight: true },
          ],
          note: { text: '+$600 a year', to: 'Match at 5%', say: 'Six' },
        },
      },
    },
    {
      id: 'keep',
      block: 'canvas',
      vo: 'A third of the match is yours after the first year, two thirds after the second, and all of it after the third. Your own money is always yours.',
      props: {
        source: PLAN,
        sketch: 'vesting',
        sketchParams: { steps: [33, 66, 100] },
        sketchText: { STEP1: 'Year 1', STEP2: 'Year 2', STEP3: 'Year 3', WHAT: "Alder Street's match you keep" },
        sketchSay: { ONE: 'first', TWO: 'second', THREE: 'all' },
      },
    },
    {
      id: 'step',
      block: 'canvas',
      // From what you keep to the step that gets it: the app arrives as the next screen.
      transition: 'push',
      pace: 'hold',
      hold: 1.5,
      vo: 'It takes two minutes. Open Benefits, then Retirement. Set your rate to five percent, and save. Free money, every paycheck after.',
      props: {
        sketch: 'portal',
        sketchText: {
          APP: 'Alder Street Benefits',
          STEP1: 'Benefits',
          STEP2: 'Retirement',
          OTHER: 'Health & dental',
          FIELD: 'Contribution rate',
          OLD: '3%',
          NEW: '5%',
          DONE: 'Saved: starts with your next paycheck',
        },
        sketchSay: { CLICK1: 'Benefits', CLICK2: 'Retirement', CHANGE: 'five', SAVE: 'save' },
        // The rates on the screen are the plan's figures, so they carry its name too.
        source: PLAN,
      },
    },
  ],
});

for (const [name, vertical] of [['landscape', false], ['vertical', true]])
  fs.writeFileSync(path.join(here, `storyboard-${name}.json`), JSON.stringify(film(vertical), null, 2) + '\n');
console.log('wrote storyboard-landscape.json and storyboard-vertical.json');
