// End-to-end: the QA check must catch deliberate mistakes, and a tiny render must produce a video.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { check } from '../engine/lib/inspect.mjs';
import { render } from '../engine/lib/render.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { mediaDuration } from '../engine/lib/util.mjs';

const broken = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'broken');

test('check catches off-frame text, overflow, tiny text, dead air and missing sources', { timeout: 120_000 }, async () => {
  const r = await check(broken);
  const all = [...r.errors, ...r.warnings].join('\n');
  assert.match(all, /cut off by the frame edge/);
  assert.match(all, /overflows its box/);
  assert.match(all, /unreadable on a phone/);
  assert.match(all, /nothing moves for/);
  assert.match(all, /sources is empty/);
});

test('render produces a video of the right length', { timeout: 180_000 }, async () => {
  const out = path.join(broken, 'build', 'test.mp4');
  await render(broken, { draft: true, workers: 2, out, audio: false });
  assert.ok(fs.existsSync(out));
  const d = await mediaDuration(out);
  const expected = computeTiming(broken).duration;
  assert.ok(Math.abs(d - expected) < 0.15, `duration ${d} vs ${expected}`);
  fs.rmSync(path.join(broken, 'build'), { recursive: true, force: true });
});
