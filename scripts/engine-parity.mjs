#!/usr/bin/env node
// Library-wide coverage: every built-in playbook (or the ones named) is scaffolded into OUT,
// prepared as a rough cut, checked (inspect + frame audit), and one still per beat is drawn.
// With --reference DIR (an earlier run of this script, such as the retained FFFrames-era run in
// build/parity, whose DIR/<name>/stills/fframes/<t>s.png name the times), the same moments are
// drawn and compared with each reference still by PSNR, so a change in the picture is measured
// against what the library looked like before, without a second renderer.
//
//   codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node scripts/engine-parity.mjs OUT [--reference DIR] [playbook | project-dir …]
//
// A project directory (one with storyboard.json, e.g. from `clearframe gallery DIR [--sketches]`)
// is used as it is instead of being scaffolded. Writes OUT/report.json and OUT/<name>/stills/*.png.
// Sample copy and declared placeholders render as rough stand-ins: this measures the renderer,
// not the films.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { scaffold, playbooks } from '../film/playbooks.mjs';
import { prepareProject, checkProject } from '../film/prepare.mjs';
import { engineCommand } from '../scene/engine.mjs';

const args = process.argv.slice(2);
const flag = args.indexOf('--reference');
const reference = flag >= 0 ? path.resolve(args.splice(flag, 2)[1]) : null;
const OUT = path.resolve(args[0] ?? 'build/engine-parity');
const only = args.slice(1);
const dirs = only.filter(a => fs.existsSync(path.join(a, 'storyboard.json'))).map(a => path.resolve(a));
const books = dirs.length ? [] : playbooks().map(p => p.id).filter(id => !only.length || only.includes(id));
fs.mkdirSync(OUT, { recursive: true });

function psnr(a, b) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', a, '-i', b, '-lavfi', '[0][1]psnr', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /average:(inf|[\d.]+)/.exec(r.stderr);
  return m ? (m[1] === 'inf' ? 99 : Number(m[1])) : null;
}
const numeric = (x, y) => x.localeCompare(y, undefined, { numeric: true });
/** Reference stills for `name`, in time order: [{ seconds, file }]. */
function referenceStills(name) {
  if (!reference) return null;
  for (const sub of ['stills/fframes', 'stills/scene', 'stills']) {
    const dir = path.join(reference, name, sub);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => /^[\d.]+s\.png$/.test(f)).sort(numeric);
    if (files.length) return files.map(f => ({ seconds: Number(f.slice(0, -5)), file: path.join(dir, f) }));
  }
  return null;
}

const report = [];
for (const id of [...books, ...dirs]) {
  const name = path.isAbsolute(id) ? path.basename(id) : id;
  const root = path.isAbsolute(id) ? id : path.join(OUT, id);
  const row = { playbook: name, ...(path.isAbsolute(id) ? { project: id } : {}) };
  try {
    if (!fs.existsSync(path.join(root, 'storyboard.json'))) scaffold(root, { playbook: id });
    const check = await checkProject(root, { draft: true, rough: true });
    row.check = { errors: check.errors, warnings: check.warnings.length };
    const ctx = await prepareProject(root, { draft: true, rough: true });
    row.beats = ctx.job.beats.length;
    row.blocks = [...new Set(ctx.job.beats.map(b => b.block))];
    row.format = `${ctx.job.width}x${ctx.job.height}@${ctx.job.fps}`;
    const refs = referenceStills(name);
    const times = refs?.map(r => r.seconds) ?? ctx.timing.beats.map(b => Math.min(b.end - 1 / ctx.timing.fps, b.start + b.dur * 0.65));
    const dir = path.join(OUT, name, 'stills');
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const t0 = performance.now();
    await engineCommand(ctx, 'frame', [times.map(t => `${t.toFixed(4)}s`).join(','), '-o', dir], true);
    row.ms = Math.round(performance.now() - t0);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort(numeric).map(f => path.join(dir, f));
    if (refs) {
      row.psnr = files.map((f, i) => {
        const beat = ctx.timing.beats.find(b => times[i] >= b.start && times[i] < b.end);
        return { beat: beat?.id, block: ctx.job.beats.find(b => b.id === beat?.id)?.block, seconds: times[i], db: refs[i] ? psnr(f, refs[i].file) : null };
      });
      row.minPsnr = Math.min(...row.psnr.map(p => p.db ?? 0));
    }
    row.ok = !check.errors.length;
  } catch (e) {
    row.ok = false;
    row.error = e.message.slice(0, 2000);
  }
  report.push(row);
  console.log(`${row.ok ? '✓' : '✗'} ${row.playbook} ${row.format ?? ''}${row.minPsnr != null ? ` min PSNR ${row.minPsnr.toFixed(1)} dB` : ''} ${row.error ? row.error.split('\n')[0] : row.check?.errors?.[0]?.split('\n')[0] ?? ''}`);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
}
const ok = report.filter(r => r.ok).length;
console.log(`\n${ok}/${report.length} prepare, check and draw. Report: ${path.join(OUT, 'report.json')}`);
