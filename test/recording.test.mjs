// Recording edits on a synthetic recording: every word is its own burst of seeded noise and
// every pause is silence, so after a cut each kept word can be found sample-exact in the new
// slice, and an undo can be compared byte for byte with the original.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  cutWords,
  uncut,
  splitBeat,
  mergeBeats,
  tightenPauses,
  ensureTranscript,
  planRemoval,
  keptWords,
} from '../engine/lib/recording.mjs';
import { computeTiming, captionCues } from '../engine/lib/timing.mjs';
import { paperEdit, applyPaperCuts } from '../engine/lib/paper.mjs';
import { readPCM } from '../engine/lib/levels.mjs';

import { RATE, recordedProject } from './fixtures.mjs';

const sb = root => JSON.parse(fs.readFileSync(path.join(root, 'storyboard.json'), 'utf8'));
const meta = (root, id) => JSON.parse(fs.readFileSync(path.join(root, 'assets/vo', `${id}.json`), 'utf8'));
const pcm = file => readPCM(file).pcm;
/** Offset (in samples) where `needle` occurs exactly in `hay`, searched near `guess`. */
function exactAt(hay, needle, guess, window = 40) {
  for (let off = Math.max(0, guess - window); off <= guess + window; off++)
    if (off * 2 + needle.length <= hay.length && hay.subarray(off * 2, off * 2 + needle.length).equals(needle)) return off;
  return null;
}
/** Every kept word of a beat is in its slice, sample-exact, where its timing says. */
function assertWordsExact(root, id) {
  const m = meta(root, id),
    transcript = ensureTranscript(root);
  const source = pcm(path.join(root, 'source/recording.wav')),
    slice = pcm(path.join(root, 'assets/vo', `${id}.wav`));
  const kept = keptWords(m, transcript);
  assert.equal(kept.length, m.words.length, `${id}: words and kept transcript agree`);
  kept.forEach((w, k) => {
    const a = Math.round(w.t0 * RATE) + 8,
      b = Math.round(w.t1 * RATE) - 8;
    const at = exactAt(slice, source.subarray(a * 2, b * 2), Math.round(m.words[k].t0 * RATE) + 8);
    assert.notEqual(at, null, `${id}: “${w.w}” plays intact`);
    assert.ok(Math.abs(at - 8 - m.words[k].t0 * RATE) <= 6, `${id}: “${w.w}” timing points at its audio`);
  });
}

test('ingest records the transcript on the recording clock and frame-exact beat spans', async t => {
  const { root } = await recordedProject(t);
  const story = sb(root);
  assert.deepEqual(
    story.beats.map(b => b.vo),
    [
      'Queues form when work arrives faster than it leaves.',
      'Short one. That is the whole story.',
      'Right.',
      'Honestly it was a mess at first.',
      'Then we measured the wait, and the line got shorter.',
    ],
  );
  const words = JSON.parse(fs.readFileSync(path.join(root, 'source/words.json'), 'utf8'));
  assert.equal(words.words.length, 34);
  let end = 0;
  for (const b of story.beats) {
    const s = meta(root, b.id).source;
    assert.equal(s.span[0], end, 'spans tile the recording');
    end = s.span[1];
    assertWordsExact(root, b.id);
  }
});

test('cutting words inside a beat keeps the rest sample-exact and measured, and moves later beats', async t => {
  const { root } = await recordedProject(t);
  const before = computeTiming(root);
  const r = cutWords(root, { words: 'the whole' }, { by: { role: 'human', name: 'Ana' } });
  assert.equal(r.beats.length, 1);
  assert.equal(r.beats[0].beat, 's002');
  assert.ok(Number.isInteger(r.frames) && r.frames > 0, 'a whole number of frames');
  assert.equal(sb(root).beats[1].vo, 'Short one. That is story.');
  const m = meta(root, 's002');
  assert.equal(m.alignment.kind, 'measured', 'shifted measured words stay measured');
  assert.equal(m.source.removed[0].by.name, 'Ana');
  assertWordsExact(root, 's002');
  const after = computeTiming(root);
  assert.equal(before.frames - after.frames, r.frames);
  const shift = after.beats[2].start - before.beats[2].start;
  assert.ok(Math.abs(shift + r.frames / 30) < 1e-6, 'later beats move earlier by the cut');
  assert.ok(Math.abs(after.beats[4].vo.words[0].t0 - before.beats[4].vo.words[0].t0 - shift) < 2e-3);
  assert.ok(!captionCues(after).some(c => /whole/.test(c.text)), 'captions follow the cut');
  assert.equal(after.beats[1].vo.wordTiming, 'measured');
});

