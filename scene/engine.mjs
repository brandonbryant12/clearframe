// The renderer: `scene/native` (Skia on Metal) draws every film from the prepared job and its
// compiled scene plan (build/native/plan.json). This module builds it when its sources change,
// runs its commands (render [A..B], frame LIST, inspect, audit) and reports its identity.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readJSON, writeJSON, log } from '../engine/lib/util.mjs';

export const SCENE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.dirname(SCENE);
/** The film pipeline (job, prepare, render) and its bundled assets. */
export const FILM = path.join(REPO, 'film');
export const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

const CRATE = path.join(SCENE, 'native');
const TARGET = () => path.join(SCENE, '.cache/target');
export const sceneBinary = () => path.join(TARGET(), 'release/clearframe-scene');

/** Build environment: one Cargo job, at most two worker threads anywhere in the build. */
export const sceneEnv = () => ({
  ...process.env,
  PATH: [path.join(os.homedir(), '.cargo/bin'), process.env.PATH].join(path.delimiter),
  CARGO_TARGET_DIR: TARGET(),
  CARGO_BUILD_JOBS: '1',
  // Incremental release builds apply only to local crates, so an edit recompiles only it.
  CARGO_PROFILE_RELEASE_INCREMENTAL: 'true',
  // Used only if rust-skia has no prebuilt binary and compiles Skia: two ninja jobs.
  SKIA_NINJA_COMMAND: path.join(SCENE, 'tools/ninja-limited'),
  RAYON_NUM_THREADS: '2',
  CMAKE_BUILD_PARALLEL_LEVEL: '2',
  NUM_JOBS: '2',
});

export function run(bin, args, { cwd = REPO, env = sceneEnv(), capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd,
      env,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : process.env.CLEARFRAME_PROGRESS_STDERR === '1' ? ['inherit', 2, 2] : 'inherit',
    });
    let output = '';
    if (capture) {
      child.stdout.on('data', d => (output += d));
      child.stderr.on('data', d => (output += d));
    }
    const stop = s => child.kill(s);
    const interrupt = () => stop('SIGINT'),
      terminate = () => stop('SIGTERM');
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', terminate);
    child.on('error', reject);
    child.on('close', code => {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', terminate);
      code === 0 ? resolve(output) : reject(new Error(`${path.basename(bin)} exited ${code}${output ? '\n' + output.slice(-6000) : ''}`));
    });
  });
}

const walk = dir =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
    : [];
/** Everything compiled into the renderer: its sources, manifest, lockfile and the shared timing constants. */
function sceneSources() {
  return [...walk(path.join(CRATE, 'src')), path.join(CRATE, 'Cargo.toml'), path.join(CRATE, 'Cargo.lock'), path.join(FILM, 'constants.json')].sort();
}
/** The renderer's identity, recorded in manifests, receipts and revisions. */
export function sceneHash() {
  return sha256(Buffer.concat(sceneSources().map(f => Buffer.concat([Buffer.from(path.relative(REPO, f) + '\0'), fs.readFileSync(f)]))));
}

/** Who holds the machine-wide heavy-job lock, if its recorded owner is still running. */
function lockHolder() {
  try {
    const pid = Number(fs.readFileSync(`/private/tmp/codex-heavy-${os.userInfo().uid}.lock`, 'utf8').trim());
    if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return null;
    const ps = spawnSync('ps', ['-o', 'etime=,command=', '-p', String(pid)], { encoding: 'utf8' }).stdout.trim();
    if (!ps.includes('codex-heavy')) return null;
    const [elapsed, ...command] = ps.split(/\s+/);
    return `PID ${pid} for ${elapsed} (${command.slice(command.indexOf('--') + 1).join(' ').slice(0, 90)})`;
  } catch {
    return null;
  }
}

