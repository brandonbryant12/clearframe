// Canvas elements, beat layers (art, plate, camera, tone), film texture and graphic transitions.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeProps, THEMES } from '../fframes/catalog.mjs';
import { normalizeElements, scheduleElements } from '../fframes/canvas.mjs';
import { createJob, COVER } from '../fframes/production.mjs';
import { storyboardFor } from '../fframes/playbooks.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { writeJSON } from '../engine/lib/util.mjs';

function project(t, sb) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-canvas-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeJSON(path.join(dir, 'storyboard.json'), sb);
  return dir;
}
const fail = m => {
  throw new Error(m);
};
const job = (t, sb) => {
  const root = project(t, sb);
  return createJob(loadStoryboard(root), computeTiming(root), { draft: true });
};
const base = () => {
  const sb = storyboardFor('concept-explainer');
  sb.beats = [];
  return sb;
};

test('canvas elements reject unknown types, fields, colors, effects and malformed paths with their location', () => {
  const ok = normalizeElements([{ type: 'circle', cx: 1, cy: 2, r: 3, fill: 'accent' }], 'elements', fail);
  assert.equal(ok[0].fill, 'accent');
  for (const [bad, message] of [
    [{ type: 'blob' }, /type must be one of/],
    [{ type: 'rect', w: 1, h: 1, colour: 'red' }, /unsupported rect field colour/],
    [{ type: 'rect', w: 1, h: 1, fill: 'red' }, /palette token/],
    [{ type: 'rect', w: 1, h: 1, enter: 'explode' }, /enter must be one of/],
    [{ type: 'path', d: 'M 0 0 <script>' }, /plain SVG path data/],
    [{ type: 'path', d: 'L 0 0' }, /starting with M/],
    [{ type: 'icon', name: '../evil.svg' }, /unknown icon/],
    [{ type: 'circle', r: 5, loop: { type: 'dash' } }, /dash loop needs a dash pattern/],
    [{ type: 'rect', w: 1, h: 1, keys: [{ x: 4 }] }, /needs at \(seconds\) or say/],
    [{ type: 'text', text: 'Hi', enter: 'type', count: { to: 'many' } }, /count needs a numeric to/],
    [{ type: 'circle', r: 3, enter: 'type' }, /enter "type" is for text/],
  ])
    assert.throws(() => normalizeElements([bad], 'elements', fail), message, JSON.stringify(bad));
  assert.throws(
    () =>
      normalizeElements(
        Array.from({ length: 601 }, () => ({ type: 'circle', r: 1 })),
        'elements',
        fail,
      ),
    /at most 600/,
  );
  const nested = normalizeElements(
    [
      {
        type: 'group',
        children: [
          {
            type: 'group',
            children: [{ type: 'rect', w: 1, h: 1, fill: { gradient: ['accent', '#112233'], angle: 30 } }],
          },
        ],
      },
    ],
    'elements',
    fail,
  );
  assert.equal(nested[0].children[0].children[0].fill.gradient[1], '#112233');
});

test('canvas scheduling resolves spoken cues, staggers groups and reports when everything has settled', () => {
  const words = { 'the river': 1.5, then: 2.25 };
  const list = normalizeElements(
    [
      { type: 'path', d: 'M 0 0 L 100 0', say: 'the river' },
      {
        type: 'group',
        at: 0.5,
        stagger: 0.2,
        children: [
          { type: 'circle', r: 5 },
          { type: 'circle', r: 5 },
        ],
      },
      { type: 'text', text: 'Counted', count: { to: 42, dur: 2 }, at: 0.3 },
      { type: 'circle', r: 5, at: 0.1, keys: [{ say: 'then', x: 40, dur: 0.5 }], exitSay: 'then' },
    ],
    'elements',
    fail,
  );
  const settle = scheduleElements(list, {
    start: 0.2,
    entrance: 0.55,
    resolve: v => (typeof v === 'number' ? v : words[v]),
  });
  assert.equal(list[0].at, 1.5);
  assert.equal(list[0].dur, 1.2, 'draw-on default');
  assert.deepEqual(
    list[1].children.map(c => c.at),
    [0.5, 0.7],
  );
  assert.equal(list[3].keys[0].at, 2.25);
  assert.equal(list[3].exitAt, 2.25);
  assert.equal(list[3].exit, 'fade');
  assert.equal(settle, Math.max(1.5 + 1.2, 0.3 + 2, 2.25 + 0.55));
  assert.ok(!('say' in list[0]) && !('exitSay' in list[3]), 'cues are replaced by resolved seconds');
});

