// The process model conserves every item, carries its state across an intervention and labels itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  processSpec,
  processModel,
  processElements,
  expandProcessProps,
} from '../packages/engine/dist/film/process.mjs';
import { createJob } from '../packages/engine/dist/film/production.mjs';
import { computeTiming } from '../packages/engine/dist/engine/lib/timing.mjs';
import { loadStoryboard } from '../packages/engine/dist/engine/lib/project.mjs';
import { writeJSON } from '../packages/engine/dist/engine/lib/util.mjs';

const base = {
  id: 'requests',
  title: 'Where requests wait',
  unit: 'requests',
  period: 'day',
  arrivals: 10,
  done: 'Completed',
  stages: [
    { id: 'intake', label: 'Intake', capacity: 12 },
    { id: 'review', label: 'Review', capacity: 8 },
    { id: 'approve', label: 'Approval', capacity: 12 },
  ],
  runs: [
    { periods: 5, at: 0.5, dur: 4 },
    { periods: 5, at: 5, dur: 4, set: { review: 12 } },
  ],
};

test('the queue grows at the bottleneck, and a raised capacity drains it at the computed rate, not at once', () => {
  const s = processModel(processSpec(base));
  assert.deepEqual(
    s.map((x) => x.queues[1]),
    [0, 2, 4, 6, 8, 10, 8, 6, 4, 2, 0],
    'review: +2 a day for five days, then −2 a day',
  );
  assert.deepEqual(
    s.map((x) => x.done),
    [0, 8, 16, 24, 32, 40, 52, 64, 76, 88, 100],
  );
  assert.equal(
    s[6].queues[1],
    8,
    'the day after the change, the carried queue is still there',
  );
  for (const x of s)
    assert.equal(
      x.queues.reduce((a, v) => a + v, 0) + x.done,
      x.period * 10,
      'every arrival is waiting or done',
    );
  // A queue already there at the start is carried too.
  const carried = processModel(
    processSpec({
      ...base,
      start: { review: 6 },
      runs: [{ periods: 3, dur: 2, at: 0.5 }],
    }),
  );
  assert.deepEqual(
    carried.map((x) => x.queues[1]),
    [6, 8, 10, 12],
  );
  assert.equal(
    carried.at(-1).queues.reduce((a, v) => a + v, 0) + carried.at(-1).done,
    30 + 6,
  );
});

test('the picture shows the computed state: one square per waiting item, its count, the clock and what is done', () => {
  const { elements, states } = processElements(processSpec(base), {
    width: 1920,
    height: 1080,
  });
  const at = (t) =>
    elements.filter(
      (e) =>
        (e.at ?? 0) <= t + 1e-9 && (e.exitAt == null || e.exitAt > t + 1e-9),
    );
  const t5 = 0.5 + 4 + 1e-6; // the end of day 5
  const squares = at(t5).filter((e) => /^pr-requests-review-q\d+-/.test(e.id));
  assert.equal(
    squares.length,
    states[5].queues[1],
    'ten squares for ten waiting',
  );
  const texts = at(t5)
    .filter((e) => e.type === 'text')
    .map((e) => e.text);
  for (const want of ['10 waiting · +2 a day', 'Day 5', '40', '8 a day'])
    assert.ok(texts.includes(want), want);
  const t10 = 5 + 4 + 1e-6;
  const late = at(t10)
    .filter((e) => e.type === 'text')
    .map((e) => e.text);
  for (const want of ['0 waiting · −2 a day', 'Day 10', '100', '12 a day'])
    assert.ok(late.includes(want), want);
  assert.ok(
    elements.some((e) => e.id === 'pr-requests-review-changed-1' && e.at === 5),
    'the changed capacity is marked when it changes',
  );
  assert.ok(
    elements.some(
      (e) =>
        e.text ===
        '10 requests arrive each day; capacities are requests per day',
    ),
    'the assumptions are on screen',
  );
});

test('stated rates are checked; branching, fractional items and impossible timings are refused', () => {
  for (const [bad, message] of [
    [
      { ...base, stages: [base.stages[0]] },
      /2–5 stages in order \(a serial flow/,
    ],
    [{ ...base, arrivals: 9.5 }, /whole number/],
    [
      { ...base, stages: [base.stages[0], { ...base.stages[1], capacity: 0 }] },
      /capacity must be a whole number/,
    ],
    [{ ...base, runs: [{ periods: 5, dur: 1 }] }, /at least 0\.4 s each/],
    [
      { ...base, runs: [{ periods: 2, dur: 2, set: { review: 9 } }] },
      /first run uses the stated capacities/,
    ],
    [
      { ...base, runs: [base.runs[0], { ...base.runs[1], set: { audit: 3 } }] },
      /unknown runs\[1\]\.set\.audit/,
    ],
    [{ ...base, start: { review: -1 } }, /already waiting/],
  ])
    assert.throws(() => processSpec(bad), message);
  assert.throws(
    () =>
      processElements(
        processSpec({
          ...base,
          runs: [
            { periods: 5, at: 0.5, dur: 4 },
            { ...base.runs[1], at: 2 },
          ],
        }),
        { width: 1920, height: 1080 },
      ),
    /starts at 2\.00 s, before runs\[0\] ends/,
  );
  assert.throws(
    () =>
      processElements(
        processSpec({
          ...base,
          arrivals: 40,
          runs: [{ periods: 20, at: 0.5, dur: 9 }],
        }),
        { width: 1920, height: 1080 },
      ),
    /too many tokens to draw; set token/,
  );
  assert.doesNotThrow(() =>
    processElements(
      processSpec({
        ...base,
        arrivals: 40,
        token: 20,
        runs: [{ periods: 20, at: 0.5, dur: 9 }],
      }),
      { width: 1920, height: 1080 },
    ),
  );
  const p = expandProcessProps(
    { process: base },
    { width: 1080, height: 1920, duration: 12 },
  );
  assert.match(p.source, /^Illustrative model of stated rates$/);
  assert.throws(
    () =>
      expandProcessProps(
        { process: base },
        { width: 1920, height: 1080, duration: 8 },
      ),
    /runs until 9\.00 s, after the beat ends/,
  );
});

test('a run lands on a named moment of the beat', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-process-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeJSON(path.join(dir, 'storyboard.json'), {
    version: 2,
    title: 'Process',
    format: { preset: 'landscape', fps: 30 },
    theme: 'paper',
    captions: false,
    music: false,
    sources: [{ id: 'm', title: 'Illustrative model' }],
    beats: [
      {
        id: 'a',
        block: 'canvas',
        min: 12,
        vo: 'Ten arrive each day. Then a second reviewer joins and the queue drains.',
        props: {
          moments: { HIRE: 'second reviewer' },
          process: {
            ...base,
            runs: [
              { periods: 5, at: 0.3, dur: 2 },
              { periods: 5, cue: 'HIRE', dur: 3, set: { review: 12 } },
            ],
          },
        },
      },
    ],
  });
  const { job, errors } = createJob(loadStoryboard(dir), computeTiming(dir), {
    draft: true,
  });
  assert.deepEqual(errors, []);
  const ring = job.beats[0].props.elements.find(
    (e) => e.id === 'a-pr-requests-review-changed-1',
  );
  assert.ok(ring.at > 2.3, `the change lands on its moment (${ring.at})`);
});

