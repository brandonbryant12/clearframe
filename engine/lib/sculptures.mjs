// Optional, offline Blender asset production. The final film still uses FFFrames.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { palette } from '../../fframes/catalog.mjs';
import { motionManifest, validateMotionContract } from './motion-phases.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const library = path.join(repo, 'library/sculptures');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const json = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
export function sculptures() {
  return fs.readdirSync(library).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort().map(f => {
    const id = path.basename(f, '.json'), entry = read(path.join(library, f));
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !entry.title || !entry.use || !entry.theme || !Number.isFinite(entry.duration) || !fs.existsSync(path.join(library, id + '.py')))
      throw new Error(`Invalid sculpture recipe ${f}`);
    palette(entry.theme);
    if (entry.motion) validateMotionContract(entry.motion, entry.loop);
    return { id, ...entry };
  });
}

export function sculptureConfig(id, options = {}) {
  const recipe = sculptures().find(r => r.id === id);
  if (!recipe) throw new Error(`Unknown sculpture ${id}. Run clearframe sculptures.`);
  if (options.phaseSeconds !== undefined && (!recipe.motion || options.duration !== undefined)) throw new Error('Phase timing needs a declared motion contract and cannot be combined with --duration.');
  const fps = options.fps ?? 24, duration = options.phaseSeconds && typeof options.phaseSeconds === 'object' && !Array.isArray(options.phaseSeconds)
    ? Object.values(options.phaseSeconds).reduce((a, b) => a + b, 0) : options.duration ?? recipe.duration, seed = options.seed ?? 17;
  if (!Number.isInteger(fps) || fps < 12 || fps > 60) throw new Error('Sculpture fps must be an integer from 12 to 60.');
  if (!Number.isFinite(duration) || duration < 1 || duration > 30) throw new Error('Sculpture duration must be 1–30 seconds.');
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 2147483647) throw new Error('Sculpture seed must be an integer from 0 to 2147483647.');
  const pos = options.pos ?? recipe.posterPos ?? 0.5;
  if (!Number.isFinite(pos) || pos < 0 || pos > 1) throw new Error('Sculpture --pos must be 0–1.');
  const width = options.draft ? 960 : 1920, height = options.draft ? 540 : 1080;
  const frames = Math.round(duration * fps);
  const motion = recipe.motion ? motionManifest(recipe.motion, { frames, fps, loop: recipe.loop, phaseSeconds: options.phaseSeconds }) : undefined;
  return { id, recipe, width: options.vertical ? height : width, height: options.vertical ? width : height,
    fps, frames, seed, theme: options.theme ?? recipe.theme, ...(motion ? { motion } : {}),
    colors: palette(options.theme ?? recipe.theme), samples: options.draft ? 16 : 48,
    pos, still: !!options.still, draft: !!options.draft, loop: !!recipe.loop };
}

function run(command, args, logFile, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const log = fs.openSync(logFile, 'w');
    const child = spawn(command, args, { cwd: repo, stdio: ['ignore', capture ? 'pipe' : log, log] });
    let stdout = '', overflow = false, spawnError;
    child.stdout?.on('data', b => {
      if (overflow) return;
      stdout += b;
      if (stdout.length > 1024 * 1024) { overflow = true; child.kill('SIGTERM'); }
    });
    const interrupt = () => child.kill('SIGINT'), terminate = () => child.kill('SIGTERM');
    process.once('SIGINT', interrupt); process.once('SIGTERM', terminate);
    const cleanup = () => { fs.closeSync(log); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate); };
    child.once('error', e => { spawnError = e; });
    // close follows error as well as exit and waits for captured streams to drain.
    child.once('close', (code, signal) => {
      cleanup();
      if (spawnError) return reject(new Error(`${command}: ${spawnError.message}`));
      if (overflow) return reject(new Error(`${command} exceeded the output limit. See ${logFile}`));
      code === 0 ? resolve(stdout) : reject(new Error(`${command} exited ${code ?? signal}. See ${logFile}`));
    });
  });
}

