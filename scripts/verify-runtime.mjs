#!/usr/bin/env node
// Real encoded evidence for a runtime upgrade: fixed segments across workers, both conversion
// routes, portrait edge columns, stream/frame tags, and (optionally) the previous native binary.
// No provider calls. Run: node scripts/verify-runtime.mjs NEW-DIR [PREVIOUS-NATIVE-BINARY]
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { enterGate } from '../engine/lib/resource-gate.mjs';
import { renderProject } from '../film/render.mjs';
import { prepareProjectSync } from '../film/prepare.mjs';
import { sceneHash } from '../scene/engine.mjs';
import { sha256File } from '../engine/lib/store.mjs';

const out = path.resolve(process.argv[2] ?? 'build/runtime-verification');
const reference = process.argv[3] && path.resolve(process.argv[3]);
if (!(await enterGate())) await verify();

function command(bin, args, options = {}) {
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
  assert.equal(r.status, 0, `${bin}: ${r.error?.message ?? r.stderr}`);
  return r.stdout;
}
function frames(file) {
  return command('ffmpeg', ['-v', 'error', '-threads', '2', '-i', file, '-map', '0:v:0', '-an', '-threads', '2', '-f', 'framemd5', '-'])
    .split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split(',').at(-1).trim());
}
function pixels(file) {
  return command('ffmpeg', ['-v', 'error', '-threads', '2', '-i', file, '-vf', 'select=eq(n\\,45)', '-frames:v', '1', '-threads', '2', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { encoding: null });
}
function edgeColor(rgb, width, height, side) {
  const sum = [0, 0, 0];
  let count = 0;
  for (let y = 32; y < height - 32; y += 8) for (let x = 0; x < 8; x++) {
    const at = (y * width + (side === 'left' ? x : width - 1 - x)) * 3;
    sum.forEach((_, channel) => (sum[channel] += rgb[at + channel]));
    count++;
  }
  return sum.map(v => v / count);
}
function psnr(a, b) {
  assert.equal(a.length, b.length);
  let error = 0;
  for (let i = 0; i < a.length; i++) error += (a[i] - b[i]) ** 2;
  return error ? 10 * Math.log10(255 ** 2 / (error / a.length)) : Infinity;
}
function storyboard(width, height) {
  return {
    version: 2, title: 'Runtime colour and continuity fixture', format: { width, height, fps: 30 },
    music: false, captions: false, camera: 'none', texture: 'none',
    beats: [{ id: 'move', block: 'canvas', duration: 3, camera: 'none', props: { elements: [
      { type: 'rect', x: 0, y: 0, w: width, h: height, fill: '#303030', at: 0, enter: 'none' },
      { type: 'rect', x: 0, y: 0, w: 40, h: height, fill: '#ff0000', at: 0, enter: 'none' },
      { type: 'rect', x: width - 40, y: 0, w: 40, h: height, fill: '#00ffff', at: 0, enter: 'none' },
      { type: 'rect', x: width * 0.15, y: height * 0.3, w: 180, h: 180, fill: '#ffb000', at: 0, enter: 'none',
        keys: [{ at: 0.2, x: width * 0.65, dur: 2.2 }] },
      { type: 'text', text: 'A continuous move', x: width / 2, y: height * 0.17, size: 60,
        anchor: 'middle', fill: '#ffffff', at: 0, enter: 'none' },
    ] } }],
  };
}

async function verify() {
  assert.ok(!fs.existsSync(out), 'Choose a new evidence directory; existing results are never overwritten.');
  const space = fs.statfsSync(path.dirname(out));
  assert.ok(space.bavail * space.bsize >= 20 * 2 ** 30, 'Keep 20 GiB free before native verification.');
  fs.mkdirSync(out, { recursive: true });
  const referenceSha256 = reference ? sha256File(reference) : null;
  const report = { status: 'running', rendererSourceHash: sceneHash(), reference, referenceSha256, cases: [] };
  const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  save();
  const original = { workers: process.env.CLEARFRAME_RENDER_WORKERS, threads: process.env.CLEARFRAME_ENCODER_THREADS, gpu: process.env.CLEARFRAME_GPU_YUV };
  try {
    process.env.CLEARFRAME_ENCODER_THREADS = '2';
    for (const [name, width, height] of [['landscape', 1920, 1080], ['portrait', 1080, 1920]]) {
      const root = path.join(out, name);
      fs.mkdirSync(root);
      fs.writeFileSync(path.join(root, 'storyboard.json'), JSON.stringify(storyboard(width, height), null, 2));
      const item = { name, width, height, exports: [] };
      let expectedFrames, expectedPixels;
      for (const [label, workers, gpu] of [['gpu-one', 1, '1'], ['gpu-two', 2, '1'], ['cpu-two', 2, '0']]) {
        process.env.CLEARFRAME_RENDER_WORKERS = String(workers);
        process.env.CLEARFRAME_GPU_YUV = gpu;
        const file = path.join(root, `${label}.mp4`);
        const receipt = await renderProject(root, { out: file, noAudio: true, revision: false });
        const native = receipt.native;
        assert.equal(native.runtime, 'fframes');
        assert.equal(native.frames, 90);
        assert.equal(native.workers, workers);
        assert.equal(native.encoder.name, 'libx264');
        assert.equal(native.encoder.parameters.crf, '16');
        assert.equal(native.encoder.parameters.preset, 'medium');
        assert.equal(native.encoder.parameters.threads, '2');
        assert.equal(native.segments, 3);
        assert.equal(native.conversion.gpuI420Frames + native.conversion.cpuI420Frames + native.conversion.runtimeFrames, 90);
        if (gpu === '0') assert.equal(native.conversion.cpuI420Frames, 90);
        else assert.equal(native.conversion.gpuI420Frames, 90, 'This GPU-path check requires Metal.');
        const hashes = frames(file), rgb = pixels(file);
        assert.equal(hashes.length, 90);
        const left = edgeColor(rgb, width, height, 'left'), right = edgeColor(rgb, width, height, 'right');
        assert.ok(left[0] > 210 && left[1] < 40 && left[2] < 40, `red left edge: ${left}`);
        assert.ok(right[0] < 40 && right[1] > 210 && right[2] > 210, `cyan right edge: ${right}`);
        const probe = JSON.parse(command('ffprobe', ['-v', 'error', '-threads', '2', '-select_streams', 'v:0', '-show_frames', '-show_streams', '-of', 'json', file]));
        for (const v of [...probe.streams, ...probe.frames]) {
          assert.equal(v.color_space, 'smpte170m'); assert.equal(v.color_primaries, 'bt709');
          assert.equal(v.color_transfer, 'iec61966-2-1'); assert.equal(v.color_range, 'tv');
        }
        if (!expectedFrames) { expectedFrames = hashes; expectedPixels = rgb; }
        else if (gpu === '1') assert.deepEqual(hashes, expectedFrames, 'Changing worker count must preserve every decoded frame.');
        const score = psnr(rgb, expectedPixels);
        assert.ok(score >= 40, `conversion paths disagree: ${score} dB`);
        item.exports.push({ label, native, videoSha256: receipt.outputSha256, frameHashes: hashes,
          pixelSha256: crypto.createHash('sha256').update(rgb).digest('hex'), edges: { left, right }, psnr: Number.isFinite(score) ? score : 'identical' });
        console.log(`${name}/${label}: 90 frames; ${native.segments} segments; tags and edges passed`);
      }
      if (reference) {
        const ctx = prepareProjectSync(root), file = path.join(root, 'previous-runtime.mp4');
        assert.equal(sha256File(reference), referenceSha256, 'The comparison binary changed during verification.');
        command(reference, ['--plan', path.join(ctx.dir, 'plan.json'), 'render', '-o', file],
          { env: { ...process.env, CLEARFRAME_GPU_YUV: '1', CLEARFRAME_RENDER_WORKERS: '2' } });
        assert.equal(sha256File(reference), referenceSha256, 'The comparison binary changed during rendering.');
        const hashes = frames(file);
        assert.deepEqual(hashes, expectedFrames, 'The runtime upgrade must preserve every decoded frame of this fixture.');
        item.reference = { binary: reference, sha256: referenceSha256, frames: hashes.length, decodedFramesIdentical: true };
      }
      report.cases.push(item); save();
    }
    report.status = 'passed'; save();
  } catch (e) { report.status = 'failed'; report.error = e.stack; save(); throw e; }
  finally {
    for (const [key, value] of Object.entries({ CLEARFRAME_RENDER_WORKERS: original.workers, CLEARFRAME_ENCODER_THREADS: original.threads, CLEARFRAME_GPU_YUV: original.gpu }))
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
