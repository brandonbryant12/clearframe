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
import { phase } from '../engine/lib/runlog.mjs';

/**
 * Rough cuts stand in for what isn't made yet: a beat that declares `placeholder` (or uses a
 * generated asset nobody has paid for) becomes a labelled slate over its own words, on its own
 * clock. Nothing else is relaxed here; outside --rough a declared placeholder is an error.
 */
export function roughStandIns(root, sb, timing, { rough = false } = {}) {
  const placeholders = [];
  const missing = b => {
    const ids = new Set();
    const walk = v => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object')
        for (const [k, x] of Object.entries(v)) {
          if (k === 'asset' && typeof x === 'string') ids.add(x);
          else if (k === 'plates' && typeof x === 'string') ['far', 'mid', 'near'].forEach(l => ids.add(`${x}-${l}`));
          else walk(x);
        }
    };
    walk([b.props, b.art, b.plate]);
    return [...ids].filter(id => {
      const a = sb.assets.find(a => a.id === id);
      return a && !a.file && a.prompt && !assetSrc(root, a);
    });
  };
  const beats = sb.beats.map((b, i) => {
    const declared = typeof b.placeholder === 'string' ? b.placeholder : b.placeholder?.text;
    if (b.placeholder != null && !(typeof declared === 'string' && declared.trim() && declared.length <= 140))
      throw new Error(`${b.id}: placeholder must be a description up to 140 characters (or {text}).`);
    const pending = missing(b);
    if (!declared && !pending.length) return b;
    if (!rough)
      throw new Error(
        declared
          ? `${b.id} is a declared placeholder (“${declared}”); author it, or render a rough cut with --rough.`
          : `${b.id}: generated asset ${pending.join(', ')} is not made yet; run images/clips within the budget, or render a rough cut with --rough.`,
      );
    const what = declared ?? `generated ${pending.join(', ')} not made yet`;
    placeholders.push({ beat: b.id, reason: what, declared: !!declared, ...(pending.length ? { assets: pending } : {}) });
    const tb = timing.beats[i],
      W = timing.width,
      H = timing.height,
      m = Math.round(Math.min(W, H) * 0.035);
    // A dashed frame and a label inside the title-safe area, in the second accent: unmistakably
    // a stand-in, never mistaken for design.
    const label = `PLACEHOLDER · ${what}`.slice(0, 72);
    const slate = {
      over: [
        { type: 'rect', x: m, y: m, w: W - 2 * m, h: H - 2 * m, r: 18, fill: 'none', stroke: 'accent2', width: 3, dash: [16, 12], opacity: 0.8, enter: 'none' },
        { type: 'text', text: label, x: Math.round(W * 0.06), y: Math.round(H * 0.06) + 36, size: 34, font: 'mono', fill: 'accent2', anchor: 'start', fit: Math.round(W * 0.88), enter: 'none' },
      ],
    };
    const spoken = tb.vo?.words?.length > 0;
    const stand = spoken
      ? { block: 'kinetic', props: { mode: 'highlight', align: 'center', maxWords: H > W ? 5 : 8 } }
      : { block: 'statement', props: { kicker: 'Placeholder', text: what.slice(0, 90) } };
    const keep = ['id', 'vo', 'speaker', 'chapter', 'transition', 'exit', 'motion', 'duration', 'lead', 'tail', 'hold', 'min'];
    timing.beats[i] = { ...tb, ...stand };
    return { ...Object.fromEntries(keep.filter(k => b[k] !== undefined).map(k => [k, b[k]])), ...stand, art: slate };
  });
  return { sb: { ...sb, beats }, timing, placeholders };
}

export async function prepareProject(root, { draft = false, rough = false } = {}) {
  root = fs.realpathSync(root);
  const loaded = loadStoryboard(root),
    computed = computeTiming(root);
  const { sb, timing, placeholders } = roughStandIns(root, loaded, computed, { rough });
  const result = createJob(sb, timing, { draft: draft || rough });
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
    draft: draft || rough,
    profile: rough ? 'rough' : draft ? 'draft' : 'final',
    ...(placeholders.length ? { placeholders } : {}),
    warnings: result.warnings,
  };
  writeJSON(path.join(dir, 'manifest.json'), manifest);
  return { ...result, root, sb, timing, dir, media, manifest, placeholders };
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
  const profile = options.rough ? 'rough' : options.draft ? 'draft' : 'final';
  try {
    ctx = await phase('prepare', () => prepareProject(root, options));
  } catch (e) {
    return { profile, errors: [e.message], warnings: [], notes: [], craft: [], placeholders: [] };
  }
  const errors = [],
    notes = [],
    craft = [];
  const warnings = [...ctx.warnings];
  try {
    notes.push(
      withoutCameraCuts(
        await phase('inspect', () => nativeCommand(ctx, 'inspect', ['--fail-on', 'error'], true)),
        ctx.job,
      ),
    );
  } catch (e) {
    errors.push(e.message);
  }
  // The frame audit: held type cut by the frame or the letterbox, printed over other type or
  // the subject, or too small to read. A director would send any of these back. A rough cut
  // lists them as unfinished craft instead of refusing to render, except where the type holds
  // a figure: a clipped or covered number misinforms, so it stays an error in every profile.
  try {
    const file = path.join(ctx.dir, 'audit.json');
    await phase('audit', () => nativeCommand(ctx, '--audit', [file], true));
    for (const a of readJSON(file)) {
      const line = `${a.beat}: ${a.message} (${a.seconds.toFixed(1)} s)`;
      if (a.level !== 'error') warnings.push(line);
      else if (options.rough && !/\d/.test(a.text ?? '')) craft.push(line);
      else errors.push(line);
    }
  } catch (e) {
    errors.push(`frame audit failed: ${e.message}`);
  }
  return {
    profile,
    errors,
    warnings,
    notes,
    craft,
    placeholders: ctx.placeholders,
    duration: ctx.timing.duration,
    inputId: ctx.manifest.inputId,
  };
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
    if (b.block === 'canvas' && Array.isArray(b.props.view) && b.props.view.length === 4)
      out.push([b.start_frame, b.start_frame + b.frames]);
    if (moving.includes(b.transition)) out.push([b.start_frame, b.start_frame + edge]);
    if (moving.includes(b.exit)) out.push([b.start_frame + b.frames - edge, b.start_frame + b.frames]);
    return out;
  });
  const kept = String(report)
    .split('\n')
    .filter(line => {
      const m = / \(frames (\d+)\.\.(\d+),.*cut off by the canvas edge/.exec(line);
      // The renderer merges one text's sightings across beats; judge the range by its ends.
      const inside = f => moves.some(([a, b]) => f >= a && f <= b);
      return !m || !(inside(+m[1]) && inside(+m[2]));
    })
    .join('\n');
  // The count describes what is left after the filter, not what the renderer first saw.
  const left = kept.split('\n').filter(l => /^(Error|Warning|Info) /.test(l)).length;
  return kept.replace(/(checked \d+ frames: )\d+ findings?/, (_, head) =>
    left ? `${head}${left} findings` : `${head}no problems found`,
  );
}
