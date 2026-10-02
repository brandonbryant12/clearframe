#!/usr/bin/env node
// Real CLI, pixel and saved-scene checks. No provider calls or external models.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sculptures } from '../engine/lib/sculptures.mjs';
import { enterGate } from '../engine/lib/resource-gate.mjs';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { assets: { type: 'string' }, quick: { type: 'boolean' } } });
if (positionals.length !== 1) throw new Error('Usage: verify-sculptures.mjs NEW-EVIDENCE-DIR [--assets EXISTING-ASSET-ROOT] [--quick]');
const out = path.resolve(positionals[0]);
const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const pngGeometry = file => {
  const bytes = fs.readFileSync(file);
  assert(bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR', `Invalid PNG: ${file}`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};
if (!(await enterGate())) await verify();

async function verify() {
  if (fs.existsSync(out)) throw new Error('Evidence directory already exists. Choose a new directory.');
  fs.mkdirSync(path.join(out, 'logs'), { recursive: true });
  const report = { version: 1, status: 'running', cases: [], startedAt: new Date().toISOString() };
  const save = () => {
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(path.join(out, 'REPORT.md'), `# Optional Blender asset verification\n\nStatus: **${report.status}**\n\n` + report.cases.map(c =>
      `- ${c.id}: ${c.width} × ${c.height}, ${c.frames} frames; ${c.loop ? `loop transform error ${c.loopTransformError}; decoded loop seam ${c.loopSeam.toFixed(3)}, ordinary p95 step ${c.neighbourP95.toFixed(3)}` : `one-way reveal; final hold step ${c.finalHoldStep.toFixed(3)}`}; saved scene reload ${c.reloadPixelsMatch ? 'matches original pixels exactly' : `within bounded rounding tolerance (${c.reloadDifference.changedChannels} channels changed, max ${c.reloadDifference.maxDifference}/255)`}.`).join('\n') +
      (report.error ? `\n\nFailure: ${report.error}` : '') + '\n\nThese checks establish artifact identity, frame geometry, motion continuity and saved-scene portability. Review composition, motion and usefulness separately.\n');
  };
  function run(name, bin, args, { binary = false } = {}) {
    const r = spawnSync(bin, args, { cwd: repo, encoding: binary ? undefined : 'utf8', maxBuffer: 32 * 1024 * 1024 });
    fs.writeFileSync(path.join(out, 'logs', name + '.log'), (binary ? '' : (r.stdout ?? '')) + '\n' + (r.stderr ?? ''));
    assert.equal(r.status, 0, `${name}: ${r.error?.message ?? r.stderr}`);
    return r.stdout;
  }
  const pixelBytes = file => run('pixels-' + path.basename(file), 'ffmpeg', ['-v', 'error', '-threads', '2', '-filter_threads', '2', '-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-threads', '2', '-'], { binary: true });
  save();
  try {
    const assetRoot = values.assets ? path.resolve(values.assets) : path.join(out, 'assets');
    const known = sculptures().map(s => s.id);
    let ids = values.assets ? fs.readdirSync(assetRoot).filter(id => fs.existsSync(path.join(assetRoot, id, 'receipt.json'))).sort() : known;
    assert(ids.length > 0, 'No retained asset receipts found');
    for (const id of ids) assert(known.includes(id), `Unknown sculpture receipt directory: ${id}`);
    if (values.quick) ids = ['petal-reveal'];
    report.revision = run('revision', 'git', ['rev-parse', 'HEAD']).trim();
    report.dirty = !!run('working-tree', 'git', ['status', '--porcelain']).trim();
    for (const id of ids) {
      const root = path.join(assetRoot, id);
      if (!values.assets) run(id + '-render', process.execPath, ['engine/cli.mjs', 'sculpture', id, '--draft', '--duration', '4', '--out', root, '--json']);
      const receipt = read(path.join(root, 'receipt.json'));
      assert.equal(receipt.status, 'ready-for-review');
      for (const [name, result] of Object.entries(receipt.outputs)) assert.equal(sha(fs.readFileSync(path.join(root, name))), result.sha256, `${id}/${name} changed`);
      for (const [name, hash] of Object.entries(receipt.sourceHashes)) assert.equal(sha(fs.readFileSync(path.join(root, 'source', path.basename(name)))), hash, `${id} retained source changed`);
      const probe = JSON.parse(run(id + '-probe', 'ffprobe', ['-v', 'error', '-threads', '2', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_read_frames,avg_frame_rate,color_space,color_transfer,color_primaries', '-of', 'json', path.join(root, 'clip.mp4')])).streams[0];
      assert.equal(probe.width, receipt.config.width); assert.equal(probe.height, receipt.config.height);
      assert.equal(Number(probe.nb_read_frames), receipt.config.frames); assert.equal(probe.avg_frame_rate, `${receipt.config.fps}/1`);
      assert.equal(probe.color_space, 'bt709'); assert.equal(probe.color_primaries, 'bt709'); assert.equal(probe.color_transfer, 'iec61966-2-1');
      const raw = run(id + '-motion', 'ffmpeg', ['-v', 'error', '-threads', '2', '-filter_threads', '2', '-i', path.join(root, 'clip.mp4'), '-vf', 'scale=64:36', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-threads', '2', '-'], { binary: true });
      const stride = 64 * 36 * 3, n = raw.length / stride;
      assert.equal(n, receipt.config.frames);
      const difference = (a, b) => {
        let sum = 0; for (let i = 0; i < stride; i++) sum += Math.abs(raw[a * stride + i] - raw[b * stride + i]);
        return sum / stride;
      };
      const steps = Array.from({ length: n - 1 }, (_, i) => difference(i, i + 1)).sort((a, b) => a - b);
      const p95 = steps[Math.floor(steps.length * 0.95)], seam = difference(n - 1, 0);
      assert.ok(difference(0, Math.floor(n / 2)) > 0.01 || difference(0, Math.floor(n / 4)) > 0.01, `${id} has no visible motion`);
      const finalHoldStep = difference(n - 2, n - 1);
      if (receipt.config.loop) {
        assert.ok(receipt.blender.loopMaxTransformError <= 0.0001, `${id} transforms do not close`);
        assert.ok(seam <= Math.max(1, p95 * 1.5), `${id} loop seam is unusually large: ${seam} vs ${p95}`);
      } else assert.ok(finalHoldStep <= Math.max(0.2, p95 * 0.1), `${id} one-way reveal does not settle`);
      // Reopen with Python auto-execution disabled and render using only baked data.
      const reload = path.join(out, id + '-reload'); fs.mkdirSync(reload);
      const frame = receipt.blender.posterFrame;
      run(id + '-reload', process.env.BLENDER_BIN || 'blender', ['--background', '--factory-startup', '--disable-autoexec', path.join(root, 'scene.blend'), '--threads', '2', '--render-output', path.join(reload, 'frame-'), '--render-frame', String(frame)]);
      const originalPoster = path.join(root, 'poster.png');
      const reloadedPoster = path.join(reload, `frame-${String(frame).padStart(4, '0')}.png`);
      const expectedGeometry = { width: receipt.config.width, height: receipt.config.height };
      assert.deepEqual(pngGeometry(originalPoster), expectedGeometry, `${id} poster geometry differs from receipt`);
      assert.deepEqual(pngGeometry(reloadedPoster), expectedGeometry, `${id} saved scene geometry differs`);
      const originalBytes = pixelBytes(originalPoster);
      const reloadBytes = pixelBytes(reloadedPoster);
      assert.equal(reloadBytes.length, originalBytes.length, `${id} saved scene geometry differs`);
      let changedChannels = 0, maxDifference = 0;
      for (let i = 0; i < originalBytes.length; i++) {
        const d = Math.abs(originalBytes[i] - reloadBytes[i]);
        if (d) changedChannels++;
        maxDifference = Math.max(maxDifference, d);
      }
      // GPU/EEVEE rounding may flip isolated 8-bit channels by one step after
      // reopening. Preserve exact hashes and report that distinction explicitly.
      const reloadDifference = { changedChannels, maxDifference, changedFraction: changedChannels / originalBytes.length };
      assert(maxDifference <= 1 && reloadDifference.changedFraction <= 0.001, `${id} saved scene exceeds one-step rounding tolerance: ${JSON.stringify(reloadDifference)}`);
      const originalPixels = sha(originalBytes), reloadPixels = sha(reloadBytes);
      report.cases.push({ id, directory: root, width: probe.width, height: probe.height, frames: n, renderSeconds: receipt.seconds,
        loop: receipt.config.loop, loopTransformError: receipt.blender.loopMaxTransformError, loopSeam: seam, neighbourP95: p95, finalHoldStep,
        reloadPixelsMatch: reloadPixels === originalPixels, reloadWithinTolerance: true, reloadDifference,
        posterPixelSha256: originalPixels, reloadPixelSha256: reloadPixels });
      save();
    }
    report.status = 'passed-mechanical-checks';
  } catch (e) { report.status = 'failed'; report.error = e.message; throw e; }
  finally { report.finishedAt = new Date().toISOString(); save(); }
  console.log(`Verified ${report.cases.length} sculptures. ${path.join(out, 'REPORT.md')}`);
}
