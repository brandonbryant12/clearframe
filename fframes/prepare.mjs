// Prepare a project for the renderer: build the job, stage media, measure voice levels and
// record the input hashes a render must match.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { eachElement, usesLevels } from './canvas.mjs';
import { createJob } from './job.mjs';
import { ROOT, sha256, rendererHash, buildNative, run } from './native-build.mjs';
import { voiceLevels } from '../engine/lib/levels.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { computeTiming, captionCues, toSRT, toVTT, assetSrc } from '../engine/lib/timing.mjs';
import { writeJSON, readJSON } from '../engine/lib/util.mjs';

export async function prepareProject(root, { draft = false } = {}) {
  root = fs.realpathSync(root);
  const sb = loadStoryboard(root),
    timing = computeTiming(root);
  const result = createJob(sb, timing, { draft });
  if (result.errors.length) throw new Error(result.errors.join('\n'));
  const timingBeat = i => timing.beats[i];
  const dir = path.join(root, 'build/native'),
    media = path.join(dir, 'media');
  fs.mkdirSync(media, { recursive: true });
  const neededMedia = new Set();
  const hashes = {};
  const record = file => {
    hashes[path.relative(root, file)] = sha256(fs.readFileSync(file));
  };
  record(path.join(root, 'storyboard.json'));
  const stage = (rel, where) => {
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file))
      throw new Error(`${where}: media must exist inside the project`);
    record(file);
    const key = `${sha256(fs.readFileSync(file)).slice(0, 16)}${path.extname(file).toLowerCase()}`;
    neededMedia.add(key);
    const out = path.join(media, key);
    if (!fs.existsSync(out)) fs.copyFileSync(file, out);
    return { file, key };
  };
  const assetFile = (ref, kind, where) => {
    if (ref.file) return ref.file;
    const a = sb.assets.find(a => a.id === ref.asset);
    if (!a) throw new Error(`${where}: unknown asset ${ref.asset}`);
    if (kind && a.kind !== kind)
      throw new Error(`${where}: asset ${a.id} is a ${a.kind}, not ${kind === 'clip' ? 'footage' : 'an image'}`);
    const rel = assetSrc(root, a);
    if (!rel) throw new Error(`${where}: asset ${a.id} is missing; import it or run images/clips.`);
    return rel;
  };
  for (const b of result.job.beats) {
    const images = [];
    eachElement(b.props.elements, el => {
      if (el.type === 'image') images.push(el);
    });
    if (b.art)
      for (const l of ['under', 'over'])
        eachElement(b.art[l], el => {
          if (el.type === 'image') images.push(el);
        });
    for (const el of images) {
      const { key } = stage(assetFile(el, 'image', `${b.id} canvas image`), b.id);
      el.file = key;
      delete el.asset;
    }
    const morphs = [];
    eachElement(b.props.elements, el => {
      if (el.morph?.from?.type === 'image') morphs.push(el.morph.from);
    });
    if (b.art)
      for (const l of ['under', 'over'])
        eachElement(b.art[l], el => {
          if (el.morph?.from?.type === 'image') morphs.push(el.morph.from);
        });
    for (const from of morphs) {
      const { key } = stage(assetFile(from, 'image', `${b.id} morph image`), b.id);
      from.file = key;
      delete from.asset;
    }
    if (b.plate) {
      const rel = assetFile(b.plate, null, `${b.id} plate`),
        video = /\.(mp4|mov|webm|m4v)$/i.test(rel);
      const { file, key } = stage(rel, `${b.id} plate`);
      b.plate.file = key;
      b.plate.video = video;
      delete b.plate.asset;
      if (video) {
        const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file], {
          encoding: 'utf8',
        });
        const duration = Number(JSON.parse(probe.stdout || '{}').format?.duration);
        if (!b.plate.loop && !(duration - (b.plate.offset ?? 0) + 1 / result.job.fps >= b.frames / result.job.fps))
          throw new Error(
            `${b.id}: plate footage is shorter than the beat; set loop, trim the beat or use a longer clip.`,
          );
      }
    }
  }
  for (const b of result.job.beats)
    if (['image', 'video', 'annotate'].includes(b.block)) {
      const prop = b.props,
        a = prop.asset && sb.assets.find(a => a.id === prop.asset);
      if (a && a.kind !== (b.block === 'video' ? 'clip' : 'image'))
        throw new Error(`${b.id}: asset kind does not match the block`);
      const rel = prop.file ?? (a && assetSrc(root, a));
      if (!rel) throw new Error(`${b.id}: asset is missing; import it or run images/clips.`);
      const file = path.resolve(root, rel);
      if (!file.startsWith(root + path.sep) || !fs.existsSync(file))
        throw new Error(`${b.id}: media must exist inside the project`);
      record(file);
      const key = `${sha256(fs.readFileSync(file)).slice(0, 16)}${path.extname(file).toLowerCase()}`;
      neededMedia.add(key);
      const out = path.join(media, key);
      if (!fs.existsSync(out)) fs.copyFileSync(file, out);
      prop.file = key;
      if (b.block === 'video') {
        const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file], {
          encoding: 'utf8',
        });
        if (probe.status !== 0) throw new Error(`Cannot probe clip ${rel}`);
        const duration = Number(JSON.parse(probe.stdout).format?.duration);
        if (!Number.isFinite(duration) || duration - (prop.offset ?? 0) + 1 / timing.fps < b.frames / timing.fps)
          throw new Error(`${b.id}: clip is shorter than the authored beat; trim the beat or provide a longer clip.`);
      }
    }
  for (const b of timing.beats)
    if (b.vo?.src) {
      record(path.join(root, b.vo.src));
      const m = path.join(root, 'assets/vo', `${b.id}.json`);
      if (fs.existsSync(m)) record(m);
    }
  // Voice levels for speaker tags, meters and level loops, from the exact recordings the mix uses.
  for (const [i, jb] of result.job.beats.entries()) {
    const tb = timingBeat(i);
    if (!tb?.vo?.src) continue;
    if (!(jb.speaker || usesLevels(jb.props.elements) || usesLevels(jb.art?.under) || usesLevels(jb.art?.over)))
      continue;
    jb.levels = voiceLevels(path.join(root, tb.vo.src), {
      fps: result.job.fps,
      frames: jb.frames,
      offset: tb.vo.start - jb.start_frame / result.job.fps,
    });
  }
  if (timing.music?.src) record(path.join(root, timing.music.src));
  for (const f of fs.readdirSync(path.join(ROOT, 'assets/fonts')).filter(f => /\.ttf$/i.test(f))) {
    neededMedia.add(f);
    fs.copyFileSync(path.join(ROOT, 'assets/fonts', f), path.join(media, f));
  }
  for (const f of fs.readdirSync(media))
    if (!neededMedia.has(f) && fs.statSync(path.join(media, f)).isFile()) fs.unlinkSync(path.join(media, f));
  writeJSON(path.join(dir, 'job.json'), result.job);
  writeJSON(path.join(root, 'build/timing.json'), timing);
  fs.writeFileSync(path.join(root, 'build/captions.srt'), toSRT(captionCues(timing)));
  fs.writeFileSync(path.join(root, 'build/captions.vtt'), toVTT(captionCues(timing)));
  const fontHashes = Object.fromEntries(
    fs
      .readdirSync(path.join(ROOT, 'assets/fonts'))
      .filter(f => /\.ttf$/i.test(f))
      .map(f => [f, sha256(fs.readFileSync(path.join(ROOT, 'assets/fonts', f)))]),
  );
  const rendererSourceHash = rendererHash();
  const manifest = {
    version: 2,
    renderer: 'fframes',
    rendererSourceHash,
    fontHashes,
    revision: readJSON(path.join(ROOT, 'upstream.json')).revision,
    hashes,
    inputId: sha256(JSON.stringify({ job: result.job, hashes, rendererSourceHash, fontHashes })),
    draft,
    warnings: result.warnings,
  };
  writeJSON(path.join(dir, 'manifest.json'), manifest);
  return { ...result, root, sb, timing, dir, media, manifest };
}
export function unchanged(ctx) {
  if (rendererHash() !== ctx.manifest.rendererSourceHash)
    throw new Error('Renderer source changed during the render; run again.');
  for (const [file, hash] of Object.entries(ctx.manifest.fontHashes))
    if (sha256(fs.readFileSync(path.join(ROOT, 'assets/fonts', file))) !== hash)
      throw new Error('Font changed during the render; run again.');
  for (const [file, hash] of Object.entries(ctx.manifest.hashes))
    if (sha256(fs.readFileSync(path.join(ctx.root, file))) !== hash)
      throw new Error(`Input changed during render: ${file}. Run again.`);
}
export async function nativeCommand(ctx, command, args = [], capture = false) {
  const bin = await buildNative();
  return run(bin, ['--job', path.join(ctx.dir, 'job.json'), '--media', ctx.media, command, ...args], {
    capture,
    cwd: ctx.dir,
  });
}
export async function checkProject(root, options = {}) {
  let ctx;
  try {
    ctx = await prepareProject(root, options);
  } catch (e) {
    return { errors: [e.message], warnings: [], notes: [] };
  }
  const errors = [],
    notes = [];
  try {
    notes.push(withoutCameraCuts(await nativeCommand(ctx, 'inspect', ['--fail-on', 'error'], true), ctx.job));
  } catch (e) {
    errors.push(e.message);
  }
  return { errors, warnings: ctx.warnings, notes, duration: ctx.timing.duration, inputId: ctx.manifest.inputId };
}

