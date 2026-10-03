// Hash the compact evidence only, after source/output and review binding checks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { planClipRetiming } from '../../engine/lib/motion-phases.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const review = fs.readFileSync(path.join(root, 'REVIEW.md'), 'utf8');
const verification = read('verification/verification.json');
assert.equal(verification.status, 'passed-mechanical-checks');
assert.equal(verification.cases.length, 2);
const plans = read('plans.json');
for (const id of ['reserve-gate', 'gap-bridge']) {
  const dir = `assets/${id}`, receipt = read(`${dir}/receipt.json`), asset = read(`${dir}/asset.json`), config = read(`${dir}/render-config.json`);
  assert.equal(receipt.status, 'ready-for-review');
  assert.equal(receipt.config.frames, 48);
  assert.equal(receipt.config.fps, 12);
  for (const [key, value] of Object.entries(receipt.config)) assert.deepEqual(config[key], value);
  assert.deepEqual(asset.motion, receipt.config.motion);
  assert.deepEqual(asset.outputs, receipt.outputs);
  for (const [name, result] of Object.entries(receipt.outputs)) assert.equal(sha(path.join(root, dir, name)), result.sha256);
  for (const [file, hash] of Object.entries(receipt.sourceHashes)) assert.equal(sha(path.join(root, dir, 'source', path.basename(file))), hash);
  assert.equal(receipt.blender.holdTransformChecks.length, 2);
  assert(receipt.blender.holdTransformChecks.every(p => p.maxTransformError === 0));
  assert(review.includes(receipt.outputs['clip.mp4'].sha256), `${id}: review is not bound to this clip`);
  const v = verification.cases.find(v => v.id === id);
  assert(v?.reloadPixelsMatch && v.frames === receipt.config.frames);
  const p = plans.examples.find(p => p.id === id);
  assert.equal(p.sourceSha256, receipt.outputs['clip.mp4'].sha256);
  assert.deepEqual(p.plan, planClipRetiming(asset.motion, p.options));
}
const files = [];
function walk(relative = '') {
  for (const name of fs.readdirSync(path.join(root, relative)).sort()) {
    const rel = path.join(relative, name), file = path.join(root, rel), stat = fs.statSync(file);
    if ((!relative && ['build', 'evidence.json'].includes(name)) || name === 'logs' || name === '.DS_Store') continue;
    if (stat.isDirectory()) walk(rel);
    else files.push({ path: rel, bytes: stat.size, sha256: sha(file) });
  }
}
walk();
fs.writeFileSync(path.join(root, 'evidence.json'), JSON.stringify({ version: 1, status: 'prototype', inventoryIds: ['T05', 'M10'],
  limitations: 'Timing foundation only. Continuous playback and native composition not observed; derivative playback examples are plans, not encoded videos.', files }, null, 2) + '\n');
console.log(`Retained ${files.length} files, ${files.reduce((n, f) => n + f.bytes, 0)} bytes.`);
