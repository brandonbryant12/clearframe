// Source-material ingestion: evidence briefs, gapless recording cuts and honest word timing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResearch, segmentWords, cutPoints, scriptedWords, scriptTurns } from '../engine/lib/ingest.mjs';
import { alignScript } from '../engine/lib/word-align.mjs';

test('research briefs keep figures with their sentence and source, and skip years and list numbers', () => {
  const r = parseResearch(`# Heat\n\n## Scale\n\nNights run 7°C warmer in 2024 [1]. Only 18 of 100 cities had a plan, however [2]. Roofs cost $2.50 per square metre.\n\n1. Step one\n\n## References\n1. Lab report https://example.org/a\n2. Survey https://example.org/b\n`);
  const figs = r.figures.map(f => [f.figure, f.sources.join()]);
  assert.deepEqual(figs, [['7°C', '1'], ['18 of 100', '2'], ['$2.50', '']]);
  assert.equal(r.sources.length, 2); assert.equal(r.contrasts.length, 1);
});

test('recording cuts are frame-aligned, ordered and tile the recording without gaps', () => {
  const words = [['Hello', 0, 0.4], ['there.', 0.45, 0.9], ['How', 1.6, 1.8], ['are', 1.85, 2.0], ['you?', 2.05, 2.5], ['Fine.', 3.4, 3.9]]
    .map(([w, t0, t1], i) => ({ w, t0, t1, speaker: i < 5 ? 'A' : 'B' }));
  const segs = segmentWords(words, { min: 0.5 });
  const cuts = cutPoints(segs, 4.2, 30);
  assert.equal(cuts[0], 0); assert.ok(cuts.every((c, i) => !i || c > cuts[i - 1]));
  assert.ok(cuts.every(c => Math.abs(c * 30 - Math.round(c * 30)) < 1e-9), 'every cut is on a frame');
  assert.equal(segs.at(-1)[0].speaker, 'B', 'a speaker change starts a beat');
  segs.forEach((s, i) => assert.ok(cuts[i] <= s[0].t0 && s.at(-1).t1 <= cuts[i + 1] + 1 / 30, 'each beat holds its words'));
});

test('script alignment keeps the script spelling, times substitutions, and never calls interpolation measured', () => {
  const heard = [['Trees', 0, 0.3], ['held', 0.3, 0.6], ['a', 0.6, 0.7], ['lot', 0.7, 1.0]].map(([w, t0, t1]) => ({ w, t0, t1 }));
  const same = alignScript(['Trees', 'help', 'a', 'lot'], heard);
  assert.deepEqual(same.words.map(w => w.w), ['Trees', 'help', 'a', 'lot']);
  assert.equal(same.interpolated, 0, 'a one-for-one substitution keeps measured timing');
  const extra = alignScript(['Trees', 'really', 'help', 'a', 'lot'], heard);
  assert.ok(extra.interpolated > 0 && extra.words.every((w, i, a) => !i || w.t0 >= a[i - 1].t1));
  const { words } = scriptedWords(heard, scriptTurns('HOST: Trees help a lot'));
  assert.ok(words.every(w => w.speaker === 'HOST'));
});
