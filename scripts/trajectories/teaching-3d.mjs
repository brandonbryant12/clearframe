#!/usr/bin/env node
// Retained one-way sculpture clips under native questions and worked answers.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { enterGate } from '../../engine/lib/resource-gate.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ids = ['quiz-triptych', 'gap-bridge'], files = ['clip.mp4', 'poster.png', 'scene.blend'];
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hash = file => digest(fs.readFileSync(file));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
const PANEL = { x: 1010, y: 300, width: 800, height: 450 };

export function authorStoryboard({ quizSeed = 17 } = {}) {
  assert(Number.isSafeInteger(quizSeed) && quizSeed >= 0 && quizSeed % 3 === 2, 'This example maps option C to the selected right tile.');
  const question = { form: 'choice', prompt: 'What changed from 4% to 5%?', options: ['1 percent', '5 percent', '1 percentage point'], correctIndex: 2,
    explanation: 'The rates differ by 1 percentage point. The relative increase is 25%.' };
  const gap = { form: 'gap', prompt: 'Complete the statement.', before: 'From 4% to 5% is', answer: '1 percentage point', after: 'higher.',
    explanation: 'Subtract the two percentages: 5 minus 4 equals 1 percentage point.' };
  const source = 'Arithmetic example · 4% to 5%';
  const beats = [];
  for (const [id, teaching, reading] of [['quiz-triptych', question, 4.5], ['gap-bridge', gap, 4]]) {
    for (const phase of ['question', 'answer']) {
      const labels = id === 'quiz-triptych' ? [0.31, 0.49, 0.68].map((position, i) => ({ type: 'text', id: `${id}-${phase}-tile-label-${i}`, text: String.fromCharCode(65 + i),
        x: PANEL.x + PANEL.width * position, y: 838, size: 42, font: 'mono', fill: 'ink', anchor: 'middle', at: 0, enter: 'none' })) : [];
      beats.push({ id: `${id}-${phase}`, block: 'canvas', duration: phase === 'question' ? reading : 6, camera: 'none',
        plate: { asset: `${id}-${phase}`, side: 'full', treatment: 'none', drift: 'none', scrim: 0, loop: false },
        props: { source, teaching: { ...teaching, phase, layout: 'split', motion: 'fade', revealAt: 0.4, explainAt: 2.2 },
          elements: [{ type: 'rect', id: `${id}-${phase}-picture-outline`, x: PANEL.x - 8, y: PANEL.y - 8, w: PANEL.width + 16, h: PANEL.height + 16,
            fill: 'none', stroke: '#ded7cc', width: 2, r: 6, at: 0, enter: 'none' }, ...labels] } });
    }
  }
  return { version: 2, title: 'Think, reveal, explain — dimensional teaching', logline: 'One question, a considered pause, then a visible answer and a worked explanation.',
    format: { preset: 'landscape', fps: 30 }, theme: 'porcelain', type: 'geometric', motion: { preset: 'gentle', intensity: 0.45 },
    transition: 'cut', backdrop: 'none', chrome: false, captions: false, music: false, sfx: 'off', texture: { grain: 0 },
    pacing: { lead: 0, tail: 0, minBeat: 0, outro: 0 },
    continuity: { maxGeneratedShare: 1, treatment: 'Two original retained sculpture reveals in a consistent picture panel; native type carries all teaching content.',
      camera: 'Keep each complete 3D view; contain the image in the panel without crop or native camera motion.', motion: 'Still question image, one-way answer action, then a stable completed state.' },
    sources: [{ claim: 'A rise from 4% to 5% is 1 percentage point and a 25% relative increase.', source: 'Arithmetic example: 5 − 4 = 1; (5 − 4) / 4 = 0.25.' },
      { claim: 'The right-hand quiz tile maps to native option C / correctIndex 2.', source: `Retained quiz-triptych receipt: seed ${quizSeed} modulo 3 = 2. Labels A/B/C map left/middle/right.` },
      { claim: 'The answer plates use one-way retained 3D reveals and hold their completed state.', source: 'asset-manifest.json and derivative-receipts.json retain the original assets and exact scale/pad/final-frame extension commands.' }],
    assets: ids.flatMap(id => [{ id: `${id}-question`, kind: 'image', file: `assets/img/${id}-question.png` }, { id: `${id}-answer`, kind: 'clip', file: `assets/clips/${id}-answer.mp4` }]), beats };
}

function copyVerified(from, to, expected) {
  const bytes = fs.readFileSync(from), actual = digest(bytes);
  if (expected) assert.equal(actual, expected, `Source receipt mismatch: ${from}`);
  fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, bytes);
  assert.equal(hash(to), actual, `Copied bytes changed: ${to}`);
  return { sha256: actual, bytes: bytes.length };
}

