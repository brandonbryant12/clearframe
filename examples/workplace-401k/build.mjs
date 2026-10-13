#!/usr/bin/env node
// Writes storyboard-landscape.json and storyboard-vertical.json for the workplace-401k example:
// one storyboard, two frames. Every picture is a fill-in-the-blank sketch or a cued chart.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const PLAN = 'Alder Street Retirement Plan summary, 2027 plan year';

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
  captions: vertical ? 'pop' : false,
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
      id: 'hook',
      block: 'kinetic',
      vo: 'Most new hires leave free money on the table. Here is how much.',
      props: { mode: 'stack', align: 'center', emphasis: ['free', 'much'], source: '' },
    },
    {
      id: 'raise',
      block: 'canvas',
      vo: 'Right now you save three percent, and Alder Street adds three. Raise it to five, and they add four. That is nine percent of your pay, every paycheck.',
      props: {
        source: PLAN,
        sketch: 'match',
        sketchParams: { you: 5, match: 4, fromYou: 3, fromMatch: 3, suffix: '%', again: 3 },
        sketchText: { YOU: 'You put in', EMPLOYER: 'Alder Street adds', EACH: 'Each coin is 1% of your pay', TOTAL: 'of your pay', AGAIN: 'every paycheck, all year' },
        sketchSay: { YOU: 'five', MATCH: 'four', TOTAL: 'nine', AGAIN: 'every' },
      },
    },
    {
      id: 'dollars',
      block: 'canvas',
      vo: 'On a sixty thousand dollar salary, the match goes from eighteen hundred dollars a year to twenty-four hundred. Six hundred more, for two points.',
      props: {
        source: `${PLAN} · example: a $60,000 salary`,
        chart: {
          kind: 'bars',
          prefix: '$',
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
      vo: 'The match becomes yours over three years: a third after the first, two thirds after the second, and all of it after the third. Your own money is always yours.',
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
      transition: 'panel',
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
      },
    },
  ],
});

for (const [name, vertical] of [['landscape', false], ['vertical', true]])
  fs.writeFileSync(path.join(here, `storyboard-${name}.json`), JSON.stringify(film(vertical), null, 2) + '\n');
console.log('wrote storyboard-landscape.json and storyboard-vertical.json');
