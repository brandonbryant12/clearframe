// Shared fixtures (not a test file): a synthetic two-speaker recording whose words are bursts
// of seeded noise and whose pauses are silence, with exact word times.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ingestRecording } from '../engine/lib/ingest.mjs';
import { pcmToWav } from '../engine/lib/util.mjs';

export const RATE = 48000;
// [speaker, sentence, pause after (s)]
export const SCRIPT = [
  ['host', 'Queues form when work arrives faster than it leaves.', 0.5],
  ['host', 'Short one.', 1.6],
  ['host', 'That is the whole story.', 0.5],
  ['guest', 'Right.', 0.5],
  ['host', 'Honestly it was a mess at first.', 2.0],
  ['host', 'Then we measured the wait, and the line got shorter.', 0.4],
];

/** A recording with known word times; returns {input, words}. */
export function synthRecording(dir, script = SCRIPT) {
  let t = 0.3,
    seed = 1;
  const words = [],
    pieces = [Buffer.alloc(Math.round(t * RATE) * 2)];
  for (const [speaker, sentence, after] of script) {
    const list = sentence.split(' ');
    list.forEach((w, i) => {
      const n = Math.round(0.32 * RATE),
        buf = Buffer.alloc(n * 2);
      let s = seed++ * 7919;
      for (let k = 0; k < n; k++) {
        s = (s * 1103515245 + 12345) >>> 0;
        buf.writeInt16LE(((s >>> 16) % 16000) - 8000, k * 2);
      }
      words.push({ w, t0: t, t1: t + n / RATE, speaker });
      pieces.push(buf);
      t += n / RATE;
      const gap = i < list.length - 1 ? 0.08 : after;
      pieces.push(Buffer.alloc(Math.round(gap * RATE) * 2));
      t += Math.round(gap * RATE) / RATE;
    });
  }
  const input = path.join(dir, 'input.wav');
  fs.writeFileSync(input, pcmToWav(Buffer.concat(pieces), { sampleRate: RATE }));
  return { input, words };
}

export async function recordedProject(t, { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-rec-')) } = {}) {
  t?.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { input, words } = synthRecording(dir);
  const root = path.join(dir, 'film');
  await ingestRecording(root, { audio: input, words: { words }, fps: 30, speakers: {} });
  return { root, input };
}