test('uncut restores the exact original audio and text', async t => {
  const { root } = await recordedProject(t);
  const wav = fs.readFileSync(path.join(root, 'assets/vo/s002.wav'));
  const original = sb(root);
  const r = cutWords(root, { words: 'Short one.' });
  assert.equal(sb(root).beats[1].vo, 'That is the whole story.');
  assertWordsExact(root, 's002');
  uncut(root, { id: r.id });
  assert.ok(fs.readFileSync(path.join(root, 'assets/vo/s002.wav')).equals(wav), 'audio is byte-identical');
  assert.deepEqual(sb(root), original);
});

test('a cut across beats removes the emptied beat; undo puts it back in place', async t => {
  const { root } = await recordedProject(t);
  const original = sb(root);
  const slices = original.beats.map(b => fs.readFileSync(path.join(root, 'assets/vo', `${b.id}.wav`)));
  const before = computeTiming(root);
  const r = cutWords(root, { words: 'story. Right. Honestly' });
  assert.deepEqual(
    r.beats.map(p => [p.beat, !!p.deleted]),
    [
      ['s002', false],
      ['s003', true],
      ['s004', false],
    ],
  );
  const story = sb(root);
  assert.deepEqual(
    story.beats.map(b => b.id),
    ['s001', 's002', 's004', 's005'],
  );
  assert.equal(story.beats[1].vo, 'Short one. That is the whole');
  assert.equal(story.beats[2].vo, 'it was a mess at first.');
  for (const id of ['s002', 's004']) assertWordsExact(root, id);
  assert.equal(before.frames - computeTiming(root).frames, r.frames);
  uncut(root, { id: r.id });
  assert.deepEqual(sb(root), original);
  original.beats.forEach((b, i) =>
    assert.ok(fs.readFileSync(path.join(root, 'assets/vo', `${b.id}.wav`)).equals(slices[i]), `${b.id} restored`),
  );
});

test('split and merge keep the recording exact and record lineage', async t => {
  const { root } = await recordedProject(t);
  const original = fs.readFileSync(path.join(root, 'assets/vo/s005.wav'));
  const s = splitBeat(root, { beat: 's005', at: 'and the line' });
  assert.deepEqual(s.into, ['s005a', 's005b']);
  const story = sb(root);
  assert.deepEqual(
    story.beats.slice(-2).map(b => [b.id, b.vo, b.was]),
    [
      ['s005a', 'Then we measured the wait,', ['s005']],
      ['s005b', 'and the line got shorter.', ['s005']],
    ],
  );
  const joined = Buffer.concat(['s005a', 's005b'].map(id => pcm(path.join(root, 'assets/vo', `${id}.wav`))));
  assert.ok(joined.equals(pcm(path.join(root, 'assets/vo/s005.wav'))), 'the parts replay the original slice');
  for (const id of ['s005a', 's005b']) assertWordsExact(root, id);
  mergeBeats(root, { beats: ['s005a', 's005b'] });
  const merged = sb(root).beats.at(-1);
  assert.equal(merged.vo, 'Then we measured the wait, and the line got shorter.');
  assert.deepEqual(merged.was, ['s005', 's005a', 's005b']);
  assert.ok(pcm(path.join(root, 'assets/vo/s005a.wav')).equals(pcm(path.join(root, 'assets/vo/s005.wav'))));
  assert.ok(original.length > 44);
});

test('long pauses tighten to whole frames inside and across beats', async t => {
  const { root } = await recordedProject(t);
  const before = computeTiming(root);
  const r = tightenPauses(root, { over: 1.2, keep: 0.5 });
  const beats = [...new Set(r.beats.map(p => p.beat))];
  assert.deepEqual(beats, ['s002', 's004', 's005'], 'the 1.6 s pause inside s002 and the 2 s pause across s004 → s005');
  for (const p of r.beats) assert.equal((p.removal.samples[1] - p.removal.samples[0]) % 1600, 0, 'whole frames');
  const after = computeTiming(root);
  assert.equal(before.frames - after.frames, r.frames);
  const gap = (tm, a, b) => {
    const w = tm.beats.flatMap(x => x.vo.words);
    const i = w.findIndex(x => x.w === a);
    assert.equal(w[i + 1].w, b);
    return w[i + 1].t0 - w[i].t1;
  };
  assert.ok(Math.abs(gap(after, 'one.', 'That') - 0.5) < 1 / 30 + 1e-3);
  assert.ok(Math.abs(gap(after, 'first.', 'Then') - 0.5) < 2 / 30 + 1e-3);
  for (const id of beats) assertWordsExact(root, id);
  uncut(root, { id: r.id });
  assert.equal(computeTiming(root).frames, before.frames);
});

