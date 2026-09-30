import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { BLOCKS, normalizeProps, palette, precision } from '../fframes/catalog.mjs';
import { PLAYBOOKS, scaffold, storyboardFor } from '../fframes/playbooks.mjs';
import { createJob, missingGlyph } from '../fframes/production.mjs';
import { THEMES, findPhrase } from '../fframes/catalog.mjs';
import { wireframePNG } from '../fframes/wireframe.mjs';
import { computeTiming, findWord, toSRT } from '../engine/lib/timing.mjs';
import { loadStoryboard, validateStoryboard } from '../engine/lib/project.mjs';
import { pcmToWav, writeJSON, hashOf } from '../engine/lib/util.mjs';
import { normalizeWords, validateWords, activeWord, audioHash } from '../engine/lib/word-timing.mjs';
import { alignSpeech, transcriptionRequest, transcribeSpeech } from '../engine/lib/speech.mjs';
import { clipSpec } from '../engine/lib/continuity.mjs';
import * as omni from '../skills/gemini-omni/scripts/omni.mjs';
import { fileName, downloadVideo, uploadAudio } from '../engine/lib/google-files.mjs';
import { ICONS, ICON_SOURCE } from '../fframes/icons.mjs';
import { reviewSamples, reviewProject } from '../engine/lib/review.mjs';
import crypto from 'node:crypto';

