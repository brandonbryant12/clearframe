// Pin Runway Dev request bodies and task handling (docs.dev.runwayml.com/api.md, 2026-10-04). No network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as runway from '../skills/runway-video/scripts/runway.mjs';
import { clipProvider } from '../engine/lib/generate.mjs';

test('Runway: keyframe bodies, ratios, model limits and cost', () => {
  const { endpoint, body } = runway.buildRequest({ prompt: 'pull back', images: ['data:a', 'data:b'], seconds: 5, aspect: '9:16' });
  assert.equal(endpoint, '/v1/image_to_video');
  assert.deepEqual(body, { model: 'seedance2_5', promptText: 'pull back', ratio: '720:1280', duration: 5,
    promptImage: [{ uri: 'data:a', position: 'first' }, { uri: 'data:b', position: 'last' }], audio: false });
  assert.equal(runway.buildRequest({ prompt: 'x', model: 'gen4.5', seconds: 4 }).endpoint, '/v1/text_to_video');
  assert.equal(runway.buildRequest({ prompt: 'x', resolution: '1080p', seconds: 4 }).body.ratio, '1920:1080');
  assert.throws(() => runway.buildRequest({ prompt: 'x', model: 'gen4.5', images: ['a', 'b'] }), /first frame only/);
  assert.throws(() => runway.buildRequest({ prompt: 'x', model: 'gen4.5', resolution: '1080p' }), /no 1080p/);
  assert.throws(() => runway.buildRequest({ prompt: 'x', seconds: 3 }), /4–15/);
  assert.throws(() => runway.buildRequest({ prompt: 'x', seconds: 4.5 }), /whole seconds/);
  assert.equal(runway.estimateCost({ seconds: 5 }), 1.5);            // 30 credits/s at 720p
  assert.equal(runway.estimateCost({ seconds: 2, model: 'seedance2_5', resolution: '480p' }), 0.8); // 80-credit minimum
  assert.equal(clipProvider('seedance2_5'), runway);
  assert.throws(() => clipProvider('nonexistent'), /Unsupported/);
});

test('Runway: polls a task to its output, and explains moderation without retrying', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-runway-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const real = globalThis.fetch;
  t.after(() => { globalThis.fetch = real; });
  const calls = [];
  const reply = (status, json) => new Response(JSON.stringify(json), { status });
  const serve = final => async (url, init = {}) => {
    calls.push([init.method ?? 'GET', String(url)]);
    if (String(url).endsWith('/v1/text_to_video')) {
      assert.equal(init.headers['X-Runway-Version'], runway.VERSION);
      assert.equal(init.headers.Authorization, 'Bearer test-key');
      return reply(200, { id: 'task-1' });
    }
    if (String(url).endsWith('/v1/tasks/task-1')) return reply(200, final);
    if (String(url) === 'https://out.example/clip.mp4') return new Response(new Uint8Array([1, 2, 3]));
    throw new Error(`unexpected ${url}`);
  };
  globalThis.fetch = serve({ status: 'SUCCEEDED', output: ['https://out.example/clip.mp4'] });
  const out = path.join(dir, 'clip.mp4');
  const r = await runway.generateVideo({ prompt: 'drift', model: 'gen4.5', seconds: 4 }, { key: 'test-key', out, pollMs: 1 });
  assert.equal(r.taskId, 'task-1');
  assert.deepEqual([...fs.readFileSync(out)], [1, 2, 3]);
  globalThis.fetch = serve({ status: 'FAILED', failure: 'blocked', failureCode: 'SAFETY.OUTPUT.THIRD_PARTY' });
  await assert.rejects(runway.generateVideo({ prompt: 'drift', model: 'gen4.5', seconds: 4 }, { key: 'test-key', out, pollMs: 1 }),
    /moderation blocked task task-1.*No credits were charged/);
  assert.equal(calls.filter(([m, u]) => m === 'POST' && u.endsWith('/v1/text_to_video')).length, 2);
});
