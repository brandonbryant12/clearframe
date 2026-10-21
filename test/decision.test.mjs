// A rule walked by a case and its counterfactual: validation, routes and the compare-and-return picture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  decisionSpec,
  decisionElements,
  expandDecisionProps,
} from '../packages/engine/dist/film/decision.mjs';
import { createJob } from '../packages/engine/dist/film/production.mjs';
import { computeTiming } from '../packages/engine/dist/engine/lib/timing.mjs';
import { loadStoryboard } from '../packages/engine/dist/engine/lib/project.mjs';
import { writeJSON } from '../packages/engine/dist/engine/lib/util.mjs';

const base = {
  id: 'claim',
  title: 'Which route a claim takes',
  source: 'Example expense rule for illustration',
  ask: [
    { id: 'amount', label: 'Over $500?' },
    { id: 'receipt', label: 'Itemised receipt?' },
  ],
  tree: {
    ask: 'amount',
    yes: 'manager',
    no: { ask: 'receipt', yes: 'auto', no: 'returned' },
  },
  outcomes: [
    { id: 'manager', label: 'Manager approves' },
    { id: 'auto', label: 'Approved automatically', tone: 'positive' },
    { id: 'returned', label: 'Returned to you', tone: 'negative' },
  ],
  cases: [
    { label: 'A $120 taxi', answers: { amount: 'no', receipt: 'yes' }, at: 1 },
    {
      label: 'Same taxi, no receipt',
      answers: { amount: 'no', receipt: 'no' },
      at: 4,
    },
  ],
  return: { at: 7 },
};
const frame = { width: 1920, height: 1080 };

test('each case takes the route its answers give; the counterfactual differs only where an answer changed', () => {
  const p = decisionSpec(base);
  assert.deepEqual(p.cases[0].path, [
    { ask: 'amount', answer: 'no' },
    { ask: 'receipt', answer: 'yes' },
    { outcome: 'auto' },
  ]);
  assert.deepEqual(p.cases[1].path, [
    { ask: 'amount', answer: 'no' },
    { ask: 'receipt', answer: 'no' },
    { outcome: 'returned' },
  ]);
  assert.deepEqual(p.cases[1].changed, ['receipt']);
  // A case only answers what its path asks: a large amount never reaches the receipt question.
  assert.deepEqual(
    decisionSpec({
      ...base,
      cases: [{ label: 'A $900 hotel', answers: { amount: 'yes' }, at: 1 }],
      return: undefined,
    }).cases[0].path.at(-1),
    { outcome: 'manager' },
  );
});

test('a rule that cannot be walked, or a counterfactual that changes nothing, is refused', () => {
  for (const [bad, message] of [
    [
      { ...base, tree: { ask: 'amount', yes: 'manager', no: 'auto' } },
      /outcome returned is never reached|question receipt is never asked/,
    ],
    [
      {
        ...base,
        tree: {
          ask: 'amount',
          yes: 'manager',
          no: { ask: 'amount', yes: 'auto', no: 'returned' },
        },
      },
      /asks amount again on the same path/,
    ],
    [
      {
        ...base,
        tree: {
          ask: 'amount',
          yes: 'nowhere',
          no: { ask: 'receipt', yes: 'auto', no: 'returned' },
        },
      },
      /names "nowhere", which is neither an outcome/,
    ],
    [
      {
        ...base,
        cases: [{ label: 'Unanswered', answers: { amount: 'no' }, at: 1 }],
        return: undefined,
      },
      /answers needs receipt: the rule asks it on this case's path/,
    ],
    [
      { ...base, cases: [base.cases[0], { ...base.cases[0], label: 'Same' }] },
      /must change at least one answer/,
    ],
    [
      {
        ...base,
        cases: [
          base.cases[0],
          {
            label: 'Changed, but not asked',
            answers: { amount: 'no', receipt: 'yes' },
            at: 4,
          },
        ],
      },
      /must change at least one answer/,
    ],
    [
      { ...base, cases: [base.cases[0]] },
      /return brings the first case back after a counterfactual/,
    ],
    [
      {
        ...base,
        cases: [
          { ...base.cases[0], answers: { amount: 'maybe', receipt: 'yes' } },
        ],
        return: undefined,
      },
      /"yes" or "no"/,
    ],
  ])
    assert.throws(() => decisionSpec(bad), message);
});

test('the walk lights the chosen route; the counterfactual ghosts the first, diverges, and the first returns', () => {
  const { elements, end } = decisionElements(decisionSpec(base), frame);
  const e = Object.fromEntries(elements.map((x) => [x.id, x]));
  // Every question, connector and outcome is on screen from the start: the rule is the picture.
  for (const id of [
    'dc-claim-node-q',
    'dc-claim-node-q-n',
    'dc-claim-edge-q-yes',
    'dc-claim-out-manager',
    'dc-claim-out-returned',
  ])
    assert.equal(e[id].at, 0, id);
  assert.equal(e['dc-claim-walk-0-0'].at, 1);
  assert.ok(
    Math.abs(e['dc-claim-walk-0-out'].at - (1 + 2 * 0.55)) < 1e-9,
    'the outcome is marked when the walk reaches it',
  );
  assert.deepEqual(
    e['dc-claim-walk-0-0'].keys.map((k) => [k.at, k.opacity]),
    [
      [4, 0.3],
      [7, 1],
    ],
    'the first walk ghosts for the counterfactual and returns',
  );
  assert.equal(
    e['dc-claim-walk-1-0'].keys[0].opacity,
    0,
    'a shared hop of the counterfactual steps aside on return',
  );
  assert.equal(
    e['dc-claim-walk-1-1'].keys[0].opacity,
    0.3,
    'where it diverged it stays as a ghost to compare',
  );
  assert.equal(
    e['dc-claim-case-1-0'].marks[0].words,
    'Itemised receipt? No',
    'the changed answer is marked in the case line',
  );
  assert.ok(end >= 7);
  const tall = expandDecisionProps(
    { decision: base },
    { width: 1080, height: 1920, duration: 10 },
  );
  assert.match(tall.source, /Example expense rule for illustration/);
  assert.throws(
    () => expandDecisionProps({ decision: base }, { ...frame, duration: 6 }),
    /after the beat ends/,
  );
});

