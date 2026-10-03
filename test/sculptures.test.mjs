import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sculptures, sculptureConfig, renderSculpture } from '../engine/lib/sculptures.mjs';

test('optional Blender recipes can be explored without starting Blender', () => {
  const r = spawnSync(process.execPath, ['engine/cli.mjs', 'sculpture', 'petal-reveal', '--draft', '--vertical', '--duration', '3.25', '--fps', '24', '--seed', '9', '--dry-run'],
    { encoding: 'utf8', env: { ...process.env, BLENDER_BIN: '/missing/blender' } });
  assert.equal(r.status, 0, r.stderr);
  const config = JSON.parse(r.stdout);
  assert.equal(config.width, 540); assert.equal(config.height, 960);
  assert.equal(config.frames, 78); assert.equal(config.seed, 9);
  assert.equal(sculptureConfig('quiz-triptych').pos, 0);
  assert.equal(sculptureConfig('gap-bridge').loop, false);
  assert.equal(sculptureConfig('graph-flight', {duration:16,fps:24}).frames, 384);
  assert.ok(sculptures().every(s => s.copy && s.metaphor && typeof s.loop === 'boolean'));
  for (const options of [{ fps: 0 }, { fps: 23.976 }, { duration: 31 }, { seed: -1 }, { pos: 1.1 }])
    assert.throws(() => sculptureConfig('petal-reveal', options));
  assert.throws(() => sculptureConfig('../petal-reveal'), /Unknown sculpture/);
});

test('an unavailable Blender leaves a failure receipt and protects an existing destination', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-sculpture-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const old = process.env.BLENDER_BIN;
  t.after(() => { if (old === undefined) delete process.env.BLENDER_BIN; else process.env.BLENDER_BIN = old; });
  const existing = path.join(root, 'keep'); fs.mkdirSync(existing);
  fs.writeFileSync(path.join(existing, 'work.txt'), 'user work');
  await assert.rejects(renderSculpture('petal-reveal', existing), /already exists/);
  assert.equal(fs.readFileSync(path.join(existing, 'work.txt'), 'utf8'), 'user work');
  const disk = fs.statfsSync(root);
  if (disk.bavail * disk.bsize < 20 * 2 ** 30) {
    t.skip('The missing-executable path requires the production 20 GiB disk preflight to pass.');
    return;
  }
  process.env.BLENDER_BIN = path.join(root, 'missing-blender');
  const out = path.join(root, 'failed');
  await assert.rejects(renderSculpture('petal-reveal', out, { still: true, draft: true }), /ENOENT/);
  const report = JSON.parse(fs.readFileSync(path.join(out, 'receipt.json')));
  assert.equal(report.status, 'failed'); assert.equal(report.stages[0].status, 'failed');
  assert.deepEqual(report.outputs, {});
  assert.ok(fs.existsSync(path.join(out, 'source/render.py')));
});
