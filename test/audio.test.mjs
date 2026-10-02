import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mix } from '../engine/lib/audio.mjs';
import { pcmToWav } from '../engine/lib/util.mjs';

test('the same prepared audio produces an identical mix, including the room tone', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-audio-repeat-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const pcm = Buffer.alloc(48000 * 2 * 2);
  for (let i = 0; i < pcm.length / 2; i++) pcm.writeInt16LE(Math.round(5000 * Math.sin(2 * Math.PI * 220 * i / 48000)), i * 2);
  fs.writeFileSync(path.join(root, 'voice.wav'), pcmToWav(pcm, { sampleRate: 48000 }));
  const timing = { duration: 2.5, beats: [{ vo: { src: 'voice.wav', start: 0 } }] };
  const a = path.join(root, 'a.wav'), b = path.join(root, 'b.wav');
  await mix(root, timing, a); await mix(root, timing, b);
  assert.deepEqual(fs.readFileSync(a), fs.readFileSync(b));
});