test('case lines never share the frame, and only answers a line shows are marked as changed', () => {
  const { elements } = decisionElements(decisionSpec(base), frame);
  const lines = (t) =>
    elements.filter(
      (e) =>
        /-case-\d+-\d+$/.test(e.id) &&
        e.at <= t + 1e-9 &&
        (e.exitAt == null || e.exitAt > t + 1e-9),
    );
  // The outcome readout reveals on the walk's arrival at its outcome, never earlier.
  const readout = elements.find((e) => /-case-0-0-outcome$/.test(e.id));
  assert.equal(readout.text, '→ Approved automatically');
  assert.ok(Math.abs(readout.at - (1 + 2 * 0.55)) < 1e-9);
  for (const t of [1, 3.69, 3.71, 3.9, 4.2, 6.9, 7.1])
    assert.ok(lines(t).length <= 1, `one case line at ${t}`);
  assert.equal(
    lines(3.9)[0].text.startsWith('Same taxi'),
    true,
    'the counterfactual line is fading in, the first has gone',
  );
  // A counterfactual that ends sooner no longer answers the receipt question: nothing marks it.
  const shorter = decisionSpec({
    ...base,
    ask: [
      { id: 'amount', label: 'Over $500?' },
      { id: 'receipt', label: 'Receipt?' },
    ],
    cases: [
      {
        label: 'A $120 taxi',
        answers: { amount: 'no', receipt: 'yes' },
        at: 1,
      },
      { label: 'A $900 hotel', answers: { amount: 'yes' }, at: 4 },
    ],
  });
  const second = decisionElements(shorter, frame).elements.find((e) =>
    /-case-1-0$/.test(e.id),
  );
  assert.deepEqual(
    second.marks.map((m) => m.words),
    ['Over $500? Yes'],
  );
  assert.ok(second.marks.every((m) => second.text.includes(m.words)));
});

test('a rule shown in two beats keeps its cards, while each beat walks its own case', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-decision-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const one = { ...base, cases: [base.cases[0]], return: undefined };
  writeJSON(path.join(dir, 'storyboard.json'), {
    version: 2,
    title: 'Rule',
    format: { preset: 'landscape', fps: 30 },
    theme: 'paper',
    captions: false,
    music: false,
    sources: [{ id: 'r', title: 'Example rule' }],
    beats: [
      {
        id: 'a',
        block: 'canvas',
        hold: 2,
        vo: 'A taxi with a receipt.',
        props: { decision: one },
      },
      {
        id: 'b',
        block: 'canvas',
        hold: 2,
        vo: 'The same taxi, walked again.',
        props: { decision: one },
      },
    ],
  });
  const { job, errors } = createJob(loadStoryboard(dir), computeTiming(dir), {
    draft: true,
  });
  assert.deepEqual(errors, []);
  const b = job.beats[1].props.elements;
  assert.ok(
    b.find((e) => e.id === 'dc-claim-node-q').morph,
    'the rule card is the same object across the cut',
  );
  const walk = b.filter((e) => /-walk-/.test(e.id));
  assert.ok(
    walk.length && walk.every((e) => !e.morph && e.at >= 1),
    'the second beat walks its case on its own clock, not from the cut',
  );
});

test('a rule too broad or deep, or a label too long, to read on a phone is refused rather than shrunk', () => {
  const four = {
    ...base,
    ask: [...base.ask, { id: 'trip', label: 'Business trip?' }],
    tree: {
      ask: 'amount',
      yes: 'manager',
      no: {
        ask: 'receipt',
        yes: { ask: 'trip', yes: 'auto', no: 'finance' },
        no: 'returned',
      },
    },
    outcomes: [...base.outcomes, { id: 'finance', label: 'Finance checks it' }],
    cases: [
      {
        label: 'A taxi',
        answers: { amount: 'no', receipt: 'yes', trip: 'yes' },
        at: 1,
      },
    ],
    return: undefined,
  };
  assert.throws(
    () => decisionElements(decisionSpec(four), frame),
    /4 outcomes; at most 3 stay readable/,
  );
  const long = {
    ...base,
    ask: [
      { id: 'amount', label: 'Submitted within thirty days of travel?' },
      base.ask[1],
    ],
  };
  assert.throws(
    () => decisionElements(decisionSpec(long), frame),
    /needs more than two lines in a card this size/,
  );
});
