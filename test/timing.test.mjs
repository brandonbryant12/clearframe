import test from 'node:test';
import assert from 'node:assert/strict';
import { alignWords, distributeWords, estimateDuration, findWord, resolveAt, syllables, tokenize } from '../engine/lib/timing.mjs';

test('tokenize turns inline tags into pauses and drops backchannels', () => {
  const t = tokenize('Seventy percent. <short pause> It works |mm-hm| well.');
  assert.deepEqual(t.map((x) => x.w), ['Seventy', 'percent.', 'It', 'works', 'well.']);
  assert.ok(t[1].pause >= 0.38 + 0.35 - 1e-9, 'period + <short pause>');
});

test('syllables handles numbers, acronyms and words', () => {
  assert.equal(syllables('cat'), 1);
  assert.ok(syllables('calibrated') >= 3);
  assert.ok(syllables('70%') > syllables('70'));
  assert.equal(syllables('API'), 3);
});

test('estimateDuration is in a plausible range for 150 wpm', () => {
  const text = 'Good forecasts are calibrated, and good plans account for the thirty percent.';
  const d = estimateDuration(text, 150);
  const wpm = (text.split(' ').length / d) * 60;
  assert.ok(wpm > 110 && wpm < 200, `wpm ${wpm}`);
});

test('distributeWords spans the interval in order', () => {
  const w = distributeWords(tokenize('one two, three four.'), 1, 3);
  assert.equal(w[0].t0, 1);
  assert.ok(w.at(-1).t1 <= 3 + 1e-9);
  for (let i = 1; i < w.length; i++) assert.ok(w[i].t0 >= w[i - 1].t1);
});

test('alignWords maps phrases to detected speech segments', () => {
  const words = alignWords('It isn’t. It means three in ten.', [{ start: 0.1, end: 0.6 }, { start: 1.0, end: 2.2 }], 2.3);
  assert.equal(words[0].t0, 0.1);
  const it2 = words.findIndex((w, i) => i > 0 && w.w === 'It');
  assert.equal(words[it2].t0, 1.0);
});

test('alignWords merges extra segments', () => {
  const words = alignWords('One phrase only here.', [{ start: 0, end: 0.3 }, { start: 0.35, end: 0.8 }, { start: 1.2, end: 1.5 }], 1.6);
  assert.equal(words[0].t0, 0);
  assert.equal(words.at(-1).t1, 1.5);
});

test('findWord + resolveAt', () => {
  const beat = { start: 10, end: 14, vo: { start: 10.3, end: 13, words: [{ w: 'About', t0: 10.3, t1: 10.6 }, { w: 'thirty', t0: 10.7, t1: 11 }, { w: 'slip.', t0: 11.1, t1: 11.4 }] } };
  assert.equal(findWord(beat.vo.words, 'thirty'), 10.7);
  assert.equal(findWord(beat.vo.words, 'thirty slip'), 10.7);
  assert.equal(resolveAt('word:slip+0.1', beat), 11.2);
  assert.equal(resolveAt(1.5, beat), 11.5);
  assert.equal(resolveAt('vo-end', beat), 13);
});

test('imageSize reads PNG and JPEG headers', async () => {
  const { imageSize } = await import('../engine/lib/browser.mjs');
  const png = Buffer.alloc(24); png[0] = 0x89; png[1] = 0x50; png.writeUInt32BE(1920, 16); png.writeUInt32BE(1080, 20);
  assert.deepEqual(imageSize(png), { width: 1920, height: 1080 });
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x1c, 0x03, 0xc0, 0x03]);
  assert.deepEqual(imageSize(jpg), { width: 960, height: 540 });
});