function run(command, args, log) {
  return new Promise((resolve, reject) => {
    const start = performance.now(), p = spawn(command, args, { cwd: repo, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', failed;
    const interrupt = () => p.kill('SIGINT'), terminate = () => p.kill('SIGTERM');
    process.once('SIGINT', interrupt); process.once('SIGTERM', terminate);
    p.stdout.on('data', b => { stdout += b; if (stdout.length > 8 * 1024 * 1024) { failed = Error('Command output exceeded 8 MiB'); p.kill('SIGTERM'); } });
    p.stderr.on('data', b => stderr += b);
    p.once('error', e => failed = e);
    p.once('close', code => {
      process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate);
      fs.writeFileSync(log, stderr);
      if (failed || code !== 0) return reject(failed ?? Error(`${command} exited ${code}; see ${log}`));
      resolve({ command: [command, ...args], seconds: (performance.now() - start) / 1000, stdout });
    });
  });
}

export async function prepare(assetRoot, out, { final = false } = {}) {
  assetRoot = path.resolve(assetRoot); out = path.resolve(out);
  assert(!fs.existsSync(out), 'Choose a fresh output directory; prior source and review evidence is retained.');
  const inputs = ids.map(id => {
    const folder = path.join(assetRoot, id), receiptBytes = fs.readFileSync(path.join(folder, 'receipt.json')), receipt = JSON.parse(receiptBytes);
    assert.equal(receipt.status, 'ready-for-review'); assert.equal(receipt.config.loop, false);
    assert.equal(receipt.config.pos, 0, `${id} must retain its unrevealed question poster`); assert.equal(receipt.blender.posterFrame, 1);
    assert.equal(receipt.blender.requiresAutoExec, false); assert.equal(receipt.blender.bakedMotion, true);
    assert.deepEqual(Object.keys(receipt.outputs).sort(), [...files].sort());
    assert(receipt.config.frames / receipt.config.fps <= 6, `${id} action would exceed its answer beat`);
    if (final) { assert.equal(receipt.config.draft, false); assert.equal(receipt.config.width, 1920); assert.equal(receipt.config.height, 1080); }
    assert.equal(receipt.config.width / receipt.config.height, 16 / 9, 'This authored picture panel expects a landscape master.');
    if (id === 'quiz-triptych') assert.equal(receipt.config.seed % 3, 2, 'The selected tile must match correctIndex 2 / C.');
    for (const file of files) { assert.equal(receipt.outputs[file].file, file); assert.equal(hash(path.join(folder, file)), receipt.outputs[file].sha256); }
    return { id, folder, receipt, receiptBytes };
  });
  fs.mkdirSync(path.join(out, 'source'), { recursive: true });
  const disk = fs.statfsSync(out); assert(disk.bavail * disk.bsize >= 20 * 2 ** 30, 'Keep at least 20 GiB free before derivative rendering.');
  fs.mkdirSync(path.join(out, 'assets/img'), { recursive: true }); fs.mkdirSync(path.join(out, 'assets/clips'), { recursive: true }); fs.mkdirSync(path.join(out, 'logs'));
  copyVerified(fileURLToPath(import.meta.url), path.join(out, 'source/authoring-source.mjs'));
  write(path.join(out, 'source/helper-hashes.json'), Object.fromEntries(['fframes/teaching.mjs', 'fframes/job.mjs'].map(file => [file, hash(path.join(repo, file))])));
  const manifest = [], derivatives = [], startedAt = new Date().toISOString(), start = performance.now();
  for (const { id, folder, receipt: r, receiptBytes } of inputs) {
    const retained = path.join(out, 'source/artifacts', id), kept = {};
    for (const file of files) kept[file] = copyVerified(path.join(folder, file), path.join(retained, file), r.outputs[file].sha256);
    fs.writeFileSync(path.join(retained, 'receipt.json'), receiptBytes); kept['receipt.json'] = { sha256: digest(receiptBytes), bytes: receiptBytes.length };
    for (const name of ['asset.json', 'blender.json', 'render-config.json']) if (fs.existsSync(path.join(folder, name))) kept[name] = copyVerified(path.join(folder, name), path.join(retained, name));
    for (const [file, expected] of Object.entries(r.sourceHashes)) kept[`source/${path.basename(file)}`] = copyVerified(path.join(folder, 'source', path.basename(file)), path.join(retained, 'source', path.basename(file)), expected);
    manifest.push({ id, copiedFrom: folder, configuration: r.config, files: kept, mapping: id === 'quiz-triptych' ? { selectedIndex: 2, option: 'C', screenOrder: ['A', 'B', 'C'], positions: ['left', 'middle', 'right'] } : null });
    const geometry = `scale=${PANEL.width}:${PANEL.height}:flags=lanczos,pad=1920:1080:${PANEL.x}:${PANEL.y}:color=0xf6f1ea,setsar=1`;
    const imageFile = path.join(out, `assets/img/${id}-question.png`), imageRun = await run('ffmpeg', ['-v', 'error', '-nostdin', '-threads', '2', '-filter_threads', '2', '-i', path.join(retained, 'poster.png'), '-vf', geometry, '-frames:v', '1', '-threads', '2', imageFile], path.join(out, 'logs', `${id}-poster.log`));
    const extra = Math.max(0, 6 - r.config.frames / r.config.fps), filter = `${geometry},tpad=stop_mode=clone:stop_duration=${extra},fps=30`;
    const clipFile = path.join(out, `assets/clips/${id}-answer.mp4`), clipRun = await run('ffmpeg', ['-v', 'error', '-nostdin', '-threads', '2', '-filter_threads', '2', '-i', path.join(retained, 'clip.mp4'), '-vf', filter, '-t', '6', '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-colorspace', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', clipFile], path.join(out, 'logs', `${id}-answer.log`));
    const probeRun = await run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,nb_read_frames,avg_frame_rate:format=duration', '-of', 'json', clipFile], path.join(out, 'logs', `${id}-probe.log`));
    const probe = JSON.parse(probeRun.stdout); assert.equal(probe.streams[0].width, 1920); assert.equal(probe.streams[0].height, 1080);
    assert.equal(probe.streams[0].avg_frame_rate, '30/1'); assert.equal(Number(probe.streams[0].nb_read_frames), 180); assert(Math.abs(Number(probe.format.duration) - 6) < 0.05);
    derivatives.push({ id, panel: PANEL, fit: 'Entire 16:9 source scaled proportionally; no crop.', finalFrameHoldSeconds: extra, deliveryFps: 30,
      original: { poster: r.outputs['poster.png'].sha256, clip: r.outputs['clip.mp4'].sha256 },
      image: { file: path.relative(out, imageFile), sha256: hash(imageFile), command: imageRun.command, seconds: imageRun.seconds },
      clip: { file: path.relative(out, clipFile), sha256: hash(clipFile), command: clipRun.command, seconds: clipRun.seconds, probe }, loop: false });
  }
  write(path.join(out, 'storyboard.json'), authorStoryboard({ quizSeed: inputs[0].receipt.config.seed })); write(path.join(out, 'asset-manifest.json'), manifest); write(path.join(out, 'derivative-receipts.json'), derivatives);
  fs.writeFileSync(path.join(out, 'accessible-transcript.txt'), 'Question: What changed from 4% to 5%? A: 1 percent. B: 5 percent. C: 1 percentage point.\nPause.\nAnswer C. The rates differ by 1 percentage point. The relative increase is 25%.\n\nComplete the statement: From 4% to 5% is [blank] higher.\nPause.\nAnswer: 1 percentage point. Subtract the two percentages: 5 minus 4 equals 1 percentage point.\n');
  const trajectory = { version: 1, kind: 'dimensional-teaching', status: 'prepared', startedAt, preparedAt: new Date().toISOString(), project: out, assetRoot,
    finalAssets: final, duration: 20.5, preparedSeconds: (performance.now() - start) / 1000, blenderRenders: 0, paidCalls: 0, runs: [],
    timingNotice: 'Preparation measures copying, derivative encoding and file writing after the resource gate. It does not measure original creative authoring or the retained Blender master renders.' };
  write(path.join(out, 'trajectory.json'), trajectory); return trajectory;
}

export async function render(out, { final = false } = {}) {
  out = path.resolve(out); const trajectory = read(path.join(out, 'trajectory.json'));
  if (final) assert.equal(trajectory.finalAssets, true, 'Final delivery requires preparation from final sculpture masters.');
  const result = await run(process.execPath, [path.join(repo, 'engine/cli.mjs'), 'pipeline', out, ...(!final ? ['--draft', '--scale', '0.5'] : []), '--json'], path.join(out, `pipeline-${trajectory.runs.length + 1}.log`));
  const report = JSON.parse(result.stdout); assert.equal(report.status, 'ready-for-review');
  assert.deepEqual(report.check.errors, []); assert.equal(report.qa.findings.filter(x => x.level === 'error').length, 0);
  trajectory.runs.push({ command: result.command, cliSeconds: result.seconds, report }); trajectory.status = 'ready-for-agent-visual-review';
  write(path.join(out, 'trajectory.json'), trajectory); return trajectory;
}

async function main() {
  const { values } = parseArgs({ options: { 'asset-root': { type: 'string' }, out: { type: 'string' }, render: { type: 'boolean' }, 'render-only': { type: 'boolean' }, final: { type: 'boolean' } } });
  assert(values.out, 'Use --out PROJECT with --asset-root RETAINED-MASTERS; --render optionally runs the native pipeline.');
  let result;
  if (!values['render-only']) { assert(values['asset-root'], '--asset-root is required for preparation'); result = await prepare(values['asset-root'], values.out, { final: values.final }); }
  if (values.render || values['render-only']) result = await render(values.out, { final: values.final });
  console.log(JSON.stringify({ status: result.status, project: result.project, trajectory: path.join(result.project, 'trajectory.json'), latest: result.runs.at(-1)?.report.artifacts }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href && !(await enterGate())) await main();
