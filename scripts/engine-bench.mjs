#!/usr/bin/env node
// Engine measurements on the same prepared projects: the scene engine against FFFrames, at the
// same resolution, frame rate and encoder settings (libx264, final CRF 16 medium; the range uses
// draft CRF 21 veryfast at full scale, as `revise` does). Measured separately:
//   cold   process start, GPU/font/media setup and one still (a new process each time)
//   warm   per-still cost inside one process (ten stills minus one, over nine)
//   range  60 frames from the middle of the film, encoded
//   full   the whole film, encoded (picture only: audio finishing is shared and identical)
//   peak   summed RSS of the engine process and its children (sampled every 50 ms)
//   disk   peak bytes in the render's temporary directory
// Each command runs `--repeat` times (default 2) and every run is reported. The numbers describe
// this machine and these projects; they are not a general speed claim.
//
//   codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node scripts/engine-bench.mjs OUT PROJECT… [--repeat N]
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { prepareProject } from '../fframes/prepare.mjs';
import { buildEngine, engineBinary, sceneArgs, sceneEnv } from '../scene/engine.mjs';
import { nativeEnv } from '../fframes/native-build.mjs';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { repeat: { type: 'string', default: '2' } } });
const [OUT, ...projects] = positionals.map(p => path.resolve(p));
if (!OUT || !projects.length) throw new Error('usage: engine-bench.mjs OUT PROJECT…');
const repeat = Number(values.repeat);
fs.mkdirSync(OUT, { recursive: true });

function tree(pid) {
  const ps = spawnSync('ps', ['-axo', 'pid=,ppid=,rss='], { encoding: 'utf8' }).stdout.trim().split('\n').map(l => l.trim().split(/\s+/).map(Number));
  const kids = new Map();
  for (const [p, pp, rss] of ps) kids.set(pp, [...(kids.get(pp) ?? []), [p, rss]]);
  let total = ps.find(r => r[0] === pid)?.[2] ?? 0;
  const walk = p => (kids.get(p) ?? []).forEach(([c, rss]) => ((total += rss), walk(c)));
  walk(pid);
  return total * 1024;
}
const du = dir => (fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).reduce((n, f) => { try { const s = fs.statSync(path.join(dir, f)); return n + (s.isFile() ? s.size : 0); } catch { return n; } }, 0) : 0);

/** Run one engine command; returns {ms, peakBytes, diskBytes}. */
function measure(bin, args, { cwd, env, temp }) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const child = spawn(bin, args, { cwd, env, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '',
      peak = 0,
      disk = 0;
    child.stderr.on('data', d => (err = (err + d).slice(-4000)));
    const timer = setInterval(() => {
      peak = Math.max(peak, tree(child.pid));
      if (temp) disk = Math.max(disk, du(temp));
    }, 50);
    child.on('close', code => {
      clearInterval(timer);
      if (temp) disk = Math.max(disk, du(temp));
      code === 0 ? resolve({ ms: Math.round(performance.now() - t0), peakBytes: peak, diskBytes: disk }) : reject(new Error(`${path.basename(bin)} exited ${code}: ${err}`));
    });
  });
}

const rows = [];
for (const root of projects) {
  for (const engine of ['scene', 'fframes']) {
    process.env.CLEARFRAME_ENGINE = engine;
    let ctx;
    try {
      ctx = await prepareProject(root, { draft: false });
    } catch (e) {
      if (/only the scene engine/.test(e.message)) {
        console.log(`${path.basename(root)}: native stages; FFFrames cannot draw it, scene engine only`);
        continue;
      }
      ctx = await prepareProject(root, { draft: true, rough: true });
    }
    await buildEngine(engine);
    const bin = engineBinary(engine);
    const env = engine === 'scene' ? sceneEnv() : nativeEnv();
    const argv = (cmd, args) => (engine === 'scene' ? sceneArgs(path.join(ctx.dir, 'plan.json'), cmd, args) : ['--job', path.join(ctx.dir, 'job.json'), '--media', ctx.media, cmd, ...args]);
    const frames = ctx.job.frames,
      fps = ctx.job.fps,
      mid = Math.floor(frames / 2);
    const tmp = path.join(OUT, 'tmp', `${path.basename(root)}-${engine}`);
    const run = async (name, cmd, args, temp) => {
      for (let r = 0; r < repeat; r++) {
        fs.rmSync(tmp, { recursive: true, force: true });
        fs.mkdirSync(tmp, { recursive: true });
        const m = await measure(bin, argv(cmd, args), { cwd: ctx.dir, env, temp: temp ? tmp : null });
        rows.push({ project: path.basename(root), engine, measure: name, run: r + 1, ...m, frames: name === 'full' ? frames : name === 'range' ? 60 : undefined, width: ctx.job.width, height: ctx.job.height, fps });
        console.log(`${path.basename(root).padEnd(22)} ${engine.padEnd(8)} ${name.padEnd(6)} run ${r + 1}: ${m.ms} ms, peak ${(m.peakBytes / 2 ** 20).toFixed(0)} MiB${temp ? `, temp ${(m.diskBytes / 2 ** 20).toFixed(1)} MiB` : ''}`);
      }
    };
    const stills = Array.from({ length: 10 }, (_, i) => Math.floor((frames * (i + 0.5)) / 10));
    await run('cold', 'frame', [String(mid), '-o', tmp]);
    await run('ten', 'frame', [stills.join(','), '-o', tmp]);
    const a = Math.max(0, mid - 30);
    await run('range', 'render', [`${a}..${a + 60}`, '--draft', '--scale', '1', '-o', path.join(tmp, 'range.mp4')], true);
    await run('full', 'render', ['-o', path.join(tmp, 'full.mp4')], true);
  }
  delete process.env.CLEARFRAME_ENGINE;
}
fs.rmSync(path.join(OUT, 'tmp'), { recursive: true, force: true });
// Warm per-still: (ten stills − one still) / 9, from the same run index.
const summary = [];
for (const p of new Set(rows.map(r => r.project)))
  for (const engine of ['scene', 'fframes']) {
    const of = m => rows.filter(r => r.project === p && r.engine === engine && r.measure === m);
    const best = m => Math.min(...of(m).map(r => r.ms));
    const full = of('full');
    if (!full.length) continue;
    summary.push({
      project: p, engine, format: `${full[0].width}x${full[0].height}@${full[0].fps}`, frames: full[0].frames,
      coldStillMs: best('cold'), warmStillMs: Math.round((best('ten') - best('cold')) / 9), rangeMs: best('range'), fullMs: best('full'),
      fullFps: +(full[0].frames / (best('full') / 1000)).toFixed(1),
      peakMiB: Math.round(Math.max(...[...of('full'), ...of('range')].map(r => r.peakBytes)) / 2 ** 20),
      tempMiB: +(Math.max(...[...of('full'), ...of('range')].map(r => r.diskBytes)) / 2 ** 20).toFixed(1),
    });
  }
fs.writeFileSync(path.join(OUT, 'bench.json'), JSON.stringify({ when: new Date().toISOString(), host: spawnSync('sysctl', ['-n', 'machdep.cpu.brand_string', 'hw.memsize'], { encoding: 'utf8' }).stdout.trim().split('\n'), repeat, rows, summary }, null, 2));
console.table(summary);
