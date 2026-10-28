// Free local narration to a finished film: the recognizer's words must align with the script's,
// figures included, and every take must be heard on its own clock. Measured on a 401(k) draft:
// takes joined with silence collapsed each beat's first words onto one zero-length instant, and
// "twenty-four hundred." never matched "$2,400.", so the final render refused the film.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  alignScript,
  spoken,
} from '../packages/engine/dist/engine/lib/word-align.mjs';
import { transcribeEach } from '../packages/engine/dist/engine/lib/whisper/provider.mjs';
import { heardWordsMany } from '../packages/engine/dist/engine/lib/takes-heard.mjs';

const timed = (pairs) => pairs.map(([w, t0, t1]) => ({ w, t0, t1 }));

test('a sentence-final period is punctuation, not a decimal point', () => {
  assert.equal(spoken(['twenty-four', 'hundred.']), '2400');
  assert.equal(spoken(['$2,400.']), '$2400');
  assert.equal(spoken(['eighteen', 'hundred', 'dollars']), '$1800');
  assert.equal(spoken(['3.5']), '3.5');
  assert.equal(spoken(['the', 'end.']), 'the end');
});

test('spoken figures align with the digits Whisper writes, currency it added included', () => {
  const heard = timed([
    ['On', 0.14, 0.17],
    ['a', 0.17, 0.3],
    ['$60,000', 0.3, 1.4],
    ['salary,', 1.4, 2.1],
    ['to', 4.6, 4.8],
    ['$2,400.', 4.8, 5.7],
    ['600', 5.8, 6.4],
    ['more', 6.4, 6.9],
  ]);
  const r = alignScript(
    'On a sixty thousand dollar salary, to twenty-four hundred. Six hundred more,'.split(
      ' ',
    ),
    heard,
  );
  assert.equal(
    r.interpolated,
    0,
    JSON.stringify(r.words.filter((w) => w.estimated)),
  );
  const word = (w) => r.words.find((x) => x.w === w);
  // The exact figure wins: "dollar" belongs to $60,000, not left over.
  assert.equal(word('dollar').t1, 1.4);
  assert.deepEqual([word('twenty-four').t0, word('hundred.').t1], [4.8, 5.7]);
  // A different figure is never matched as a number, with or without a currency mark.
  const wrong = alignScript(
    ['twenty-five', 'hundred.'],
    timed([['$2,400.', 0, 1]]),
  );
  assert.ok(wrong.interpolated > 0);
});

/** A stand-in whisper.cpp: records its arguments and writes FILE.json for each `-f FILE`. */
function fakeWhisper(t, heardByName) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-fake-whisper-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const log = path.join(dir, 'calls.jsonl');
  const bin = path.join(dir, 'whisper-cli');
  fs.writeFileSync(
    bin,
    `#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path');
const args = process.argv.slice(2);
if (args.includes('--help')) process.exit(0);
fs.appendFileSync(${JSON.stringify(log)}, JSON.stringify(args) + '\\n');
const heard = ${JSON.stringify(heardByName)};
args.forEach((a, i) => {
  if (a !== '-f') return;
  const wav = args[i + 1], words = heard[path.basename(wav)] ?? [];
  fs.writeFileSync(wav + '.json', JSON.stringify({ transcription: words.map(([w, t0, t1]) =>
    ({ text: ' ' + w, offsets: { from: Math.round(t0 * 1000), to: Math.round(t1 * 1000) } })) }));
});
`,
  );
  fs.chmodSync(bin, 0o755);
  const model = path.join(dir, 'ggml-base.en.bin');
  fs.writeFileSync(model, '');
  process.env.PATH = `${dir}${path.delimiter}${process.env.PATH}`;
  process.env.CLEARFRAME_WHISPER_MODEL = model;
  t.after(() => delete process.env.CLEARFRAME_WHISPER_MODEL);
  return () =>
    fs
      .readFileSync(log, 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
}

const tone = (file, seconds) =>
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `sine=f=220:d=${seconds}`,
    '-ar',
    '48000',
    file,
  ]);

test('takes are heard apart in one recognizer run, so each take keeps its first word', async (t) => {
  const pathBefore = process.env.PATH;
  t.after(() => (process.env.PATH = pathBefore));
  const calls = fakeWhisper(t, {
    'take-0.wav': [
      ['Raise', 0.0, 0.3],
      ['it', 0.3, 0.5],
    ],
    'take-1.wav': [
      ['On', 0.14, 0.17],
      ['a', 0.17, 0.3],
      ['$60,000', 0.3, 1.4],
      ['salary.', 1.4, 2.0],
    ],
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-takes-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const files = [path.join(dir, 'raise.wav'), path.join(dir, 'dollars.wav')];
  tone(files[0], 1);
  tone(files[1], 2.2);
  const heard = await heardWordsMany(
    files,
    [
      ['Raise', 'it'],
      ['On', 'a', 'sixty', 'thousand', 'dollar', 'salary.'],
    ],
    'en',
  );
  const [call, ...more] = calls();
  assert.equal(more.length, 0, 'one recognizer run for every take');
  assert.equal(
    call.filter((a) => a === '-f').length,
    2,
    'each take is its own input',
  );
  assert.equal(heard.aligned[1].interpolated, 0);
  assert.equal(heard.aligned[1].words[0].w, 'On');
  assert.ok(heard.aligned[1].words[0].t0 < 0.2, 'on its own clock');
  assert.match(heard.provider, /^whisper\.cpp-/);
  // transcribeEach returns one result per input, in order.
  const each = transcribeEach(
    [path.join(dir, 'take-0.wav'), path.join(dir, 'take-1.wav')].map((f) => {
      tone(f, 0.5);
      return f;
    }),
    { dir },
  );
  assert.deepEqual(
    each.map((h) => h.words.map((w) => w.word)),
    [
      ['Raise', 'it'],
      ['On', 'a', '$60,000', 'salary.'],
    ],
  );
});
