// Building and locating the native renderer.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeJSON, readJSON, log } from '../engine/lib/util.mjs';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.dirname(ROOT);
export const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
// Incremental release builds apply only to local crates (Cargo never rebuilds registry/git
// dependencies for it), so edits to the renderer recompile only what changed.
export const nativeEnv = () => ({
  ...process.env,
  PATH: [path.join(ROOT, 'tools'), path.join(os.homedir(), '.cargo/bin'), process.env.PATH].join(path.delimiter),
  CARGO_TARGET_DIR: path.join(ROOT, '.cache/metal'),
  CARGO_BUILD_JOBS: '1',
  CARGO_PROFILE_RELEASE_INCREMENTAL: 'true',
  SKIA_NINJA_COMMAND: path.join(ROOT, 'tools/ninja-limited'),
  RAYON_NUM_THREADS: '2',
  FFRAMES_NUM_THREADS: '2',
  CMAKE_BUILD_PARALLEL_LEVEL: '2',
  NUM_JOBS: '2',
});
export const binary = () => path.join(ROOT, '.cache/metal/release/clearframe-native');

export function run(bin, args, { cwd = REPO, env = nativeEnv(), capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, env, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
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
      code === 0
        ? resolve(output)
        : reject(new Error(`${path.basename(bin)} exited ${code}${output ? '\n' + output.slice(-6000) : ''}`));
    });
  });
}
const walk = dir =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
function rendererSources() {
  const crate = path.join(ROOT, 'native');
  return [
    ...walk(path.join(crate, 'src')),
    ...(fs.existsSync(path.join(crate, 'vendor')) ? walk(path.join(crate, 'vendor')) : []),
    path.join(crate, 'Cargo.toml'),
    path.join(crate, 'Cargo.lock'),
    path.join(ROOT, 'constants.json'),
  ].sort();
}
export function rendererHash() {
  const crate = path.join(ROOT, 'native'),
    src = rendererSources();
  return sha256(
    Buffer.concat(src.map(f => Buffer.concat([Buffer.from(path.relative(crate, f) + '\0'), fs.readFileSync(f)]))),
  );
}
export async function buildNative({ force = false } = {}) {
  const crate = path.join(ROOT, 'native'),
    hash = rendererHash();
  const marker = path.join(ROOT, '.cache/native-build.json');
  if (!force && fs.existsSync(binary()) && readJSON(marker, null)?.hash === hash) return binary();
  const st = fs.statfsSync(ROOT),
    free = (st.bavail * st.bsize) / 2 ** 30;
  const warm = fs.existsSync(path.join(ROOT, '.cache/metal/release/deps'));
  if (free < (warm ? 10 : 25))
    throw new Error(`Native build needs ${warm ? 10 : 25} GiB free; ${free.toFixed(1)} GiB available.`);
  log.step(`Building FFFrames ${warm ? 'with the existing dependency cache' : 'from a cold cache'} (one Cargo job)`);
  // Only compilation takes the machine-wide heavy-job lock; renders and checks run freely.
  const gate = path.join(os.homedir(), '.local/bin/codex-heavy'),
    cargo = [
      'build',
      '--manifest-path',
      path.join(crate, 'Cargo.toml'),
      '--release',
      '--locked',
      '--jobs',
      '1',
      ...(process.platform === 'darwin' ? [] : ['--no-default-features']),
    ];
  if (fs.existsSync(gate) && process.env.CLEARFRAME_HEAVY_HELD !== '1') {
    const holder = lockHolder();
    if (holder) log.warn(`Heavy-job lock is held by ${holder}; the build starts when it finishes.`);
    await run(gate, ['--', 'cargo', ...cargo]);
  } else await run('cargo', cargo);
  // The build may have waited a long time for the lock while sources changed; cargo
  // compiles what is on disk when it starts. If every source is older than the new binary,
  // the binary is current: record today's hash so the next render does not rebuild.
  const built = fs.statSync(binary()).mtimeMs;
  const current = rendererSources().every(f => fs.statSync(f).mtimeMs <= built);
  writeJSON(marker, {
    hash: current ? rendererHash() : hash,
    backend: process.platform === 'darwin' ? 'skia-metal' : 'cpu',
    revision: readJSON(path.join(ROOT, 'upstream.json')).revision,
  });
  return binary();
}

export function doctor() {
  const env = nativeEnv(),
    rows = [];
  for (const [name, bin, args] of [
    ['Rust', 'rustc', ['--version']],
    ['Cargo', 'cargo', ['--version']],
    ['FFmpeg', 'ffmpeg', ['-version']],
    ['ffprobe', 'ffprobe', ['-version']],
    ['NASM', 'nasm', ['-v']],
    ['Ninja', 'ninja', ['--version']],
    ['Codecs', 'pkg-config', ['--modversion', 'x264', 'x265', 'opus']],
  ]) {
    const r = spawnSync(bin, args, { encoding: 'utf8', env });
    rows.push({
      name,
      ok: r.status === 0,
      detail: (r.stdout || r.stderr || r.error?.message || '').trim().split('\n')[0],
    });
  }
  const s = fs.statfsSync(ROOT),
    free = (s.bavail * s.bsize) / 2 ** 30,
    warm = fs.existsSync(path.join(ROOT, '.cache/metal/release/deps'));
  rows.push({
    name: 'Disk headroom',
    ok: free >= (warm ? 10 : 25),
    detail: `${free.toFixed(1)} GiB free (${warm ? 'warm cache' : 'cold build'})`,
  });
  return rows;
}

/** Who holds the machine-wide heavy-job lock, if its recorded owner is still running. */
function lockHolder() {
  try {
    const pid = Number(fs.readFileSync(`/private/tmp/codex-heavy-${os.userInfo().uid}.lock`, 'utf8').trim());
    if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return null;
    const ps = spawnSync('ps', ['-o', 'etime=,command=', '-p', String(pid)], { encoding: 'utf8' }).stdout.trim();
    if (!ps.includes('codex-heavy')) return null;
    const [elapsed, ...command] = ps.split(/\s+/);
    const job = command
      .slice(command.indexOf('--') + 1)
      .join(' ')
      .slice(0, 90);
    return `PID ${pid} for ${elapsed} (${job})`;
  } catch {
    return null;
  }
}
