// Cinematic layer: the film lens and canvas depth (z, dolly, focus, shine).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createJob } from '../fframes/production.mjs';
import { lensSpec } from '../fframes/job.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { writeJSON } from '../engine/lib/util.mjs';

function job(t, sb) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-cinema-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeJSON(path.join(dir, 'storyboard.json'), sb);
  return createJob(loadStoryboard(dir), computeTiming(dir), { draft: true });
}

test('lens settings validate, and each beat carries the film lens merged with its own', t => {
  assert.throws(() => lensSpec({ letterbox: 5 }), /letterbox/);
  assert.throws(() => lensSpec({ grade: 'vivid' }), /grade/);
  assert.throws(() => lensSpec({ bloom: 2 }), /bloom/);
  assert.throws(() => lensSpec({ flare: 1 }), /not a lens setting/);
  const r = job(t, {
    lens: { letterbox: 2.39, grade: 'teal-orange', handheld: 0.4 },
    beats: [
      { id: 'a', block: 'statement', vo: 'A quiet start.', props: { text: 'A quiet start' } },
      {
        id: 'b',
        block: 'statement',
        vo: 'Then the frame opens.',
        lens: { letterbox: false, bloom: 0.5 },
        props: { text: 'Then it opens' },
      },
    ],
  });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.job.beats[0].lens, { letterbox: 2.39, grade: 'teal-orange', handheld: 0.4 });
  assert.deepEqual(r.job.beats[1].lens, { letterbox: 0, grade: 'teal-orange', handheld: 0.4, bloom: 0.5 });
  assert.match(
    job(t, { lens: { grade: 'nope' }, beats: [{ id: 'a', block: 'statement', props: { text: 'x' } }] }).errors.join(),
    /grade/,
  );
});

test('canvas depth: z, dolly and focus keys resolve spoken cues; shine waits for the element', t => {
  const r = job(t, {
    beats: [
      {
        id: 'fly',
        block: 'canvas',
        vo: 'We fly past the first gate toward the city.',
        props: {
          dolly: [
            { say: 'city', z: 3 },
            { at: 0.2, z: 1, dur: 1 },
          ],
          focus: { z: 2, aperture: 1.2, keys: [{ say: 'gate', z: 0 }] },
          elements: [
            { type: 'rect', x: 100, y: 100, w: 300, h: 300, z: 2, blur: 4, keys: [{ at: 0.5, blur: 0 }] },
            { type: 'text', text: 'City', x: 960, y: 540, size: 120, at: 0.2, shine: { every: 4 } },
          ],
        },
      },
    ],
  });
  assert.deepEqual(r.errors, []);
  const p = r.job.beats[0].props;
  assert.deepEqual(
    p.dolly.map(k => k.z),
    [1, 3],
    'keys sorted by time',
  );
  assert.ok(p.dolly.every(k => Number.isFinite(k.at) && k.dur > 0));
  assert.ok(Number.isFinite(p.focus.keys[0].at));
  const title = p.elements[1];
  assert.equal(title.shine.at, title.at + title.dur, 'the sweep follows the entrance');
  const bad = (props, re) => assert.match(job(t, { beats: [{ id: 'x', block: 'canvas', props }] }).errors.join(), re);
  const box = extra => ({ type: 'rect', x: 0, y: 0, w: 10, h: 10, ...extra });
  bad({ elements: [box({ z: -1 })] }, /z must be/);
  bad({ elements: [box({ blur: 99 })] }, /blur must be/);
  bad({ dolly: [{ z: 2 }], elements: [box()] }, /needs at/);
  bad({ focus: { aperture: 9 }, elements: [box()] }, /aperture/);
  bad({ elements: [{ type: 'text', text: 'x', shine: { width: 3 } }] }, /shine.width/);
});
