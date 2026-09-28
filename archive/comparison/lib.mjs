import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import os from 'node:os';
import { computeTiming, findWord, captionCues, toSRT, toVTT } from '../engine/lib/timing.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { mix, mux } from '../engine/lib/audio.mjs';
import { writeJSON } from '../engine/lib/util.mjs';

export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const ignored = new Set(['.git', 'node_modules', 'build', 'target', '.cache', '.DS_Store']);

export function files(root, prefix = '') {
  return fs.readdirSync(path.join(root, prefix), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap((entry) => {
    if (ignored.has(entry.name) || entry.name === '.env' || entry.name.startsWith('.env.')) return [];
    const rel = path.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Use regular files in a frozen project: ${rel}`);
    return entry.isDirectory() ? files(root, rel) : [rel];
  });
}

export function nativeJob(timing, spec, sb, { allowEstimated = false } = {}) {
  if (timing.estimated && !allowEstimated) throw new Error('Record voice --draft first; --allow-estimated is only for layout sketches.');
  if (timing.width / timing.height !== 16 / 9 || !Number.isInteger(timing.fps) || timing.fps < 1 || timing.fps > 60
      || !Number.isInteger(timing.width) || !Number.isInteger(timing.height) || timing.width <= 0 || timing.height <= 0
      || timing.width % 2 || timing.height % 2 || !Number.isInteger(timing.frames) || timing.frames <= 0) {
    throw new Error('The starter supports even-sized 16:9 canvases and integer 1–60 fps. Author/review a new layout for other formats.');
  }
  if (sb.sfx || timing.beats.some((b) => b.sfx?.length) || sb.assets.length) {
    throw new Error('The starter does not port automatic SFX or image/video placements. Add native support before comparing those projects.');
  }
  if ((sb.captions && sb.captions !== 'off') || (sb.pacing.outro ?? 0) !== 0) {
    throw new Error('The starter exports sidecar captions; burned captions and extra outro time need an authored native implementation.');
  }
  if (spec.version !== 1 || !spec.beats || Object.keys(spec.beats).length !== timing.beats.length) {
    throw new Error('fframes.json version 1 must map every beat exactly once.');
  }
  const text = (value, field, max) => {
    if (typeof value !== 'string' || value.length > max || /[\r\n]/.test(value)) throw new Error(`${field}: expected a single line of at most ${max} characters`);
    return value;
  };
  const beats = timing.beats.map((b) => {
    const v = spec.beats[b.id];
    if (!v || !['statement', 'bars'].includes(v.layout)) throw new Error(`Beat ${b.id} needs an explicit statement/bars layout in fframes.json; JS blocks are not auto-ported.`);
    const known = new Set(['layout', 'headline', 'support', 'source', 'cue', 'rows', 'max']);
    for (const key of Object.keys(v)) if (!known.has(key)) throw new Error(`${b.id}: unsupported native field ${key}`);
    let cue = b.start;
    if (v.cue) {
      cue = findWord(b.vo?.words ?? [], v.cue);
      if (cue === null) throw new Error(`${b.id}: spoken cue "${v.cue}" does not exist`);
    }
    if (cue < b.start || cue >= b.end || (b.vo && (b.vo.start < b.start || b.vo.end > b.end + 1 / timing.fps))) {
      throw new Error(`${b.id}: voice/cue crosses the scene bounds; revise timing or author overlap support.`);
    }
    const rows = v.rows ?? [];
    if (!Array.isArray(rows) || (v.layout === 'bars' ? rows.length < 1 || rows.length > 3 : rows.length !== 0)) throw new Error(`${b.id}: bars requires 1–3 rows; statement has none`);
    const max = v.max ?? 1;
    if (!Number.isFinite(max) || max <= 0) throw new Error(`${b.id}: max must be positive`);
    for (const row of rows) {
      for (const key of Object.keys(row)) if (!['label', 'value'].includes(key)) throw new Error(`${b.id}: unsupported row field ${key}`);
      text(row.label, `${b.id}.label`, 15);
      if (!Number.isFinite(row.value) || row.value < 0 || row.value > max) throw new Error(`${b.id}: bar values must lie on the zero-based scale 0..max`);
    }
    const source = text(v.source ?? '', `${b.id}.source`, 85);
    if (rows.length && (!source || !sb.sources.length)) throw new Error(`${b.id}: charts need both an on-screen source and storyboard.sources`);
    return {
      id: b.id, frames: Math.round(b.end * timing.fps) - Math.round(b.start * timing.fps),
      layout: v.layout, headline: text(v.headline, `${b.id}.headline`, 38),
      support: text(v.support ?? '', `${b.id}.support`, 70), source,
      cue_seconds: Math.max(0, cue - b.start - 0.15), rows, max,
    };
  });
  if (beats.some((b) => b.frames <= 0) || beats.reduce((n, b) => n + b.frames, 0) !== timing.frames) throw new Error('Frame boundaries do not cover the whole film.');
  return { version: 1, width: timing.width, height: timing.height, fps: timing.fps, frames: timing.frames, estimated: timing.estimated, beats };
}

export async function prepare(source, destination, options = {}) {
  source = fs.realpathSync(source);
  destination = path.resolve(destination);
  if (destination === source || destination.startsWith(source + path.sep)) throw new Error('Put the comparison bundle outside the source project.');
  if (fs.existsSync(destination)) throw new Error('Use a new destination for each frozen comparison; existing files are never overwritten.');
  // Validate before writing anything, then validate the frozen copy again.
  nativeJob(computeTiming(source), read(path.join(source, 'fframes.json')), loadStoryboard(source), options);
  fs.mkdirSync(destination, { recursive: true });
  try {
    const browser = path.join(destination, 'browser');
    for (const rel of files(source)) {
      const target = path.join(browser, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(source, rel), target);
    }
    const timing = computeTiming(browser), sb = loadStoryboard(browser);
    const job = nativeJob(timing, read(path.join(browser, 'fframes.json')), sb, options);
    const native = path.join(destination, 'native');
    fs.cpSync(path.join(ROOT, 'template'), native, { recursive: true });
    writeJSON(path.join(native, 'job.json'), job);
    fs.writeFileSync(path.join(native, 'src/settings.rs'), `pub const WIDTH: usize = ${job.width};\npub const HEIGHT: usize = ${job.height};\npub const FPS: usize = ${job.fps};\n`);
    fs.mkdirSync(path.join(native, 'media'), { recursive: true });
    // Exact same font bytes in Chrome and the native renderer; never system fallback.
    const font = path.join(browser, 'assets/fonts/Inter.ttf');
    if (!fs.existsSync(font)) throw new Error('Add assets/fonts/Inter.ttf with its license (copy the paired example font).');
    fs.copyFileSync(font, path.join(native, 'media/Inter.ttf'));
    const inputs = path.join(destination, 'inputs');
    writeJSON(path.join(inputs, 'timing.json'), timing);
    const cues = captionCues(timing);
    fs.writeFileSync(path.join(inputs, 'captions.srt'), toSRT(cues));
    fs.writeFileSync(path.join(inputs, 'captions.vtt'), toVTT(cues));
    const audio = await mix(browser, timing, path.join(inputs, 'mix.wav'), sb.mix);
    const tracked = [
      ...files(browser).map((p) => `browser/${p}`),
      ...files(inputs).map((p) => `inputs/${p}`),
      'native/job.json', 'native/media/Inter.ttf',
    ];
    const hashes = Object.fromEntries(tracked.sort().map((p) => [p, sha256(fs.readFileSync(path.join(destination, p)))]));
    const manifest = { version: 1, source, createdAt: new Date().toISOString(), upstream: read(path.join(ROOT, 'upstream.json')),
      inputId: sha256(JSON.stringify(hashes)), hashes, audio: audio ? 'inputs/mix.wav' : null,
      width: job.width, height: job.height, fps: job.fps, frames: job.frames, estimated: job.estimated,
      voiceProviders: [...new Set(timing.beats.map((b) => b.vo?.provider).filter(Boolean))],
    };
    writeJSON(path.join(destination, 'manifest.json'), manifest);
    return manifest;
  } catch (e) {
    // Only this newly created destination is ours; preserve partial output for diagnosis.
    fs.writeFileSync(path.join(destination, 'PREPARE-FAILED.txt'), `${e.message}\nUse a fresh destination after fixing the source.\n`);
    throw e;
  }
}

export function verifyBundle(bundle) {
  const manifest = read(path.join(bundle, 'manifest.json'));
  if (sha256(JSON.stringify(manifest.hashes)) !== manifest.inputId) throw new Error('Manifest input ID does not match its file hashes.');
  for (const [rel, hash] of Object.entries(manifest.hashes)) {
    const file = path.resolve(bundle, rel);
    if (!file.startsWith(path.resolve(bundle) + path.sep) || sha256(fs.readFileSync(file)) !== hash) throw new Error(`Frozen input changed: ${rel}`);
  }
  return manifest;
}

export function validateProbe(probe, m) {
  if (probe.streams.some((s) => s.codec_type === 'audio') || probe.streams.filter((s) => s.codec_type === 'video').length !== 1) {
    throw new Error('Finish requires one video stream and no audio: use JS --no-audio, or remove FFFrames\' silent AAC with ffmpeg -map 0:v:0 -c:v copy -an (see SETUP.md).');
  }
  const v = probe.streams.find((s) => s.codec_type === 'video');
  const [n, d] = (v?.avg_frame_rate ?? '0/1').split('/').map(Number);
  if (!v || v.width !== m.width || v.height !== m.height || Math.abs(n / d - m.fps) > 0.001
      || Number(v.nb_read_frames ?? v.nb_frames) !== m.frames) throw new Error('Rendered video dimensions, fps, or decoded frame count differ from the frozen job.');
  return v;
}

export async function finish(bundle, video, output) {
  const m = verifyBundle(bundle);
  video = path.resolve(video); output = path.resolve(output);
  if (fs.existsSync(output)) throw new Error(`Output already exists: ${output}`);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-of', 'json', video], { encoding: 'utf8' });
  if (probe.status !== 0) throw new Error(probe.stderr || 'ffprobe failed');
  const v = validateProbe(JSON.parse(probe.stdout), m);
  await mux(video, m.audio && path.join(bundle, m.audio), output);
  writeJSON(`${output}.json`, { inputId: m.inputId, videoSha256: sha256(fs.readFileSync(video)), outputSha256: sha256(fs.readFileSync(output)),
    mixSha256: m.audio ? m.hashes[m.audio] : null, codec: v.codec_name, pixelFormat: v.pix_fmt,
    color: { space: v.color_space ?? null, primaries: v.color_primaries ?? null, transfer: v.color_transfer ?? null },
    frames: m.frames, fps: m.fps, width: m.width, height: m.height });
}

export async function measure({ bundle, renderer, phase, output, command, cwd = process.cwd() }) {
  const m = verifyBundle(bundle);
  if (!['javascript', 'fframes-metal', 'fframes-cpu'].includes(renderer)) throw new Error('Choose javascript, fframes-metal, or fframes-cpu explicitly.');
  if (!['cold-build', 'warm-build', 'render', 'review', 'mux'].includes(phase) || !command.length) throw new Error('Choose a measurement phase and a command after --.');
  if (fs.existsSync(output) || fs.existsSync(`${output}.log`)) throw new Error('Measurement already exists; use a new name.');
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  const fd = fs.openSync(`${output}.log`, 'wx');
  const env = { ...process.env, CARGO_BUILD_JOBS: '1', RAYON_NUM_THREADS: '2', FFRAMES_NUM_THREADS: '2', CMAKE_BUILD_PARALLEL_LEVEL: '2', NUM_JOBS: '2' };
  delete env.GEMINI_API_KEY;
  const started = performance.now();
  let error = null;
  const child = spawn(command[0], command.slice(1), { cwd, env, stdio: ['ignore', fd, fd] });
  const interrupt = () => child.kill('SIGINT');
  const terminate = () => child.kill('SIGTERM');
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', terminate);
  const result = await new Promise((resolve) => {
    child.on('error', (e) => { error = e.message; });
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
  process.removeListener('SIGINT', interrupt);
  process.removeListener('SIGTERM', terminate);
  fs.closeSync(fd);
  const seconds = (performance.now() - started) / 1000;
  let inputError = null;
  try { verifyBundle(bundle); } catch (e) { inputError = e.message; }
  const sourceHashes = Object.fromEntries(files(path.join(bundle, 'native')).filter((p) => /\.(rs|toml)$|Cargo.lock$/.test(p)).map((p) => [p, sha256(fs.readFileSync(path.join(bundle, 'native', p)))]));
  const version = (bin, args) => spawnSync(bin, args, { encoding: 'utf8' }).stdout?.trim().split('\n')[0] ?? null;
  const report = { version: 1, inputId: m.inputId, renderer, phase, command, cwd, seconds, ...result, error, inputError,
    success: result.code === 0 && !error && !inputError, createdAt: new Date().toISOString(), sourceHashes,
    host: { platform: os.platform(), arch: os.arch(), release: os.release(), memoryGB: os.totalmem() / 2 ** 30, cpu: os.cpus()[0]?.model },
    tools: { node: process.version, rust: version('rustc', ['--version']), cargo: version('cargo', ['--version']), ffmpeg: version('ffmpeg', ['-version']) },
    // Wall time is for the child command only, not waiting for codex-heavy.
    framesPerSecond: phase === 'render' && result.code === 0 ? m.frames / seconds : null,
  };
  writeJSON(output, report);
  return report;
}

export function doctor() {
  const rows = [];
  const check = (name, bin, args, predicate = () => true) => {
    const r = spawnSync(bin, args, { encoding: 'utf8' });
    const value = (r.stdout || r.stderr || r.error?.message || '').trim().split('\n')[0];
    rows.push({ name, ok: r.status === 0 && predicate(value), detail: value });
  };
  check('Rust (project floor 1.88; stable recommended)', 'rustc', ['--version'], (s) => {
    const match = s.match(/rustc (\d+)\.(\d+)/); return match && (+match[1] > 1 || +match[2] >= 88);
  });
  check('Cargo', 'cargo', ['--version']);
  check('ffmpeg', 'ffmpeg', ['-version']); check('ffprobe', 'ffprobe', ['-version']);
  check('pkg-config', 'pkg-config', ['--version']); check('nasm', 'nasm', ['-v']); check('ninja', 'ninja', ['--version']);
  check('x264 / x265 / opus', 'pkg-config', ['--modversion', 'x264', 'x265', 'opus']);
  if (process.platform === 'darwin') check('Xcode command-line tools', 'xcrun', ['--find', 'clang']);
  const st = fs.statfsSync(ROOT), freeGiB = st.bavail * st.bsize / 2 ** 30;
  rows.push({ name: 'Native build disk headroom', ok: freeGiB >= 30, detail: `${freeGiB.toFixed(1)} GiB free; start a cold build at 30+ GiB and retain at least 20 GiB` });
  return rows;
}