test('canvas beats count as figures only when they count, and late cues fail', t => {
  const sb = base();
  sb.beats = [
    {
      id: 'c',
      block: 'canvas',
      duration: 3,
      props: { elements: [{ type: 'text', text: 'Revenue', count: { to: 12 } }] },
    },
  ];
  assert.match(job(t, sb).errors.join(), /source/);
  sb.beats[0].props.source = 'Illustrative';
  assert.deepEqual(job(t, sb).errors, []);
  sb.beats[0].props.elements.push({ type: 'circle', r: 4, at: 3.5 });
  assert.match(job(t, sb).errors.join(), /after the beat ends/);
  sb.beats = [{ id: 'c', block: 'canvas', duration: 3, props: { elements: [{ type: 'text', text: 'Step 1' }] } }];
  const r = job(t, sb);
  assert.deepEqual(r.errors, []);
  assert.match(r.warnings.join(), /digits/);
  assert.throws(
    () => normalizeProps('canvas', { elements: [{ type: 'circle', r: 1 }], support: 'x' }),
    /add a text element/,
  );
  assert.throws(() => normalizeProps('canvas', { elements: [] }), /at least one/);
});

test('beat layers validate art, camera, tone and plate, and pass them to the renderer', t => {
  const sb = base();
  sb.beats = [
    {
      id: 's',
      block: 'statement',
      duration: 3,
      tone: 'accent',
      camera: 'out',
      art: { over: [{ type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, at: 0.2 }] },
      props: { text: 'Hello' },
    },
  ];
  let r = job(t, sb);
  assert.deepEqual(r.errors, []);
  assert.equal(r.job.beats[0].tone, 'accent');
  assert.deepEqual(r.job.beats[0].camera, { move: 'out' });
  assert.equal(r.job.beats[0].art.over[0].dur, 1.2);
  for (const [field, value, message] of [
    ['tone', 'neon', /tone must be/],
    ['camera', { move: 'spin' }, /camera must be/],
    ['art', { behind: [] }, /art must be/],
    ['plate', { file: 'a.jpg', side: 'diagonal' }, /plate.side/],
    ['plate', { side: 'left' }, /asset or file/],
    ['plate', { file: 'a.jpg', treatment: 'sepia' }, /plate.treatment/],
    ['plate', { file: 'a.jpg', focus: [2, 0] }, /focus/],
  ]) {
    const copy = structuredClone(sb);
    copy.beats[0][field] = value;
    assert.match(job(t, copy).errors.join(), message, field);
  }
  const copy = structuredClone(sb);
  copy.beats[0].block = 'image';
  copy.beats[0].props = { file: 'x.png' };
  copy.beats[0].plate = { file: 'a.jpg', side: 'left' };
  assert.match(job(t, copy).errors.join(), /already show media/);
});

test('film texture accepts presets or amounts and rejects anything else', t => {
  const sb = base();
  sb.beats = [{ id: 's', block: 'statement', duration: 2, props: { text: 'Hi' } }];
  for (const texture of ['film', 'grain', { grain: 0.4, vignette: 1, animate: true }]) {
    sb.texture = texture;
    const r = job(t, sb);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.job.texture, texture);
  }
  sb.texture = 'none';
  assert.equal(job(t, sb).job.texture, undefined);
  for (const texture of ['noise', { grain: 2 }, { sparkle: 1 }]) {
    sb.texture = texture;
    assert.match(job(t, sb).errors.join(), /texture must be/);
  }
});

test('graphic transitions mirror across the cut and fall back to a fade when the outgoing scene has no room', t => {
  const sb = base();
  sb.beats = [
    { id: 'a', block: 'statement', duration: 3, props: { text: 'One' } },
    { id: 'b', block: 'statement', duration: 3, transition: 'iris', props: { text: 'Two' } },
  ];
  let r = job(t, sb);
  assert.deepEqual(r.errors, []);
  assert.equal(r.job.beats[0].exit, 'iris');
  assert.equal(r.job.beats[1].transition, 'iris');
  // The outgoing beat settles too late for the cover to finish before the cut.
  sb.beats[0].duration = 1.0;
  r = job(t, sb);
  assert.equal(r.job.beats[0].exit, 'fade');
  assert.equal(r.job.beats[1].transition, 'fade');
  assert.match(r.warnings.join(), /no room for the iris transition/);
  assert.deepEqual(Object.keys(COVER).sort(), ['iris', 'panel', 'whip']);
});

test('fifteen palettes, kinetic stack mode and centred layouts are part of the contract', () => {
  assert.equal(Object.keys(THEMES).length, 15);
  const k = normalizeProps('kinetic', { mode: 'stack', emphasis: ['film'] });
  assert.equal(k.align, 'center');
  assert.throws(() => normalizeProps('kinetic', { mode: 'highlight', emphasis: ['x'] }), /stack mode/);
  assert.equal(normalizeProps('stat', { value: 3, label: 'x', align: 'center' }).align, 'center');
  assert.throws(() => normalizeProps('stat', { value: 3, label: 'x', align: 'right' }), /align must be/);
  assert.throws(
    () =>
      normalizeProps('bars', {
        data: [
          { label: 'A', value: 1 },
          { label: 'B', value: 2 },
        ],
        align: 'center',
      }),
    /unsupported prop align/,
  );
});
