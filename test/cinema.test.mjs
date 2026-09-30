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

test('a push to a detail resolves its spoken cue; bad rects are refused', t => {
  const r = job(t, {
    beats: [
      {
        id: 'bars',
        block: 'statement',
        vo: 'Most of it goes one way, with a clear outlier.',
        camera: { to: [700, 170, 1160, 652], say: 'outlier' },
        props: { text: 'One way' },
      },
    ],
  });
  assert.deepEqual(r.errors, []);
  const c = r.job.beats[0].camera;
  assert.ok(c.at > 1 && c.dur === 1.4 && c.say == null, JSON.stringify(c));
  assert.match(
    job(t, {
      beats: [{ id: 'x', block: 'statement', camera: { to: [0, 0, 10, 10] }, props: { text: 'x' } }],
    }).errors.join(),
    /camera.to/,
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

test('depth plates: layered assets expand, stage in depth, and cut-outs key to transparency', async t => {
  const { expandAssets, keyOut, CHROMA } = await import('../engine/lib/plates.mjs');
  const { imagePrompt } = await import('../engine/lib/generate.mjs');
  const assets = expandAssets([{ id: 'harbor', kind: 'image', layers: true, prompt: 'A harbour at dusk' }]);
  assert.deepEqual(
    assets.map(a => [a.id, !!a.cutout]),
    [
      ['harbor-far', false],
      ['harbor-mid', true],
      ['harbor-near', true],
    ],
  );
  const sb = { theme: 'cinema', beats: [], continuity: {} };
  assert.ok(imagePrompt(sb, assets[1]).includes(CHROMA) && !imagePrompt(sb, assets[0]).includes(CHROMA));
  const r = job(t, {
    assets: [{ id: 'harbor', kind: 'image', layers: true, prompt: 'A harbour at dusk' }],
    beats: [{ id: 'a', block: 'canvas', vo: 'The harbour wakes.', props: { plates: 'harbor', elements: [] } }],
  });
  // The plates are missing (no paid call in tests), but the staging is in the job props.
  const p = r.job?.beats?.[0]?.props;
  if (p) {
    assert.deepEqual(
      p.elements.slice(0, 3).map(e => e.z),
      [6, 1.2, -0.35],
    );
    assert.ok(p.dolly?.length, 'a slow push by default');
  }
  // Keying: a red disc on flat green becomes a disc on transparency.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-key-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { ffmpeg } = await import('../engine/lib/util.mjs');
  const src = path.join(dir, 'green.png');
  await ffmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    'color=c=0x00FF00:s=64x64',
    '-vf',
    'drawbox=x=16:y=16:w=32:h=32:color=red:t=fill',
    '-frames:v',
    '1',
    src,
  ]);
  const out = await keyOut(src, path.join(dir, 'cut.png'));
  const { spawnSync } = await import('node:child_process');
  const probe = spawnSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'stream=pix_fmt',
    '-of',
    'csv=p=0',
    out,
  ]).stdout.toString();
  assert.match(probe, /rgba/);
});

test('canvas charts: values become shapes with stable ids, so consecutive charts morph', t => {
  const values = [
    { label: 'Answering', value: 45, highlight: true },
    { label: 'Routing', value: 30 },
  ];
  const r = job(t, {
    sources: [{ id: 's', title: 'Sample' }],
    beats: [
      {
        id: 'a',
        block: 'canvas',
        vo: 'Answering takes most of the week.',
        props: { source: 'Sample', chart: { kind: 'stack', values }, elements: [] },
      },
      {
        id: 'b',
        block: 'canvas',
        vo: 'Stand them side by side.',
        props: { source: 'Sample', chart: { kind: 'bars', values }, elements: [] },
      },
    ],
  });
  assert.deepEqual(r.errors, []);
  const bars = r.job.beats[1].props.elements.filter(e => e.type === 'rect');
  assert.deepEqual(
    bars.map(e => e.id),
    ['chart-answering', 'chart-routing'],
  );
  assert.ok(
    bars.every(e => e.morph),
    'each bar morphs from its stack segment',
  );
  assert.ok(bars[0].h > bars[1].h, 'heights follow the values');
  assert.match(
    job(t, {
      beats: [{ id: 'x', block: 'canvas', props: { chart: { kind: 'pie', values }, elements: [] } }],
    }).errors.join(),
    /chart.kind/,
  );
});
