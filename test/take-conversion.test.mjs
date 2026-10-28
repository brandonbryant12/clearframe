// Narration takes are converted for the recognizer at most two at a time, as Effect-owned
// children: a failed conversion stops the others and waits for them before the caller cleans up.
// A review reproduced eight simultaneous FFmpeg children for eight takes, and siblings still
// running (then failing on a deleted directory) after a first failure returned.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';

const scratch = fs.realpathSync(
  fs.mkdtempSync(path.join(os.tmpdir(), 'cf-take-conversion-')),
);
const events = path.join(scratch, 'ffmpeg-events.jsonl');

// A stand-in FFmpeg: logs start, end and kill by pid; an input named *fail* fails at once, any
// other input takes 400 ms (2 s when its name says slow) and writes its output.
const ffmpeg = path.join(scratch, 'ffmpeg');
fs.writeFileSync(
  ffmpeg,
  `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args.includes('-version')) process.exit(0);
const log = (event) => fs.appendFileSync(${JSON.stringify(events)},
  JSON.stringify({ pid: process.pid, event, at: Date.now(), input }) + '\\n');
const input = args[args.indexOf('-i') + 1], out = args.at(-1);
process.on('SIGTERM', () => { log('killed'); process.exit(143); });
log('start');
if (input.includes('fail')) { log('failed'); process.exit(1); }
setTimeout(() => { fs.writeFileSync(out, 'RIFF'); log('end'); process.exit(0); },
  input.includes('slow') ? 2000 : 400);
`,
);
fs.chmodSync(ffmpeg, 0o755);

// A stand-in whisper.cpp that hears one word at the start of each take.
const whisperDir = path.join(scratch, 'bin');
fs.mkdirSync(whisperDir);
const whisperCalls = path.join(scratch, 'whisper-calls.jsonl');
fs.writeFileSync(
  path.join(whisperDir, 'whisper-cli'),
  `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args.includes('--help')) process.exit(0);
fs.appendFileSync(${JSON.stringify(whisperCalls)}, JSON.stringify(args) + '\\n');
args.forEach((a, i) => {
  if (a === '-f') fs.writeFileSync(args[i + 1] + '.json', JSON.stringify({
    transcription: [{ text: ' Hello', offsets: { from: 100, to: 400 } }] }));
});
`,
);
fs.chmodSync(path.join(whisperDir, 'whisper-cli'), 0o755);
fs.writeFileSync(path.join(scratch, 'ggml-base.en.bin'), '');

// Before the engine resolves FFmpeg or Whisper for this process.
process.env.FFMPEG_PATH = ffmpeg;
process.env.PATH = `${whisperDir}${path.delimiter}${process.env.PATH}`;
process.env.CLEARFRAME_WHISPER_MODEL = path.join(scratch, 'ggml-base.en.bin');
const { heardWordsMany } =
  await import('../packages/engine/dist/engine/lib/takes-heard.mjs');
test.after(() => fs.rmSync(scratch, { recursive: true, force: true }));

const read = () =>
  fs.existsSync(events)
    ? fs
        .readFileSync(events, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
function takes(names) {
  const dir = fs.mkdtempSync(path.join(scratch, 'takes-'));
  return names.map((name) => {
    const file = path.join(dir, `${name}.wav`);
    fs.writeFileSync(file, 'RIFF');
    return file;
  });
}
/** The most conversions running at any one moment. */
function peak(log) {
  let running = 0,
    most = 0;
  for (const e of [...log].sort((a, b) => a.at - b.at)) {
    running += e.event === 'start' ? 1 : -1;
    most = Math.max(most, running);
  }
  return most;
}

test('eight takes convert two at a time and are heard in one recognizer run', async () => {
  fs.rmSync(events, { force: true });
  const files = takes(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  const heard = await heardWordsMany(
    files,
    files.map(() => ['Hello']),
    'en',
  );
  const log = read();
  assert.equal(log.filter((e) => e.event === 'start').length, 8);
  assert.equal(log.filter((e) => e.event === 'end').length, 8);
  assert.equal(peak(log), 2, 'at most two conversions at once');
  const runs = fs.readFileSync(whisperCalls, 'utf8').trim().split('\n');
  assert.equal(runs.length, 1, 'one recognizer run');
  assert.equal(JSON.parse(runs[0]).filter((a) => a === '-f').length, 8);
  // Each take is heard on its own clock.
  assert.ok(heard.aligned.every((a) => a && a.interpolated === 0));
  assert.ok(heard.aligned.every((a) => a.words[0].t0 === 0.1));
});

test('a failed conversion stops the others before the caller removes their directory', async () => {
  fs.rmSync(events, { force: true });
  const files = takes(['fail', 'slow-1', 'slow-2', 'slow-3', 'slow-4']);
  await assert.rejects(
    heardWordsMany(
      files,
      files.map(() => ['Hello']),
      'en',
    ),
  );
  const settled = Date.now();
  const log = read();
  const started = log.filter((e) => e.event === 'start');
  assert.ok(started.length <= 2, `${started.length} conversions had started`);
  for (const { pid } of started) {
    assert.ok(
      log.some((e) => e.pid === pid && e.event !== 'start'),
      `conversion ${pid} finished, failed or was stopped before the call settled`,
    );
    assert.equal(alive(pid), false, `conversion ${pid} is not still running`);
  }
  // Nothing starts or finishes afterwards (no orphan writing into the removed directory).
  await wait(2500);
  assert.deepEqual(
    read().filter((e) => e.at > settled),
    [],
  );
});
