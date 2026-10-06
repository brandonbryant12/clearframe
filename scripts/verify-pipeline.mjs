#!/usr/bin/env node
// Exercise the public CLI from portable intake to retained review artifacts. No provider calls.
// node scripts/verify-pipeline.mjs /path/to/new-evidence [--quick]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { enterGate } from '../engine/lib/resource-gate.mjs';
import { wireframePNG } from '../film/wireframe.mjs';
import { palette } from '../film/catalog.mjs';
const args = process.argv.slice(2);
const quick = args.includes('--quick');
if (args.some(a => a.startsWith('--') && a !== '--quick')) throw new Error('Usage: verify-pipeline.mjs NEW-DIR [--quick]');
const out = path.resolve(args.find(a => !a.startsWith('--')) ?? 'build/pipeline-verification');
const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cli = path.join(repo, 'engine/cli.mjs');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (!(await enterGate())) await verify();
async function verify() {
  if (fs.existsSync(out)) throw new Error('Evidence directory exists. Choose a new directory to preserve prior runs.');
  const free = fs.statfsSync(repo);
  if (free.bavail * free.bsize < 20 * 2 ** 30) throw new Error('Keep at least 20 GiB free before native pipeline verification.');
  fs.mkdirSync(path.join(out, 'logs'), { recursive: true });
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
  const dirty = !!spawnSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
  const report = { version: 1, status: 'running', revision, dirty, mode: quick ? 'quick' : 'full', cases: [], checks: [], startedAt: new Date().toISOString() };
  const started = performance.now();
  function save() {
    fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(out, 'REPORT.md'), `# CLI pipeline verification\n\nStatus: **${report.status}**\nRevision: ${revision}${dirty ? ' (working changes present)' : ''}\n\n` +
      `## Checks\n${report.checks.map(s => `- ${s}`).join('\n')}\n\n## Films\n` +
      report.cases.map(c => `- [${c.name}](${path.relative(out, path.join(c.run.dir, 'REPORT.md'))}): ${c.run.status}, ${c.run.seconds.toFixed(1)} s, ${c.run.reviewQueue.length} review items`).join('\n') +
      (report.benchmark ? `\n\n## Same-input raster comparison\nFull size: ${report.benchmark.fullSeconds.toFixed(2)} s. Half size: ${report.benchmark.halfSeconds.toFixed(2)} s. Ratio: ${report.benchmark.ratio.toFixed(2)}× on this one fixture. Identical frame clock and decoded PCM audio. Renderer/finishing timings exclude story authoring and voice preparation.\n` : '') +
      (report.error ? `\n## Failure\n${report.error}\n` : '') +
      `\nMechanical verification does not approve the story, source claims, brand or listening quality. The fixture data are illustrative and narration is local synthetic draft speech. Review the saved films and queues.\n`);
  }
  function command(name, commandArgs, { fails = false } = {}) {
    const r = spawnSync(process.execPath, [cli, ...commandArgs], { cwd: repo, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, env: { ...process.env, CLEARFRAME_HEAVY_HELD: '1' } });
    fs.writeFileSync(path.join(out, 'logs', name + '.log'), (r.stdout ?? '') + '\n--- stderr ---\n' + (r.stderr ?? ''));
    if (fails) assert.notEqual(r.status, 0, `${name} unexpectedly succeeded`);
    else assert.equal(r.status, 0, `${name}: ${r.error?.message ?? r.stderr}`);
    return r;
  }
  function pcm(file) {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-threads', '2', '-i', file, '-map', '0:a:0', '-f', 's16le', '-acodec', 'pcm_s16le', '-'], { maxBuffer: 64 * 1024 * 1024 });
    assert.equal(r.status, 0, r.stderr?.toString()); assert.ok(r.stdout.length > 0);
    return { sha256: sha(r.stdout), bytes: r.stdout.length };
  }
  save();
  try {
    const kit = path.join(out, 'input-kit'); fs.mkdirSync(kit);
    const logo = wireframePNG(palette('midnight'));
    fs.writeFileSync(path.join(kit, 'approved-art.png'), logo);
    const brand = read(path.join(repo, 'examples/financial-intake/brand.json'));
    brand.assets = [{ id: 'approved-art', file: 'approved-art.png', role: 'illustrative test artwork' }];
    fs.writeFileSync(path.join(kit, 'brand.json'), JSON.stringify(brand));
    fs.copyFileSync(path.join(repo, 'examples/financial-intake/report.md'), path.join(kit, 'report.md'));
    const base = ['cash-flow', ...(quick ? [] : ['scenario-lab', 'risk-tradeoffs', 'research-investigation', 'podcast-thread'])];
    for (const book of base) for (const vertical of (quick ? [false] : [false, true])) {
      const name = book + (vertical ? '-vertical' : ''), dir = path.join(out, name);
      const setup = book === 'cash-flow' && !vertical
        ? ['start', dir, '--idea', 'Explain why cash timing matters', '--document', path.join(kit, 'report.md'), '--brand', path.join(kit, 'brand.json'), '--playbook', book, '--json']
        : ['new', dir, '--playbook', book, ...(vertical ? ['--vertical'] : [])];
      command(name + '-start', setup);
      if (book === 'cash-flow' && !vertical) {
        const intake = read(path.join(dir, 'intake.json'));
        assert.equal(intake.assets[0].sha256, sha(logo));
        assert.deepEqual(fs.readFileSync(path.join(dir, intake.assets[0].file)), logo);
        // The project must stand on copied bytes, with no dependency on the original kit.
        fs.rmSync(kit, { recursive: true });
        report.checks.push('Portable intake retains the document and exact asset bytes after the original kit is removed.');
      }
      const r = command(name + '-pipeline', ['pipeline', dir, '--draft', '--scale', '0.5', '--json']);
      const run = JSON.parse(r.stdout);
      assert.equal(run.status, 'ready-for-review');
      assert.ok(run.stages.every(s => s.status === 'passed' && Number.isFinite(s.seconds)));
      assert.equal(run.check.inputId, run.render.inputId);
      assert.equal(read(run.artifacts.sheetReceipt).inputId, run.render.inputId);
      assert.equal(sha(fs.readFileSync(run.artifacts.storyboard)), run.render.hashes['storyboard.json']);
      assert.equal(sha(fs.readFileSync(run.artifacts.video)), run.render.outputSha256);
      assert.ok(!run.qa.findings.some(f => f.level === 'error'));
      assert.equal(read(run.artifacts.qa).output.scale, 0.5);
      for (const artifact of Object.values(run.artifacts)) assert.ok(fs.existsSync(artifact), artifact);
      report.cases.push({ name, run }); save();
      console.log(`${name}: ${run.seconds.toFixed(1)} s, ${run.render.frames} frames, ${run.reviewQueue.length} review items`);
    }
    const first = report.cases[0].run, project = first.project;
    const full = path.join(out, 'same-input-full.mp4');
    command('full-resolution-draft', ['preview', project, '--scale', '1', '--out', full]);
    const fullReceipt = read(full + '.json');
    assert.equal(fullReceipt.inputId, first.render.inputId);
    assert.equal(fullReceipt.frames, first.render.frames); assert.equal(fullReceipt.fps, first.render.fps);
    assert.equal(fullReceipt.width, first.render.width * 2); assert.equal(fullReceipt.height, first.render.height * 2);
    const fullAudio = pcm(full), halfAudio = pcm(first.artifacts.video);
    assert.deepEqual(fullAudio, halfAudio, 'Scaling must not change decoded audio');
    report.benchmark = { fullSeconds: fullReceipt.seconds, halfSeconds: first.render.seconds, ratio: fullReceipt.seconds / first.render.seconds,
      frames: fullReceipt.frames, fps: fullReceipt.fps, audio: fullAudio };
    report.checks.push('Full- and half-resolution drafts have matching input IDs, frame counts/FPS and byte-identical decoded PCM audio.');
    command('reject-scaled-final', ['pipeline', project, '--scale', '0.5'], { fails: true });
    report.checks.push('Final mode rejects reduced resolution.');
    const before = sha(fs.readFileSync(first.artifacts.video));
    const final = command('final-pipeline', ['pipeline', project, '--json']);
    const finalRun = JSON.parse(final.stdout);
    assert.equal(finalRun.status, 'ready-for-review'); assert.equal(finalRun.render.draft, false);
    assert.equal(finalRun.render.width, 1920); assert.equal(finalRun.render.height, 1080);
    assert.equal(sha(fs.readFileSync(first.artifacts.video)), before);
    report.cases.push({ name: 'cash-flow-final-encode', run: finalRun });
    report.checks.push('Final encoder passes the same CLI checks, and a later run preserves the earlier draft bytes.');
    const broken = path.join(out, 'invalid-film'); fs.mkdirSync(broken);
    fs.writeFileSync(path.join(broken, 'storyboard.json'), JSON.stringify({ beats: [{ id: 'bad', block: 'stat', props: { value: 42 } }] }));
    command('failed-run-report', ['pipeline', broken, '--no-render'], { fails: true });
    const failures = fs.readdirSync(path.join(broken, 'build/pipeline'));
    const failure = read(path.join(broken, 'build/pipeline', failures[0], 'report.json'));
    assert.equal(failure.status, 'failed'); assert.ok(failure.stages.some(s => s.status === 'failed'));
    assert.ok(!failure.artifacts.video);
    report.checks.push('A failing source/check persists a failed stage report and does not claim a video.');
    report.status = 'passed-mechanical-checks';
  } catch (e) { report.status = 'failed'; report.error = e.message; throw e; }
  finally { report.seconds = (performance.now() - started) / 1000; report.finishedAt = new Date().toISOString(); save(); }
  console.log(`Evidence: ${path.join(out, 'REPORT.md')}`);
}
