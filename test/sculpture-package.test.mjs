import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Packaging only binds bytes. A tiny retained fixture exercises that contract
// without starting Blender or checking media decoding a second time.
test('older partial sculpture sets package portably and reject changed provenance', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-sculpture-pack-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const input = path.join(root, 'assets'), asset = path.join(input, 'petal-reveal');
  fs.mkdirSync(path.join(asset, 'source'), { recursive: true });
  const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const outputs = {};
  for (const name of ['clip.mp4', 'poster.png', 'scene.blend']) {
    const bytes = Buffer.from(`retained ${name}`);
    fs.writeFileSync(path.join(asset, name), bytes);
    outputs[name] = { file: name, sha256: hash(bytes), bytes: bytes.length };
  }
  const config = { width: 1920, height: 1080, fps: 24, frames: 96, loop: true };
  const source = 'retained recipe source';
  fs.writeFileSync(path.join(asset, 'source', 'petal-reveal.py'), source);
  const receipt = { status: 'ready-for-review', title: 'Retained <study>', config,
    recipe: { description: 'Original study', use: 'Editorial reveal', copy: 'Native type', metaphor: 'Qualitative' },
    blender: { blenderVersion: 'test', blenderBuildHash: 'test', samples: 48, engine: 'BLENDER_EEVEE' },
    outputs, sourceHashes: { 'library/sculptures/petal-reveal.py': hash(source) } };
  const writeReceipt = () => fs.writeFileSync(path.join(asset, 'receipt.json'), JSON.stringify(receipt));
  writeReceipt();
  fs.writeFileSync(path.join(asset, 'render-config.json'), JSON.stringify(config));
  const pack = name => spawnSync(process.execPath, ['scripts/package-sculptures.mjs', input, path.join(root, name)], { encoding: 'utf8' });
  const success = pack('gallery');
  assert.equal(success.status, 0, success.stderr);
  assert.equal(fs.readFileSync(path.join(root, 'gallery/petal-reveal/source/petal-reveal.py'), 'utf8'), source);
  assert.match(fs.readFileSync(path.join(root, 'gallery/index.html'), 'utf8'), /Retained &lt;study&gt;/);
  assert.notEqual(pack('gallery').status, 0, 'existing destination stays protected');
  fs.writeFileSync(path.join(asset, 'source', 'petal-reveal.py'), 'changed recipe');
  assert.notEqual(pack('changed-source').status, 0);
  assert.equal(fs.existsSync(path.join(root, 'changed-source')), false);
  fs.writeFileSync(path.join(asset, 'source', 'petal-reveal.py'), source);
  receipt.config.width = '<img src=x>';
  writeReceipt();
  assert.notEqual(pack('invalid-geometry').status, 0);
  assert.equal(fs.existsSync(path.join(root, 'invalid-geometry')), false);
});
