#!/usr/bin/env node
// A long recorded conversation for engine and review-loop measurements, free and local: about
// seven minutes of two macOS voices (`say`), words measured by local Whisper, ingested as a
// recorded film (`ingest --audio --words --script`), then rough-cut. The voices are synthetic
// and the script is generated from a short set of lines: this measures the pipeline on a long
// timeline, not recognition quality or a real conversation.
//
//   codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node scripts/long-form-fixture.mjs OUT [--minutes 7] [--no-render]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const { values, positionals } = parseArgs({ allowPositionals: true, options: { minutes: { type: 'string', default: '7' }, 'no-render': { type: 'boolean' } } });
const OUT = path.resolve(positionals[0] ?? 'build/long-form');
if (fs.existsSync(path.join(OUT, 'film', 'storyboard.json'))) throw new Error(`${OUT} already has a film`);
const FILM = path.join(OUT, 'film');
const src = path.join(OUT, 'source');
fs.mkdirSync(src, { recursive: true });
const timings = {};
const timed = (name, fn) => {
  const t0 = performance.now();
  const r = fn();
  timings[name] = Math.round((performance.now() - t0) / 10) / 100;
  console.log(`${name}: ${timings[name]} s`);
  return r;
};
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, env: { ...process.env, CLEARFRAME_HEAVY_HELD: '1' } });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 3).join(' ')} failed:\n${(r.stderr || r.stdout).slice(-3000)}`);
  return r.stdout;
};

// Topics, each a host question and a guest answer; cycled with ordinal framing until long enough.
const TOPICS = [
  ['Why do lines form at all?', 'Work arrives faster than it leaves, at least for a while, and the difference waits.'],
  ['Does a busier desk always mean a longer line?', 'Not linearly. Past about eighty percent busy, the wait climbs much faster than the load.'],
  ['What does slack buy you?', 'Slack absorbs the bad hour, so one surprise does not ruin the whole afternoon.'],
  ['How do you measure the wait?', 'Record when each request arrives and when it starts. The gap is the wait, and it is the number people feel.'],
  ['Is a faster server the only fix?', 'No. Smoothing arrivals, splitting work by size and adding a second desk can all shorten the line.'],
  ['What goes wrong with averages?', 'An average hides the long tail. A few very long waits can matter more than the typical one.'],
  ['Where do people notice queues first?', 'At the edges: a support inbox, a checkout, a build that sits behind another build.'],
  ['What would you tell a new team lead?', 'Watch the wait, keep a little slack, and treat a growing line as information, not failure.'],
];
const ORDINAL = ['First', 'Next', 'Then', 'Also', 'Another thing', 'And', 'One more', 'Finally'];
const target = Number(values.minutes) * 60;
const lines = [];
let estimate = 0,
  k = 0;
while (estimate < target) {
  const [q, a] = TOPICS[k % TOPICS.length];
  const round = Math.floor(k / TOPICS.length);
  lines.push(['HOST', 'Samantha', `${ORDINAL[k % ORDINAL.length]}, ${round ? 'coming back to it, ' : ''}${q.charAt(0).toLowerCase()}${q.slice(1)}`, 0.7]);
  lines.push(['GUEST', 'Daniel', round ? `Again: ${a}` : a, 1.0]);
  estimate += (lines.at(-2)[2].split(' ').length + lines.at(-1)[2].split(' ').length) / 2.7 + 1.7;
  k++;
}
timed('synthesize (say)', () => {
  const parts = [];
  for (const [i, [, voice, text, pause]] of lines.entries()) {
    const aiff = path.join(src, `line-${i}.aiff`),
      wav = path.join(src, `line-${i}.wav`);
    if (spawnSync('say', ['-v', voice, '-r', '175', '-o', aiff, text]).status !== 0) throw new Error('macOS say is needed');
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', aiff, '-af', `apad=pad_dur=${pause}`, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
    fs.rmSync(aiff);
    parts.push(wav);
  }
  fs.writeFileSync(path.join(src, 'list.txt'), parts.map(p => `file '${p}'`).join('\n'));
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(src, 'list.txt'), '-c', 'copy', path.join(src, 'episode.wav')]);
  for (const p of parts) fs.rmSync(p);
});
fs.writeFileSync(path.join(src, 'script.txt'), lines.map(([who, , text]) => `${who}: ${text}`).join('\n') + '\n');
const seconds = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(src, 'episode.wav')], { encoding: 'utf8' }).stdout);
console.log(`recording: ${(seconds / 60).toFixed(2)} min, ${lines.length} lines`);
timed('measure words (local Whisper, base, two threads)', () =>
  run('whisper', [path.join(src, 'episode.wav'), '--model', 'base', '--word_timestamps', 'True', '--output_format', 'json', '--output_dir', src, '--fp16', 'False', '--language', 'en', '--threads', '2']),
);
const cli = (...args) => run(process.execPath, [path.join(ROOT, 'engine/cli.mjs'), ...args]);
timed('ingest', () => cli('ingest', FILM, '--audio', path.join(src, 'episode.wav'), '--words', path.join(src, 'episode.json'), '--script', path.join(src, 'script.txt'), '--speakers', 'HOST=Maya:Host,GUEST=Sam:Guest'));
const sb = JSON.parse(fs.readFileSync(path.join(FILM, 'storyboard.json'), 'utf8'));
console.log(`beats: ${sb.beats.length}`);
timed('check (rough)', () => cli('check', FILM, '--draft', '--rough'));
if (!values['no-render']) timed('rough cut (draft --rough)', () => cli('draft', FILM, '--rough'));
fs.writeFileSync(path.join(OUT, 'fixture.json'), JSON.stringify({ seconds, lines: lines.length, beats: sb.beats.length, timings, note: 'synthetic voices (macOS say), local Whisper words; not a real conversation' }, null, 2));