function project(t, sb) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-native-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeJSON(path.join(dir, 'storyboard.json'), sb);
  return dir;
}
test('all 33 catalog examples validate in landscape and vertical without mutating author input', () => {
  assert.equal(BLOCKS.length, 33);
  for (const b of BLOCKS)
    for (const vertical of [false, true]) {
      const before = JSON.stringify(b.example);
      normalizeProps(b.name, b.example, { vertical });
      assert.equal(JSON.stringify(b.example), before);
    }
});
test('twenty-seven distinct playbooks compile to native jobs without paid assets, slide chrome or custom code', t => {
  assert.equal(PLAYBOOKS.length, 29);
  const arcs = new Set();
  for (const p of PLAYBOOKS) {
    const root = project(t, storyboardFor(p.id)),
      sb = loadStoryboard(root),
      result = createJob(sb, computeTiming(root), { draft: true });
    assert.deepEqual(result.errors, [], p.id);
    assert.ok(result.job.beats.every(b => b.frames > 0));
    assert.equal(result.job.chrome, false);
    arcs.add(result.job.beats.map(b => b.block).join(','));
    assert.equal(sb.assets.length, 0);
  }
  assert.equal(arcs.size, 29);
});
test('graphic contracts reject unknown assets and invalid phase clocks while preserving cue controls', t => {
  assert.equal(
    normalizeProps(
      'flow',
      { nodes: [{ label: 'Start' }, { label: 'End' }], orientation: 'horizontal' },
      { vertical: true },
    ).orientation,
    'vertical',
  );
  assert.throws(() => normalizeProps('icon-grid', { items: [{ icon: 'nonexistent', label: 'Bad' }] }), /unknown icon/);
  assert.throws(
    () => normalizeProps('cycle', { nodes: [{ label: 'A' }, { label: 'B' }, { label: 'C' }], period: 0 }),
    /period/,
  );
  assert.throws(
    () =>
      normalizeProps('breathing', {
        phases: [
          { label: 'In', seconds: 0 },
          { label: 'Out', seconds: 4 },
        ],
      }),
    /seconds/,
  );
  assert.throws(
    () =>
      normalizeProps('breathing', {
        phases: [
          { label: 'In', seconds: 3 },
          { label: 'Out', seconds: 4 },
        ],
        minScale: 1,
        maxScale: 1,
      }),
    /scales/,
  );
  const p = normalizeProps('breathing', {
    phases: [
      { label: 'In', seconds: 3 },
      { label: 'Out', seconds: 4 },
    ],
  });
  assert.deepEqual(
    p.phases.map(p => p.scale),
    ['expand', 'contract'],
  );
  const sb = storyboardFor('science-lesson');
  sb.beats = [
    {
      id: 'flow',
      block: 'flow',
      duration: 5,
      props: {
        nodes: [
          { label: 'Start', say: 0.25 },
          { label: 'End', say: 2 },
        ],
      },
    },
  ];
  const root = project(t, sb),
    result = createJob(loadStoryboard(root), computeTiming(root));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(
    result.job.beats[0].props.nodes.map(n => n.at),
    [0.25, 2],
  );
});
test('all bundled icon bytes match the MIT source manifest', () => {
  assert.equal(ICONS.length, 95);
  assert.equal(ICON_SOURCE.license, 'MIT');
  const dir = new URL('../fframes/assets/icons/tabler/', import.meta.url),
    manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', dir)));
  assert.match(fs.readFileSync(new URL('LICENSE', dir), 'utf8'), /^MIT License/);
  for (const f of manifest.files)
    assert.equal(
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(new URL(f.file, dir)))
        .digest('hex'),
      f.sha256,
      f.file,
    );
});
test('dense automatic arrivals finish before the last frame; late authored cues fail', t => {
  const sb = storyboardFor('science-lesson');
  sb.beats = [
    {
      id: 'dense',
      block: 'icon-grid',
      duration: 1.5,
      props: { items: Array.from({ length: 8 }, (_, i) => ({ icon: 'leaf', label: `Leaf ${i}` })) },
    },
  ];
  let root = project(t, sb),
    r = createJob(loadStoryboard(root), computeTiming(root));
  assert.deepEqual(r.errors, []);
  assert.ok(r.job.beats[0].props.items.every(it => it.at + 0.55 <= 1.5 - 1 / 30));
  sb.beats[0].props.items[7].say = 1.4;
  root = project(t, sb);
  r = createJob(loadStoryboard(root), computeTiming(root));
  assert.match(r.errors.join(), /too late/);
  delete sb.beats[0].props.items[7].say;
  sb.beats[0].duration = 0.2;
  root = project(t, sb);
  assert.match(createJob(loadStoryboard(root), computeTiming(root)).errors.join(), /too short/);
  sb.beats[0].duration = 1.5;
  sb.beats[0].props.land = 0.9;
  root = project(t, sb);
  r = createJob(loadStoryboard(root), computeTiming(root));
  assert.deepEqual(r.errors, []);
  assert.ok(
    r.job.beats[0].props.items.every(it => it.at === 0.9),
    'An explicit scene cue must never move earlier',
  );
  sb.beats[0].props.land = 1.1;
  root = project(t, sb);
  assert.match(createJob(loadStoryboard(root), computeTiming(root)).errors.join(), /Scene cue is too late/);
});
test('encoded review samples both sides of cuts and uses end-exclusive word frames', () => {
  const timing = {
    fps: 30,
    frames: 90,
    beats: [
      { id: 'a', start: 0, end: 1, vo: { words: [{ w: 'Hi', t0: 0.105, t1: 0.401 }] } },
      { id: 'b', start: 1, end: 3 },
    ],
  };
  const samples = reviewSamples(timing),
    frames = samples.map(s => s.frame);
  for (const f of [0, 3, 4, 12, 13, 29, 30, 89]) assert.ok(frames.includes(f), `frame ${f}`);
  assert.equal(new Set(frames).size, frames.length);
  assert.ok(samples.every(s => s.frame >= 0 && s.frame < 90));
  assert.throws(() => reviewSamples(timing, { beat: 'missing' }), /No beat/);
});
test('encoded review refuses a video whose receipt no longer matches its bytes', async t => {
  const root = project(t, storyboardFor('science-lesson')),
    file = path.join(root, 'build/video.mp4');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'replaced bytes');
  writeJSON(`${file}.json`, { outputSha256: 'stale' });
  await assert.rejects(reviewProject(root), /Video changed/);
});
test('scaffold refuses to overwrite a project', t => {
  const dir = project(t, storyboardFor('speech-story'));
  assert.throws(() => scaffold(dir), /not empty/);
});
test('palettes accept scoped hex overrides and reject typos', () => {
  assert.equal(palette({ base: 'ink', accent: '#aa00ff' }).accent, '#aa00ff');
  assert.equal(palette('ink').bg, '#101721');
  assert.throws(() => palette({ accent: 'purple' }));
  assert.throws(() => palette({ foreground: '#ffffff' }));
});
test('chart contracts preserve suffix precision, zero scales, and configurable focus', () => {
  assert.equal(precision(1e-7), 7);
  assert.equal(normalizeProps('stat', { value: 12.4, suffix: ' ms', label: 'Delay' }).decimals, 1);
  const b = normalizeProps('bars', {
    data: [
      { label: 'A', value: 0 },
      { label: 'B', value: 0 },
    ],
    focus: { label: 'B', dim: 0, dur: 0 },
    format: ' ms',
  });
  assert.equal(b.max, 1);
  assert.equal(b.focus.index, 1);
  assert.equal(b.focus.dim, 0);
  assert.equal(b.focus.dur, 0);
  assert.equal(b.format.suffix, ' ms');
  assert.throws(
    () =>
      normalizeProps('bars', {
        data: [
          { label: 'A', value: -1 },
          { label: 'B', value: 4 },
        ],
      }),
    /nonnegative/,
  );
  assert.throws(
    () =>
      normalizeProps('bars', {
        data: [
          { label: 'A', value: 1 },
          { label: 'B', value: 4 },
        ],
        max: 2,
      }),
    /cover/,
  );
  assert.equal(
    normalizeProps('delta', { from: { value: 0, label: 'Before' }, to: { value: 3, label: 'After' } }).change,
    'From zero',
  );
});
test('native rejects legacy scenes, unknown props, and missing numeric sources', t => {
  const sb = storyboardFor('concept-explainer');
  sb.beats = [{ id: 'bad', block: 'stat', duration: 3, props: { value: 3, label: 'Count' } }];
  let root = project(t, sb);
  assert.match(createJob(loadStoryboard(root), computeTiming(root)).errors.join(), /source/);
  sb.beats = [{ id: 'bad', scene: 'scenes/custom.js', duration: 3 }];
  root = project(t, sb);
  assert.match(createJob(loadStoryboard(root), computeTiming(root)).errors.join(), /retired/);
  assert.throws(() => normalizeProps('stat', { value: 1, sufix: 'k' }), /unsupported/);
});
test('input validation rejects path-like asset ids, invalid durations and negative leads', () => {
  assert.ok(
    validateStoryboard({
      beats: [{ id: 'a', duration: '3', lead: -1 }],
      assets: [{ id: '../leak', kind: 'clip', prompt: 'x' }],
    }).length >= 3,
  );
  assert.deepEqual(
    validateStoryboard({
      beats: [{ id: 'a', block: 'image' }],
      assets: [{ id: 'a', kind: 'image', file: 'assets/a.png' }],
    }),
    [],
  );
});
test('spoken cues match complete words, not prefixes or empty punctuation', () => {
  const words = [
    { w: 'The', t0: 0 },
    { w: 'thirty', t0: 1 },
    { w: 'three', t0: 2 },
  ];
  assert.equal(findWord(words, 'three'), 2);
  assert.equal(findWord(words, 'th'), null);
  assert.equal(findWord(words, '!!!'), null);
});
test('word import accepts native, WhisperX, and Gemini REST annotations', () => {
  const expected = [{ w: 'Hello', t0: 0.1, t1: 0.4 }];
  assert.deepEqual(normalizeWords({ segments: [{ words: [{ word: 'Hello', start: 0.1, end: 0.4 }] }] }), expected);
  assert.deepEqual(
    normalizeWords({
      steps: [
        {
          type: 'model_output',
          content: [
            {
              type: 'text',
              annotations: [{ type: 'word_info', text: 'Hello', start_offset: '0.100s', end_offset: '0.400s' }],
            },
          ],
        },
      ],
    }),
    expected,
  );
  assert.deepEqual(normalizeWords(expected), expected);
});
test('alignment never hides missing words, overlaps, or stale transcripts', () => {
  const w = [
    { w: 'Hello,', t0: 0.1, t1: 0.4 },
    { w: 'world.', t0: 0.5, t1: 0.9 },
  ];
  assert.deepEqual(validateWords(w, ['Hello', 'world'], 1), w);
  assert.throws(() => validateWords(w, ['Hello'], 1), /mismatch/);
  assert.throws(() => validateWords(w, ['Goodbye', 'world'], 1), /mismatch/);
  assert.throws(() => validateWords([{ ...w[0], t1: 0.501 }, w[1]], ['Hello', 'world'], 1), /Invalid/);
  assert.throws(() => normalizeWords({ segments: [{ text: 'Hello', start: 0, end: 1 }] }), /No word/);
});
test('word selection is end-exclusive, gap-aware, and stable under backward seeks', () => {
  const w = [
    { t0: 0.1, t1: 0.4 },
    { t0: 0.5, t1: 0.9 },
  ];
  for (const [time, index] of [
    [0.5, 1],
    [0.1, 0],
    [0.4, -1],
    [0.9, -1],
    [0.3, 0],
    [0, -1],
  ])
    assert.equal(activeWord(w, time), index);
  assert.doesNotMatch(toSRT([{ start: 0, end: 0.4, text: 'Hello' }]), /00:00:00,550/);
});
test('final kinetic rejects estimates, accepts measured words, then rejects replaced audio', t => {
  const sb = storyboardFor('speech-story');
  sb.beats = [{ id: 'speech', block: 'kinetic', vo: 'Hello world', props: { mode: 'highlight' } }];
  const root = project(t, sb),
    vo = path.join(root, 'assets/vo');
  fs.mkdirSync(vo, { recursive: true });
  const file = path.join(vo, 'speech.wav');
  fs.writeFileSync(file, pcmToWav(Buffer.alloc(48000)));
  writeJSON(path.join(vo, 'speech.json'), { textHash: hashOf('Hello world'), provider: 'imported', duration: 1 });
  let result = createJob(loadStoryboard(root), computeTiming(root));
  assert.match(result.errors.join(), /measured/);
  alignSpeech(root, {
    beat: 'speech',
    words: [
      { w: 'Hello', t0: 0.1, t1: 0.4 },
      { w: 'world', t0: 0.5, t1: 0.9 },
    ],
  });
  const timing = computeTiming(root);
  assert.equal(timing.beats[0].vo.wordTiming, 'measured');
  assert.deepEqual(createJob(loadStoryboard(root), timing).errors, []);
  const changed = fs.readFileSync(file);
  changed[100] = 1;
  fs.writeFileSync(file, changed);
  result = createJob(loadStoryboard(root), computeTiming(root));
  assert.match(result.errors.join(), /audio changed/);
});
test('a final native job preserves quantized timing and known word boundaries', t => {
  const sb = storyboardFor('concept-explainer');
  sb.beats = [
    { id: 'a', block: 'statement', duration: 1.111, props: { text: 'First' } },
    { id: 'b', block: 'title', duration: 2.222, props: { text: 'Next' } },
  ];
  const root = project(t, sb);
  const { job, errors } = createJob(loadStoryboard(root), computeTiming(root));
  assert.deepEqual(errors, []);
  assert.equal(job.beats[1].start_frame, job.beats[0].frames);
  assert.equal(
    job.frames,
    job.beats.reduce((n, b) => n + b.frames, 0),
  );
});
test('Omni request uses documented fields, MP4 URI delivery and reference order', t => {
  const dir = project(t, storyboardFor('documentary-hybrid'));
  const ref = path.join(dir, 'ref.png');
  fs.writeFileSync(ref, 'image');
  const r = omni.buildRequest({ prompt: 'One continuous shot', refs: [ref], previousInteractionId: 'previous' });
  assert.equal(r.model, 'gemini-omni-1.1-flash');
  assert.equal(r.input[0].type, 'image');
  assert.equal(r.previous_interaction_id, 'previous');
  assert.deepEqual(r.response_format, { type: 'video', aspect_ratio: '16:9', resolution: '720p', delivery: 'uri' });
  assert.equal(r.duration_seconds, undefined);
  assert.ok(omni.estimateCost({ seconds: 4 }) > 0.4);
  assert.throws(() => omni.estimateCost({ resolution: '4k' }), /720p/);
});
test('clip cache changes with palette, continuity instructions and reference bytes', t => {
  const root = project(t, storyboardFor('documentary-hybrid')),
    sb = loadStoryboard(root),
    a = { id: 'plate', prompt: 'A quiet room', image: 'reference.png', seconds: 4 };
  fs.writeFileSync(path.join(root, 'reference.png'), 'one');
  const before = clipSpec(root, sb, a);
  assert.match(before.prompt, /No written words/);
  assert.match(before.prompt, /#f7efe1/);
  fs.writeFileSync(path.join(root, 'reference.png'), 'two');
  assert.notEqual(clipSpec(root, sb, a).hash, before.hash);
  assert.notEqual(clipSpec(root, { ...sb, theme: 'ink' }, a).hash, before.hash);
});
test('transcription request nests word timestamps under verbatim mode', () => {
  const r = transcriptionRequest('files/speech');
  assert.equal(r.model, 'gemini-3.5-transcribe');
  assert.deepEqual(r.generation_config, {
    transcription_config: { mode: { type: 'verbatim', timestamp_granularities: ['word'] } },
  });
});
test('Google file names reject foreign hosts and prevent credential forwarding', async t => {
  assert.throws(() => fileName('https://evil.test/files/a'), /Untrusted/);
  assert.equal(fileName('https://generativelanguage.googleapis.com/v1beta/files/a:download?alt=media'), 'files/a');
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    calls.push({ url, opts });
    if (calls.length === 1) return new Response(JSON.stringify({ state: 'ACTIVE' }));
    if (calls.length === 2)
      return new Response(null, { status: 302, headers: { location: 'https://storage.googleapis.com/signed-video' } });
    return new Response(Buffer.from('video'));
  });
  await downloadVideo('files/a', { key: 'test-only-key' });
  assert.equal(calls[0].opts.headers['x-goog-api-key'], 'test-only-key');
  assert.deepEqual(calls[2].opts.headers, {});
});
test('Omni handles inline REST output without a live paid call', async t => {
  const data = Buffer.from([0, 0, 0, 24, ...Buffer.from('ftypisom')]);
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        JSON.stringify({
          status: 'completed',
          id: 'mock',
          steps: [
            {
              type: 'model_output',
              content: [{ type: 'video', mime_type: 'video/mp4', data: data.toString('base64') }],
            },
          ],
        }),
      ),
  );
  const r = await omni.generateVideo({ prompt: 'A quiet plate', key: 'test-only-key' });
  assert.deepEqual(r.data, data);
  assert.equal(r.interactionId, 'mock');
});