export async function renderSculpture(id, destination, options = {}) {
  const config = sculptureConfig(id, options);
  if (!destination) throw new Error('sculpture needs --out NEW-DIRECTORY.');
  const out = path.resolve(destination);
  if (fs.existsSync(out)) throw new Error(`Sculpture output already exists: ${out}. Keep it and choose a new directory.`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const disk = fs.statfsSync(path.dirname(out));
  if (disk.bavail * disk.bsize < 20 * 2 ** 30) throw new Error('Keep at least 20 GiB free before a Blender render.');
  fs.mkdirSync(out);
  fs.mkdirSync(path.join(out, 'frames'));
  const source = path.join(out, 'source'); fs.mkdirSync(source);
  const sourceFiles = ['scripts/blender/render.py', 'scripts/blender/artkit.py', 'scripts/blender/camera_rig.py', 'scripts/blender/chart_scene.py', `library/sculptures/${id}.py`, `library/sculptures/${id}.json`];
  const hashes = Object.fromEntries(sourceFiles.map(file => {
    fs.copyFileSync(path.join(repo, file), path.join(source, path.basename(file)));
    return [file, sha(path.join(source, path.basename(file)))];
  }));
  const configFile = path.join(out, 'render-config.json');
  const { recipe, ...values } = config;
  // Execute retained copies, so the receipt describes the exact code rendered.
  json(configFile, { ...values, out, sourceRoot: source, sceneFile: path.join(source, id + '.py') });
  const report = { version: 1, status: 'running', id, title: recipe.title, recipe, config: values,
    sourceHashes: hashes, encoding: { transfer: 'iec61966-2-1', primaries: 'bt709', matrix: 'bt709', range: 'tv', note: 'Preserve Blender display sRGB transfer; convert RGB to limited-range BT.709 YUV.' }, startedAt: new Date().toISOString(), stages: [], outputs: {} };
  const save = () => json(path.join(out, 'receipt.json'), report);
  const stage = async (name, fn) => {
    const s = { name, status: 'running' }, t = performance.now(); report.stages.push(s); save();
    try { const r = await fn(); s.status = 'passed'; return r; }
    catch (e) { s.status = 'failed'; s.error = e.message; throw e; }
    finally { s.seconds = (performance.now() - t) / 1000; save(); }
  };
  const start = performance.now(); save();
  try {
    const blender = process.env.BLENDER_BIN || 'blender';
    await stage('blender', () => run(blender, ['--background', '--factory-startup', '--disable-autoexec', '--threads', '2', '--python-exit-code', '1', '--python', path.join(source, 'render.py'), '--', '--config', configFile], path.join(out, 'blender.log')));
    report.blender = read(path.join(out, 'blender.json'));
    if (report.blender.status !== 'rendered' || report.blender.renderedFrames.length !== (config.still ? 1 : config.frames)) throw new Error('Blender did not render the requested frames.');
    const poster = path.join(out, 'poster.png');
    fs.copyFileSync(path.join(out, 'frames', `frame-${String(report.blender.posterFrame).padStart(4, '0')}.png`), poster);
    for (const name of ['scene.blend', 'poster.png']) report.outputs[name] = { file: name, sha256: sha(path.join(out, name)), bytes: fs.statSync(path.join(out, name)).size };
    if (!config.still) {
      await stage('encode', () => run('ffmpeg', ['-v', 'error', '-nostdin', '-threads', '2', '-filter_threads', '2', '-framerate', String(config.fps), '-i', path.join(out, 'frames/frame-%04d.png'), '-frames:v', String(config.frames), '-c:v', 'libx264', '-threads', '2', '-preset', config.draft ? 'veryfast' : 'medium', '-crf', config.draft ? '20' : '16', '-pix_fmt', 'yuv420p', '-vf', 'scale=in_range=full:out_range=tv:out_color_matrix=bt709', '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-colorspace', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', '-an', path.join(out, 'clip.mp4')], path.join(out, 'encode.log')));
      const probe = JSON.parse(await stage('verify', () => run('ffprobe', ['-v', 'error', '-threads', '2', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=width,height,avg_frame_rate,nb_read_frames,codec_name,color_space,color_transfer,color_primaries', '-of', 'json', path.join(out, 'clip.mp4')], path.join(out, 'probe.log'), { capture: true })));
      const s = probe.streams?.[0];
      if (!s || s.width !== config.width || s.height !== config.height || Number(s.nb_read_frames) !== config.frames || s.avg_frame_rate !== `${config.fps}/1`) throw new Error('Encoded sculpture geometry or frame count differs from the request.');
      report.probe = s;
      report.outputs['clip.mp4'] = { file: 'clip.mp4', sha256: sha(path.join(out, 'clip.mp4')), bytes: fs.statSync(path.join(out, 'clip.mp4')).size };
      json(path.join(out, 'asset.json'), { version: 1, title: recipe.title, kind: 'clip', file: 'clip.mp4', duration: config.frames / config.fps,
        width: config.width, height: config.height, fps: config.fps, loop: recipe.loop, ...(config.motion ? { motion: config.motion } : {}), provenance: 'Original procedural Blender artwork; no factual data or text baked in.', receipt: 'receipt.json' });
    }
    report.status = 'ready-for-review';
    fs.writeFileSync(path.join(out, 'README.md'), `# ${recipe.title}\n\n${recipe.description}\n\nUse: ${recipe.use}\n\n${recipe.copy}\n\n${recipe.metaphor}\n\nFiles: editable scene.blend (baked transforms; no auto-execution), poster.png, ${config.still ? 'one rendered still' : 'clip.mp4 and the PNG frame sequence'}, source scripts, render-config.json and receipt.json.\n\nThe receipt binds the exact source code, Blender version, settings and outputs. Inspect the clip, contact points and ${config.loop ? 'loop seam' : 'final settled hold'} before use.\n\nTo use in ClearFrame, copy clip.mp4 inside the film and register it as an asset with kind "clip". Place it with a video block or beat plate. Typography, figures, sources and narration remain native and editable.\n`);
    return report;
  } catch (e) { report.status = 'failed'; report.error = e.message; throw e; }
  finally { report.seconds = (performance.now() - start) / 1000; report.finishedAt = new Date().toISOString(); save(); }
}