/** Build the renderer when its sources changed. One Cargo job; compilation takes the heavy-job gate. */
export async function buildScene({ force = false } = {}) {
  const hash = sceneHash();
  const marker = path.join(SCENE, '.cache/build.json');
  if (!force && fs.existsSync(sceneBinary()) && readJSON(marker, null)?.hash === hash) return sceneBinary();
  const st = fs.statfsSync(SCENE),
    free = (st.bavail * st.bsize) / 2 ** 30;
  const warm = fs.existsSync(path.join(TARGET(), 'release/deps'));
  if (free < (warm ? 10 : 25)) throw new Error(`The renderer build needs ${warm ? 10 : 25} GiB free; ${free.toFixed(1)} GiB available.`);
  log.step(`Building the renderer ${warm ? 'with the existing dependency cache' : 'from a cold cache'} (one Cargo job)`);
  const gate = path.join(os.homedir(), '.local/bin/codex-heavy');
  const cargo = ['build', '--manifest-path', path.join(CRATE, 'Cargo.toml'), '--release', '--locked', '--jobs', '1'];
  if (fs.existsSync(gate) && process.env.CLEARFRAME_HEAVY_HELD !== '1') {
    const holder = lockHolder();
    if (holder) log.warn(`Heavy-job lock is held by ${holder}; the build starts when it finishes.`);
    await run(gate, ['--', 'cargo', ...cargo]);
  } else await run('cargo', cargo);
  // The build may have waited for the lock while sources changed; cargo compiles what is on
  // disk when it starts. If every source is older than the binary, the binary is current.
  const built = fs.statSync(sceneBinary()).mtimeMs;
  const current = sceneSources().every(f => fs.statSync(f).mtimeMs <= built);
  writeJSON(marker, { hash: current ? sceneHash() : hash, backend: backend() });
  return sceneBinary();
}

/**
 * Run a renderer command on a prepared project: `render [A..B] [--draft] [--scale S] -o OUT`,
 * `frame LIST -o DIR`, `inspect --fail-on error`, `--audit FILE`.
 */
export async function engineCommand(ctx, command, args = [], capture = false) {
  const bin = await buildScene();
  return run(bin, sceneArgs(path.join(ctx.dir, 'plan.json'), command, args), { capture, cwd: ctx.dir });
}

/** Command words → renderer arguments (`--draft`/`--scale` become globals). */
export function sceneArgs(plan, command, args = []) {
  const flags = [],
    rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--draft') flags.push('--draft');
    else if (args[i] === '--scale') flags.push('--scale', args[++i]);
    else rest.push(args[i]);
  }
  return ['--plan', plan, ...flags, ...(command === '--audit' ? ['audit', ...rest] : [command, ...rest])];
}

export const backend = () => (process.platform === 'darwin' ? 'skia-metal' : 'skia-raster');

/** Tools the renderer and the film pipeline need, and the disk headroom for a build. */
export function doctor() {
  const env = sceneEnv(),
    rows = [];
  for (const [name, bin, args] of [
    ['Rust', 'rustc', ['--version']],
    ['Cargo', 'cargo', ['--version']],
    ['FFmpeg', 'ffmpeg', ['-version']],
    ['ffprobe', 'ffprobe', ['-version']],
  ]) {
    const r = spawnSync(bin, args, { encoding: 'utf8', env });
    rows.push({ name, ok: r.status === 0, detail: (r.stdout || r.stderr || r.error?.message || '').trim().split('\n')[0] });
  }
  const encoders = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8', env }).stdout || '';
  rows.push({ name: 'H.264 encoder', ok: /\blibx264\b/.test(encoders), detail: /\blibx264\b/.test(encoders) ? 'libx264' : 'ffmpeg has no libx264' });
  const s = fs.statfsSync(SCENE),
    free = (s.bavail * s.bsize) / 2 ** 30,
    warm = fs.existsSync(path.join(TARGET(), 'release/deps'));
  rows.push({ name: 'Disk headroom', ok: free >= (warm ? 10 : 25), detail: `${free.toFixed(1)} GiB free (${warm ? 'warm cache' : 'cold build'})` });
  return rows;
}