/** Drop "cut off by the canvas edge" notes inside moves that carry type past the edge on
 * purpose: a world camera travelling, and push/whip/zoom entrances and exits. */
function withoutCameraCuts(report, job) {
  const moving = ['push', 'whip', 'zoom'],
    edge = Math.ceil(0.8 * job.fps);
  const moves = job.beats.flatMap(b => {
    const out = [];
    // A camera rect frames part of a larger drawing; cropping what lies outside is the point.
    // job.mjs checks the beat's own text against its view instead.
    if (b.block === 'canvas' && b.props.view?.length === 4) out.push([b.start_frame, b.start_frame + b.frames]);
    if (moving.includes(b.transition)) out.push([b.start_frame, b.start_frame + edge]);
    if (moving.includes(b.exit)) out.push([b.start_frame + b.frames - edge, b.start_frame + b.frames]);
    return out;
  });
  return String(report)
    .split('\n')
    .filter(line => {
      const m = / \(frames (\d+)\.\.(\d+),.*cut off by the canvas edge/.exec(line);
      // The renderer merges one text's sightings across beats; judge the range by its ends.
      const inside = f => moves.some(([a, b]) => f >= a && f <= b);
      return !m || !(inside(+m[1]) && inside(+m[2]));
    })
    .join('\n');
}
