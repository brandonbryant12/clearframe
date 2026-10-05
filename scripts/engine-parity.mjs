#!/usr/bin/env node
// Library-wide engine coverage: every built-in playbook (or the ones named) is scaffolded into
// OUT, prepared as a rough cut, checked by the scene engine (inspect + frame audit), and one
// still per beat is drawn by the scene engine and by FFFrames. PSNR between the two stills
// says where the engines agree; block internals are drawn by the same code in both, so a low
// score points at film-level compositing (backdrop, grain, lens, chrome) or a defect.
//
//   codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node scripts/engine-parity.mjs OUT [playbook …]
//
// Writes OUT/report.json and OUT/<playbook>/{scene,fframes}/*.png. Sample copy and declared
// placeholders render as rough stand-ins: this measures the engines, not the films.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { scaffold, playbooks } from '../fframes/playbooks.mjs';
import { prepareProject, checkProject } from '../fframes/prepare.mjs';
import { engineCommand } from '../scene/engine.mjs';

const OUT = path.resolve(process.argv[2] ?? 'build/engine-parity');
const only = process.argv.slice(3);
const books = playbooks().map(p => p.id).filter(id => !only.length || only.includes(id));
fs.mkdirSync(OUT, { recursive: true });

function psnr(a, b) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', a, '-i', b, '-lavfi', '[0][1]psnr', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /average:(inf|[\d.]+)/.exec(r.stderr);
  return m ? (m[1] === 'inf' ? 99 : Number(m[1])) : null;
}

async function frames(root, engine, times, dir) {
  const prev = process.env.CLEARFRAME_ENGINE;
  process.env.CLEARFRAME_ENGINE = engine;
  try {
    const ctx = await prepareProject(root, { draft: true, rough: true });
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const t0 = performance.now();
    await engineCommand(ctx, 'frame', [times.map(t => `${t.toFixed(4)}s`).join(','), '-o', dir], true);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort((x, y) => x.localeCompare(y, undefined, { numeric: true }));
    return { files: files.map(f => path.join(dir, f)), ms: performance.now() - t0, job: ctx.job };
  } finally {
    if (prev == null) delete process.env.CLEARFRAME_ENGINE;
    else process.env.CLEARFRAME_ENGINE = prev;
  }
}

const report = [];
for (const id of books) {
  const root = path.join(OUT, id);
  const row = { playbook: id };
  try {
    if (!fs.existsSync(path.join(root, 'storyboard.json'))) scaffold(root, { playbook: id });
    process.env.CLEARFRAME_ENGINE = 'scene';
    const check = await checkProject(root, { draft: true, rough: true });
    delete process.env.CLEARFRAME_ENGINE;
    row.check = { errors: check.errors, warnings: check.warnings.length };
    const ctx = await prepareProject(root, { draft: true, rough: true });
    row.beats = ctx.job.beats.length;
    row.blocks = [...new Set(ctx.job.beats.map(b => b.block))];
    row.format = `${ctx.job.width}x${ctx.job.height}@${ctx.job.fps}`;
    const times = ctx.timing.beats.map(b => Math.min(b.end - 1 / ctx.timing.fps, b.start + b.dur * 0.65));
    const scene = await frames(root, 'scene', times, path.join(root, 'stills/scene'));
    const legacy = await frames(root, 'fframes', times, path.join(root, 'stills/fframes'));
    row.ms = { scene: Math.round(scene.ms), fframes: Math.round(legacy.ms) };
    row.psnr = scene.files.map((f, i) => ({ beat: ctx.job.beats[i]?.id, block: ctx.job.beats[i]?.block, db: legacy.files[i] ? psnr(f, legacy.files[i]) : null }));
    row.minPsnr = Math.min(...row.psnr.map(p => p.db ?? 0));
    row.ok = !check.errors.length;
  } catch (e) {
    row.ok = false;
    row.error = e.message.slice(0, 2000);
  }
  report.push(row);
  console.log(`${row.ok ? '✓' : '✗'} ${id} ${row.format ?? ''} min PSNR ${row.minPsnr?.toFixed?.(1) ?? '—'} dB ${row.error ? row.error.split('\n')[0] : row.check?.errors?.[0]?.split('\n')[0] ?? ''}`);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
}
const ok = report.filter(r => r.ok).length;
console.log(`\n${ok}/${report.length} playbooks prepare, check and draw with the scene engine. Report: ${path.join(OUT, 'report.json')}`);
