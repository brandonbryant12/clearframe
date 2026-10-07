// Cinematic layer: the film lens and canvas depth (z, dolly, focus, shine).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createJob } from '../film/production.mjs';
import { lensSpec } from '../film/job.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { writeJSON } from '../engine/lib/util.mjs';
import { critique } from '../engine/lib/critique.mjs';

function job(t, sb) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-cinema-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeJSON(path.join(dir, 'storyboard.json'), sb);
  return createJob(loadStoryboard(dir), computeTiming(dir), { draft: true });
}

test('late staged KPI cues warn even when the block cue is early, without retiming the figures', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-lead-in-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeJSON(path.join(dir, 'storyboard.json'), {
    sources: [{ id: 'demo', title: 'Illustrative example' }],
    beats: [
      {
        id: 'caps',
        block: 'kpis',
        duration: 16,
        vo: 'Now seventy five.',
        props: {
          land: 'Now',
          source: 'Illustrative example',
          items: [
            { label: 'Saving cap', value: 75, say: 'seventy five' },
            { label: 'Other cap', value: 50, say: 13 },
          ],
        },
      },
    ],
  });
  const sb = loadStoryboard(dir),
    timing = computeTiming(dir),
    b = timing.beats[0];
  b.vo.words = [
    { w: 'Now', t0: b.start + 0.2, t1: b.start + 0.5 },
    { w: 'seventy', t0: b.start + 11.5, t1: b.start + 11.9 },
    { w: 'five', t0: b.start + 12, t1: b.start + 12.3 },
  ];
  const build = () => createJob(sb, timing, { draft: true });
  const result = build();
  assert.deepEqual(result.errors, []);
  assert.ok(
    result.warnings.some(w => /11.3 s before the first staged item/.test(w)),
    result.warnings.join('\n'),
  );
  assert.equal(result.job.beats[0].props.items[0].at, 11.5);
  sb.beats[0].art = { under: [{ type: 'particles', kind: 'dust', w: 1920, h: 1080, at: 0, enter: 'none' }] };
  const covered = build();
  assert.deepEqual(covered.errors, []);
  assert.ok(!covered.warnings.some(w => /first staged item/.test(w)));
  delete sb.beats[0].art;
  sb.beats[0].pace = 'hold';
  assert.ok(!build().warnings.some(w => /first staged item/.test(w)));
  delete sb.beats[0].pace;
  sb.beats[0].props.items[0].say = 11.5;
  writeJSON(path.join(dir, 'storyboard.json'), sb);
  assert.ok(critique(dir).findings.some(f => f.level === 'warn' && /first staged item/.test(f.message)));
});

test('implicit solid fills on stroked canvas and nested art shapes are called out', t => {
  const r = job(t, {
    beats: [
      {
        id: 'rings',
        block: 'canvas',
        duration: 4,
        props: {
          elements: [
            { type: 'circle', cx: 100, cy: 100, r: 50, stroke: 'accent' },
            { type: 'ellipse', cx: 300, cy: 100, rx: 80, ry: 40, stroke: 'accent', fill: 'none' },
            { type: 'rect', x: 0, y: 0, w: 30, h: 30, stroke: 'ink', fill: 'surface' },
          ],
        },
        art: { over: [{ type: 'group', children: [{ type: 'rect', x: 1, y: 1, w: 10, h: 10, stroke: 'accent' }] }] },
      },
    ],
  });
  assert.deepEqual(r.errors, []);
  const warnings = r.warnings.filter(w => /no explicit fill/.test(w));
  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /fill: "none"/);
  assert.equal(r.job.beats[0].props.elements[0].fill, undefined, 'existing filled artwork retains its default');
});

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

test('a normal storyboard expands background sketches with frame-zero art and preserves authored layers', t => {
  const result = job(t, {
    theme: 'daylight', format: { preset: 'vertical' }, captions: false,
    beats: [{ id: 'a', block: 'statement', duration: 4,
      props: { text: 'A clear idea' },
      art: { sketch: 'paper-fold', opacity: 0.7,
        under: [{ type: 'circle', cx: 80, cy: 80, r: 8, fill: 'accent' }],
        over: [{ type: 'circle', cx: 90, cy: 90, r: 4, fill: 'accent2' }],
      },
    }],
  });
  assert.deepEqual(result.errors, []);
  const art = result.job.beats[0].art;
  assert.equal(art.under[0].at, 0);
  assert.equal(art.under[0].opacity, 0.7);
  assert.equal(art.under[1].cx, 80);
  assert.equal(art.over[0].cx, 90);
});

test('a drifting art layer spans its resolved beat, even under a second, and never holds it', t => {
  const beat = (art, extra = { duration: 3 }) => ({ id: 'a', block: 'statement', ...extra, props: { text: 'A clear idea' }, art });
  const film = art => ({
    theme: 'neon',
    captions: false,
    beats: [
      beat(art),
      { ...beat(art, { duration: 0.5 }), id: 'quick' },
      // No authored duration: the narration sets the beat's length.
      { ...beat(art, { vo: 'A longer spoken line sets how long this beat runs on screen.' }), id: 'spoken' },
    ],
  });
  const r = job(t, film({ sketch: 'arena-grid', drift: 0.8 })),
    still = job(t, film({ sketch: 'arena-grid' }));
  assert.deepEqual(r.errors, []);
  r.job.beats.forEach((b, i) => {
    const key = b.art.under[0].keys[0];
    assert.ok(Math.abs(key.dur - b.frames / 30) < 0.02, `${b.id}: the push spans the ${b.frames / 30} s beat, not ${key.dur} s`);
    assert.equal(b.settle_seconds, still.job.beats[i].settle_seconds, `${b.id}: ambient drift does not hold the beat`);
  });
  assert.ok(r.job.beats[1].frames / 30 < 1 && r.job.beats[2].frames / 30 > 3);
  assert.match(job(t, { beats: [beat({ drift: 0.5, under: [] })] }).errors.join('\n'), /require art.sketch/);
});

test('critique judges native stages as drawings, and a film stage as continuity across its cuts', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-stage-critique-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const actors = [{ id: 'a', label: 'API', x: 600, y: 600 }, { id: 'b', label: 'Queue', x: 1300, y: 600 }];
  writeJSON(path.join(dir, 'storyboard.json'), {
    format: { preset: 'landscape' }, camera: 'none',
    stages: [{ id: 'flow', from: 'one', to: 'three', actors, links: [{ from: 'a', to: 'b' }] }],
    beats: ['one', 'two', 'three', 'four'].map(id => ({ id, block: 'stage', vo: `Why does the ${id} step wait? The queue answers it, and the worker keeps going.`, props: {} })),
  });
  const r = critique(dir);
  assert.ok(r.summary.drawn >= 4, `stages count as drawn (${r.summary.drawn})`);
  const said = r.findings.map(f => f.message).join('\n');
  assert.doesNotMatch(said, /Nothing is drawn/);
  assert.doesNotMatch(said, /one, two, three|Three drawing scenes in a row/, 'beats inside one film stage are one continuous picture, not a run of cards');
  assert.doesNotMatch(said, /No question is ever asked/, 'a question opening a line counts');
});