test('draft generation preserves imported aligned recordings unless forced', async t => {
  const sb = storyboardFor('speech-story');
  sb.beats = [{ id: 'speech', block: 'kinetic', vo: 'Hello', props: { mode: 'word' } }];
  const root = project(t, sb),
    dir = path.join(root, 'assets/vo');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'speech.wav');
  fs.writeFileSync(file, pcmToWav(Buffer.alloc(48000)));
  writeJSON(path.join(dir, 'speech.json'), { provider: 'imported', textHash: hashOf('Hello'), duration: 1 });
  const hash = audioHash(file);
  const { voice, plan } = await import('../engine/lib/generate.mjs');
  await voice(root, { draft: true });
  assert.equal(audioHash(file), hash);
  assert.equal(plan(root).rows[0].cost, 0);
});

test('speech transcription uploads only the selected take, aligns it, and deletes the upload', async t => {
  const sb = storyboardFor('speech-story');
  sb.beats = [{ id: 'speech', block: 'kinetic', vo: 'Hello', props: { mode: 'word' } }];
  const root = project(t, sb),
    dir = path.join(root, 'assets/vo');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'speech.wav'), pcmToWav(Buffer.alloc(48000)));
  writeJSON(path.join(dir, 'speech.json'), { provider: 'imported', textHash: hashOf('Hello'), duration: 1 });
  const old = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'mock-speech-key';
  t.after(() => {
    if (old == null) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = old;
  });
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    calls.push({ url, opts });
    if (url.endsWith('/upload/v1beta/files'))
      return new Response('{}', {
        headers: { 'x-goog-upload-url': 'https://generativelanguage.googleapis.com/upload/test' },
      });
    if (url.endsWith('/upload/test'))
      return new Response(
        JSON.stringify({
          file: { name: 'files/test', uri: 'https://generativelanguage.googleapis.com/v1beta/files/test' },
        }),
      );
    if (opts.method === 'DELETE') return new Response('{}');
    if (url.endsWith('/interactions'))
      return new Response(
        JSON.stringify({
          status: 'completed',
          steps: [
            {
              type: 'model_output',
              content: [
                {
                  type: 'text',
                  annotations: [{ type: 'word_info', text: 'Hello', start_offset: '0.1s', end_offset: '0.9s' }],
                },
              ],
            },
          ],
        }),
      );
    return new Response(JSON.stringify({ state: 'ACTIVE' }));
  });
  const words = await transcribeSpeech(root, { beat: 'speech', budget: 0.01 });
  assert.equal(words.length, 1);
  assert.equal(calls.at(-1).opts.method, 'DELETE');
  assert.equal(computeTiming(root).beats[0].vo.wordTiming, 'measured');
  assert.ok(fs.existsSync(path.join(dir, 'speech.transcription.json')));
  const count = calls.length;
  await transcribeSpeech(root, { beat: 'speech', budget: 0 });
  assert.equal(calls.length, count, 'reuses measured timestamps without another paid request');
});

