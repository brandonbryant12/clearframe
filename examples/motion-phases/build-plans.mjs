// Reproduce bounded frame-selection plans from the retained, hash-checked clips.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { planClipRetiming } from '../../engine/lib/motion-phases.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const examples = [];
for (const [id, options] of [
  ['reserve-gate', { startFrame: 6, endFrame: 42, rate: .5, outputFps: 24, readHoldSeconds: 3 }],
  ['gap-bridge', { rate: 2, outputFps: 24, readHoldSeconds: 1 }],
]) {
  const dir = path.join(root, 'assets', id), asset = read(path.join(dir, 'asset.json'));
  for (const [name, value] of Object.entries(asset.outputs)) {
    if (sha(path.join(dir, name)) !== value.sha256) throw new Error(`${id}/${name} differs from its receipt`);
  }
  const plan = planClipRetiming(asset.motion, options);
  examples.push({ id, sourceClip: `assets/${id}/clip.mp4`, sourceSha256: asset.outputs['clip.mp4'].sha256, options, plan });
}
fs.writeFileSync(path.join(root, 'plans.json'), JSON.stringify({ version: 1, status: 'plans-only-not-encoded', examples }, null, 2) + '\n');
console.log(`Prepared ${examples.length} hash-bound plans. No video changed.`);