test('the removal planner keeps neighbouring words whole and pads only when pauses are under a frame', () => {
  // 10 ms pauses: no whole-frame cut fits between 0.31 s and 0.33 s.
  const kept = [
    { w: 'a', t0: 1.0, t1: 1.3 },
    { w: 'b', t0: 1.31, t1: 1.62 },
    { w: 'c', t0: 1.63, t1: 1.9 },
  ];
  const r = planRemoval({ kept, i: 1, j: 1, span: [0, 90], rate: RATE, fps: 30 });
  assert.ok(r.samples[0] >= 1.3 * RATE && r.samples[1] <= 1.63 * RATE, 'never cuts into a or c');
  assert.equal((r.samples[1] - r.samples[0] - r.pad) % 1600, 0, 'the beat keeps whole frames');
  assert.ok(r.pad > 0 && r.pad < 1600);
  const roomy = planRemoval({
    kept: [
      { w: 'a', t0: 1.0, t1: 1.3 },
      { w: 'b', t0: 1.6, t1: 1.9 },
      { w: 'c', t0: 2.3, t1: 2.6 },
    ],
    i: 1,
    j: 1,
    span: [0, 90],
    rate: RATE,
    fps: 30,
  });
  assert.equal(roomy.pad, 0);
  assert.equal((roomy.samples[1] - roomy.samples[0]) % 1600, 0);
});

test('projects ingested before source/words.json get their transcript rebuilt from beat metadata', async t => {
  const { root } = await recordedProject(t);
  const fresh = JSON.parse(fs.readFileSync(path.join(root, 'source/words.json'), 'utf8'));
  fs.rmSync(path.join(root, 'source/words.json'));
  fs.rmSync(path.join(root, 'source/recording.json'));
  for (const b of sb(root).beats) {
    const m = meta(root, b.id);
    for (const k of ['offset', 'fps', 'span', 'words']) delete m.source[k];
    fs.writeFileSync(path.join(root, 'assets/vo', `${b.id}.json`), JSON.stringify(m));
  }
  const rebuilt = ensureTranscript(root);
  assert.equal(rebuilt.words.length, fresh.words.length);
  rebuilt.words.forEach((w, i) => assert.ok(Math.abs(w.t0 - fresh.words[i].t0) < 1e-3 && w.w === fresh.words[i].w));
  const r = cutWords(root, { words: 'the whole' });
  assert.equal(r.beats[0].beat, 's002');
  assertWordsExact(root, 's002');
});

test('words struck in the paper edit become exact cuts; a beat edited since printing is refused', async t => {
  const { root } = await recordedProject(t);
  const { file } = paperEdit(root);
  const printed = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(
    file,
    printed.replace('> Short one. That is the whole story.', '> ~~Short one.~~ That is the whole story.').replace('and the line got shorter.', '~~and the line~~ got shorter.'),
  );
  const runs = applyPaperCuts(root, file, { by: { role: 'human', name: 'Ana' } });
  assert.equal(runs.length, 2);
  assert.deepEqual(
    sb(root).beats.map(b => b.vo),
    [
      'Queues form when work arrives faster than it leaves.',
      'That is the whole story.',
      'Right.',
      'Honestly it was a mess at first.',
      'Then we measured the wait, got shorter.',
    ],
  );
  for (const id of ['s002', 's005']) assertWordsExact(root, id);
  // The printed line no longer matches s002: striking more of it is refused, not guessed.
  fs.writeFileSync(file, printed.replace('> Short one. That is the whole story.', '> Short one. ~~That is~~ the whole story.'));
  assert.throws(() => applyPaperCuts(root, file, {}), /no longer reads as printed/);
  const again = paperEdit(root);
  assert.match(fs.readFileSync(again.file, 'utf8'), /\[cut c\d{3}: “Short one\.”\] That is the whole story\./);
});