test('upload refuses a redirecting or foreign resumable destination', async t => {
  const dir = project(t, storyboardFor('speech-story')),
    file = path.join(dir, 'take.wav');
  fs.writeFileSync(file, pcmToWav(Buffer.alloc(48000)));
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('{}', { headers: { 'x-goog-upload-url': 'https://unrelated.test/upload' } }),
  );
  await assert.rejects(uploadAudio(file, { key: 'test' }), /Invalid resumable/);
});

const native = file => fs.readFileSync(new URL(`../fframes/native/src/${file}`, import.meta.url), 'utf8');
const job = (t, beats, extra = {}) => {
  const sb = { ...storyboardFor('concept-explainer'), ...extra, beats };
  const root = project(t, sb);
  return createJob(loadStoryboard(root), computeTiming(root));
};

test('the renderer and catalog agree on every block name and palette color', () => {
  const rust = [
    ...native('lib.rs')
      .match(/pub const BLOCKS: &\[&str\] = &\[([\s\S]*?)\];/)[1]
      .matchAll(/"([a-z-]+)"/g),
  ].map(m => m[1]);
  assert.deepEqual([...rust].sort(), BLOCKS.map(b => b.name).sort());
  const presets = Object.fromEntries(
    [...native('design.rs').matchAll(/\("([a-z]+)", \[([^\]]+)\]\)/g)].map(m => [
      m[1],
      [...m[2].matchAll(/"(#[0-9a-f]{6})"/g)].map(x => x[1]),
    ]),
  );
  assert.deepEqual(Object.keys(presets), Object.keys(THEMES));
  for (const [name, colors] of Object.entries(THEMES))
    assert.deepEqual(
      presets[name],
      ['bg', 'surface', 'ink', 'muted', 'accent', 'accent2', 'positive', 'negative'].map(k => colors[k]),
      name,
    );
});
test('emphasis and highlight phrases must be whole words of the displayed text', () => {
  assert.equal(findPhrase('An average can hide a long tail.', 'long tail'), 22);
  assert.equal(findPhrase('scattered', 'cat'), -1);
  assert.equal(findPhrase('a  long\ntail', 'long tail'), 2);
  assert.throws(
    () => normalizeProps('statement', { text: 'Busy is not effective', emphasis: ['effect'] }),
    /whole words/,
  );
  assert.throws(() => normalizeProps('highlight', { text: 'A long tail', phrases: ['short'] }), /whole words/);
  assert.deepEqual(normalizeProps('highlight', { text: 'A long tail', phrases: ['long tail'] }).phrases, [
    { text: 'long tail' },
  ]);
  assert.throws(() => normalizeProps('statement', { text: 'x', emphasis: [] }), /1–4/);
});
test('new blocks reject values that cannot be drawn honestly', () => {
  assert.throws(
    () =>
      normalizeProps('donut', {
        segments: [
          { label: 'A', value: 0 },
          { label: 'B', value: 0 },
        ],
      }),
    /positive total/,
  );
  assert.throws(
    () =>
      normalizeProps('donut', {
        segments: [
          { label: 'A', value: -1 },
          { label: 'B', value: 3 },
        ],
      }),
    /nonnegative/,
  );
  assert.throws(
    () =>
      normalizeProps('magnitude', {
        items: [
          { label: 'A', value: 0 },
          { label: 'B', value: 3 },
        ],
      }),
    /positive/,
  );
  assert.throws(() => normalizeProps('annotate', { file: 'a.png', pins: [{ x: 1.2, y: 0.5, label: 'A' }] }), /0 to 1/);
  assert.throws(
    () =>
      normalizeProps('annotate', {
        file: 'a.png',
        pins: [{ x: 0.5, y: 0.5, label: 'A' }],
        focus: { x: 0.7, y: 0, w: 0.5, h: 0.5 },
      }),
    /inside/,
  );
  assert.throws(() => normalizeProps('callout', { text: 'x', icon: 'nope' }), /unknown icon/);
  assert.throws(
    () => normalizeProps('delta', { from: { value: 1 }, to: { value: 2 }, better: 'sideways' }),
    /up or down/,
  );
  assert.throws(
    () =>
      normalizeProps('matrix', {
        columns: ['A', 'B'],
        rows: [
          { label: 'r', values: ['1', '2'] },
          { label: 's', values: ['3', '4'] },
        ],
        highlight: 2,
      }),
    /column index/,
  );
  assert.deepEqual(normalizeProps('checklist', { items: ['One', 'Two'] }).items, [{ text: 'One' }, { text: 'Two' }]);
  assert.equal(normalizeProps('chapter', { text: 'Part one' }).title, 'Part one');
});
test('each scene exits the way the next one enters, and the film ends on a fade', t => {
  const beats = ['fade', 'cut', 'push', 'zoom', 'wipe', 'rise'].map((transition, i) => ({
    id: `b${i}`,
    block: 'statement',
    duration: 2,
    transition,
    props: { text: `Scene ${i}` },
  }));
  const first = job(t, beats);
  assert.deepEqual(first.errors, []);
  assert.deepEqual(
    first.job.beats.map(b => b.exit),
    ['none', 'push', 'zoom', 'wipe', 'fade', 'fade'],
  );
  beats[5].exit = 'none';
  beats[0].exit = 'wipe';
  assert.deepEqual(
    job(t, beats).job.beats.map(b => b.exit),
    ['wipe', 'push', 'zoom', 'wipe', 'fade', 'none'],
  );
  beats[1].exit = 'dissolve';
  assert.match(job(t, beats).errors.join(), /exit must be/);
});
test('a beat that ends before its numbers finish counting fails, but drafts only warn', t => {
  const sb = {
    ...storyboardFor('concept-explainer'),
    beats: [
      {
        id: 'short',
        block: 'stat',
        duration: 1.2,
        props: { value: 4.2, suffix: ' days', label: 'Wait', source: 'Sample' },
      },
    ],
  };
  const root = project(t, sb);
  let r = createJob(loadStoryboard(root), computeTiming(root));
  assert.match(r.errors.join(), /finish counting/);
  r = createJob(loadStoryboard(root), computeTiming(root), { draft: true });
  assert.deepEqual(r.errors, []);
  assert.match(r.warnings.join(), /finish counting/);
  sb.beats[0].duration = 2.5;
  const ok = project(t, sb);
  assert.deepEqual(createJob(loadStoryboard(ok), computeTiming(ok)).errors, []);
});
test('text the bundled fonts cannot draw fails with the character and its location', t => {
  assert.equal(missingGlyph('Café — 42% → “ok” Ωμέγα Привет'), null);
  assert.equal(missingGlyph('Hello 東京'), '東');
  assert.equal(
    missingGlyph('co\u00ADoperate \u00A9\uFE0F join\u200Dme word\u2060joiner'),
    null,
    'invisible format characters render without boxes',
  );
  assert.equal(missingGlyph('launch 🚀'), '🚀');
  const { errors } = job(t, [{ id: 'cjk', block: 'title', duration: 3, props: { text: '駅はどこですか' } }]);
  assert.match(errors.join(), /U\+99C5.*cjk\.props\.text/);
  assert.deepEqual(
    job(t, [{ id: 'ok', block: 'title', duration: 3, props: { text: 'Plain text', kicker: 'Überblick' } }]).errors,
    [],
  );
});
test('staged items of every sequence block fit inside their beat', t => {
  const { job: j, errors } = job(t, [
    { id: 'list', block: 'checklist', duration: 2.4, props: { items: ['One', 'Two', 'Three', 'Four', 'Five', 'Six'] } },
  ]);
  assert.deepEqual(errors, []);
  const items = j.beats[0].props.items;
  assert.ok(
    items.every(it => it.at + 0.55 <= 2.4 - 1 / 30 + 1e-9),
    'every check completes before the cut',
  );
  assert.ok(items.every((it, i) => !i || it.at > items[i - 1].at));
  assert.ok(
    items.every(it => !('say' in it)),
    'spoken cue words are resolved, not passed to the renderer',
  );
});
test('bundled font instances and their tabular figures match recorded provenance', () => {
  const dir = new URL('../fframes/assets/fonts/', import.meta.url),
    provenance = JSON.parse(fs.readFileSync(new URL('provenance.json', dir)));
  const files = [...provenance.files, ...provenance.staticInstances];
  assert.ok(provenance.staticInstances.some(f => f.family === 'Inter Display Figures'));
  for (const f of files)
    assert.equal(
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(new URL(f.file, dir)))
        .digest('hex'),
      f.sha256,
      f.file,
    );
  const coverage = JSON.parse(fs.readFileSync(new URL('coverage.json', dir)));
  assert.deepEqual(
    coverage.fonts,
    provenance.staticInstances.map(f => f.file),
  );
});
test('placeholder screenshots are deterministic PNGs and scaffold with their playbook', t => {
  const a = wireframePNG(THEMES.signal),
    b = wireframePNG(THEMES.signal);
  assert.ok(a.equals(b));
  assert.equal(a.subarray(1, 4).toString(), 'PNG');
  assert.notDeepEqual(wireframePNG(THEMES.ink), a);
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cf-scaffold-')), 'walk');
  t.after(() => fs.rmSync(path.dirname(dir), { recursive: true, force: true }));
  scaffold(dir, { playbook: 'screen-walkthrough' });
  assert.ok(fs.readFileSync(path.join(dir, 'assets/screen.png')).subarray(1, 4).toString() === 'PNG');
});

