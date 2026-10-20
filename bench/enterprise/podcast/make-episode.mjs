#!/usr/bin/env node
// Rebuilds episode.wav, a local text-to-speech mock of the Money at Work clip, from turns.txt
// with the macOS `say` voices (host Samantha, guest Reed) and FFmpeg. Free and offline.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const output = process.argv[2] ? resolve(process.argv[2]) : join(here, 'episode.wav');
mkdirSync(dirname(output), { recursive: true });
const voices = { host: 'Samantha', guest: 'Reed (English (US))' };
const tmp = mkdtempSync(join(tmpdir(), 'episode-'));
const ff = (...args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
const silence = join(tmp, 'gap.wav');
ff('-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', '0.35', silence);
const list = [];
readFileSync(join(here, 'turns.txt'), 'utf8').split('\n').filter(Boolean).forEach((line, i) => {
  const [who, ...rest] = line.split(':');
  const aiff = join(tmp, `${i}.aiff`);
  const wav = join(tmp, `${i}.wav`);
  execFileSync('say', ['-v', voices[who.trim()], '-r', '185', '-o', aiff, rest.join(':').trim()]);
  ff('-i', aiff, '-ar', '24000', '-ac', '1', wav);
  list.push(`file '${wav}'`, `file '${silence}'`);
});
writeFileSync(join(tmp, 'list.txt'), list.join('\n') + '\n');
ff('-f', 'concat', '-safe', '0', '-i', join(tmp, 'list.txt'), '-c:a', 'pcm_s16le', output);
console.log(output);
