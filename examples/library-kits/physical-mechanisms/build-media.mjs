// One bounded Blender process at a time. Run under codex-heavy.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { renderSculpture } from '../../../engine/lib/sculptures.mjs';
const root = path.dirname(fileURLToPath(import.meta.url)), repo = path.resolve(root, '../../..');
const args = process.argv.slice(2), prune = args.includes('--prune-frames');
const requested = args.filter(a => a !== '--prune-frames');
const cases = ['reservoir-landscape', 'reservoir-vertical', 'conveyor-landscape', 'conveyor-vertical'];
const names = requested.length ? requested : cases;
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function run(bin, args, log) {
  const result = spawnSync(bin, args, { cwd: repo, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  fs.writeFileSync(log, (result.stdout ?? '') + '\n' + (result.stderr ?? ''));
  if (result.status !== 0) throw new Error(`${bin}: ${result.error?.message ?? result.stderr}. See ${log}`);
}
for (const name of names) {
  if (!cases.includes(name)) throw new Error(`Unknown mechanism ${name}`);
  const id = name.startsWith('reservoir') ? 'reservoir-transfer' : 'conveyor-bypass';
  const out = path.join(root, 'build/renders', name, id), target = path.join(root, 'media', name), evidence = path.join(root, 'evidence', name);
  if (fs.existsSync(target) || fs.existsSync(evidence)) throw new Error(`${name} already has retained evidence. Preserve it before revising.`);
  const receipt = await renderSculpture(id, out, { draft: true, vertical: name.endsWith('vertical'), fps: 24 });
  run(process.execPath, ['scripts/verify-sculptures.mjs', evidence, '--assets', path.dirname(out)], path.join(out, 'verification.log'));
  run(process.env.BLENDER_BIN || 'blender', ['--background', '--factory-startup', '--disable-autoexec', path.join(out, 'scene.blend'), '--threads', '2', '--python-exit-code', '1', '--python', path.join(root, 'check-mechanisms.py'), '--', '--receipt', path.join(out, 'receipt.json'), '--out', path.join(evidence, 'geometry.json')], path.join(out, 'geometry.log'));
  fs.mkdirSync(target, { recursive: true });
  for (const name of ['clip.mp4', 'poster.png', 'scene.blend', 'asset.json', 'receipt.json', 'render-config.json', 'blender.json', 'README.md']) fs.copyFileSync(path.join(out, name), path.join(target, name));
  fs.cpSync(path.join(out, 'source'), path.join(target, 'source'), { recursive: true, filter: source => path.basename(source) !== '__pycache__' });
  for (const [file, value] of Object.entries(receipt.outputs)) if (sha(path.join(target, file)) !== value.sha256) throw new Error(`${name}/${file} copy differs`);
  for (const [file, hash] of Object.entries(receipt.sourceHashes)) if (sha(path.join(target, 'source', path.basename(file))) !== hash) throw new Error(`${name}/${file} source copy differs`);
  // Compact scene, encoded pixels and exact sources are retained and verified.
  // Only the newly generated uncompressed frame intermediates are disposable.
  if (prune) fs.rmSync(path.join(out, 'frames'), { recursive: true });
  console.log(JSON.stringify({ name, frames: receipt.config.frames, status: 'rendered-and-verified', compact: target, rawFramesPruned: prune }));
}