test('settle times include labels, and every beat tells the renderer when its values are final', t => {
  const sb = {
    ...storyboardFor('concept-explainer'),
    beats: [{ id: 'trend', block: 'line', duration: 2, props: { series: [1, 2, 3], source: 'Sample' } }],
  };
  const root = project(t, sb);
  assert.match(
    createJob(loadStoryboard(root), computeTiming(root)).errors.join(),
    /finish counting/,
    'the final-value tip label must be visible before the cut',
  );
  const { job: j } = job(t, [
    { id: 's', block: 'stat', duration: 4, props: { value: 3, label: 'Count', source: 'Sample' } },
    { id: 'c', block: 'checklist', duration: 4, props: { items: ['One', 'Two'] } },
  ]);
  assert.ok(j.beats.every(b => b.settle_seconds > 0 && b.settle_seconds <= b.frames / j.fps));
  assert.ok(
    j.beats[1].settle_seconds >= j.beats[1].props.items.at(-1).at + 0.4 - 1e-9,
    'the last tick finishes before the exit may start',
  );
});
test('props that would silently drop authored text are rejected', () => {
  assert.throws(() => normalizeProps('statement', { title: 'Heading', text: 'Body' }), /not both/);
  assert.throws(
    () => normalizeProps('highlight', { title: 'Heading', text: 'A long tail', phrases: ['tail'] }),
    /kicker/,
  );
  assert.throws(() => normalizeProps('stat', { value: 1, label: 'x', context: 'a', support: 'b' }), /not both/);
  for (const p of PLAYBOOKS)
    for (const b of storyboardFor(p.id).beats)
      if (['title', 'statement', 'endcard'].includes(b.block))
        assert.ok(!(b.props.text && b.props.title), `${p.id}/${b.id}`);
});