test('a capacity changes when its run starts; queues and counts change only as periods end', () => {
  const { elements } = processElements(processSpec(base), {
    width: 1920,
    height: 1080,
  });
  const at = (t) =>
    elements
      .filter(
        (e) =>
          e.type === 'text' &&
          (e.at ?? 0) <= t + 1e-9 &&
          (e.exitAt == null || e.exitAt > t + 1e-9),
      )
      .map((e) => e.text);
  const t = 5.1; // the intervention has landed (run 2 starts at 5) but its first day ends at 5.8
  for (const want of ['12 a day', '10 waiting · +2 a day', '40', 'Day 5'])
    assert.ok(at(t).includes(want), `${want} at 5.1`);
  assert.ok(
    !at(t).includes('8 a day'),
    'the old review capacity is gone once the change lands',
  );
  for (const want of ['12 a day', '8 waiting · −2 a day', '52', 'Day 6'])
    assert.ok(at(5.8 + 1e-6).includes(want), `${want} at 5.8`);
  assert.ok(
    at(4.9).includes('8 a day') && !at(4.9).includes('12 a day'.repeat(2)),
  );
  assert.equal(
    elements.find((e) => e.id === 'pr-requests-review-changed-1').at,
    5,
  );
});

test('a process shown in two beats keeps its stages but not its readouts across the cut', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-process-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const beat = (id, vo) => ({
    id,
    block: 'canvas',
    hold: 3,
    vo,
    props: { process: { ...base, runs: [{ periods: 5, at: 0.5, dur: 3 }] } },
  });
  writeJSON(path.join(dir, 'storyboard.json'), {
    version: 2,
    title: 'Process',
    format: { preset: 'landscape', fps: 30 },
    theme: 'paper',
    captions: false,
    music: false,
    sources: [{ id: 'm', title: 'Illustrative model' }],
    beats: [
      beat('one', 'Five days of review.'),
      beat('two', 'The same five days again.'),
    ],
  });
  const { job, errors } = createJob(loadStoryboard(dir), computeTiming(dir), {
    draft: true,
  });
  assert.deepEqual(errors, []);
  const two = job.beats[1].props.elements;
  assert.ok(
    two.find((e) => e.id === 'pr-requests-review-card').morph,
    'a stage card is the same object across the cut',
  );
  const visibleAt = (t) =>
    two.filter(
      (e) =>
        e.type === 'text' &&
        /-clock-/.test(e.id) &&
        e.at <= t + 1e-9 &&
        (e.exitAt == null || e.exitAt > t + 1e-9),
    );
  assert.equal(
    visibleAt(0).length,
    1,
    'one clock reading at the cut, not every day at once',
  );
  assert.ok(
    two.filter((e) => /-clock-/.test(e.id)).every((e) => !e.morph),
    'readouts are this beat\u2019s own, never morphed from the beat before',
  );
});

test('grouped tokens draw the remainder, including a queue smaller than one full token', () => {
  const p = processSpec({
    title: 'Grouped queue',
    arrivals: 5,
    token: 4,
    stages: [
      { id: 'intake', label: 'Intake', capacity: 5 },
      { id: 'review', label: 'Review', capacity: 3 },
    ],
    runs: [{ periods: 3, at: 0, dur: 3 }],
  });
  const { elements } = processElements(p, { width: 1920, height: 1080 });
  for (const [at, count] of [
    [1.3, 2],
    [2.3, 4],
    [3.3, 6],
  ]) {
    const squares = elements.filter(
      (e) =>
        /-review-q\d+-/.test(e.id) &&
        e.at <= at &&
        (e.exitAt == null || e.exitAt > at),
    );
    assert.equal(
      squares.reduce((sum, e) => sum + (e.w / e.h) * p.token, 0),
      count,
      `drawn quantity equals ${count}`,
    );
    assert.equal(squares.length, Math.ceil(count / p.token));
  }
  assert.ok(elements.some((e) => e.text === 'Each full square is 4 items'));
  assert.equal(
    elements.find((e) => /-review-q1-1$/.test(e.id)).w,
    13,
    'two waiting items draw half of a 26-pixel token',
  );
});
