// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { THEMES, palette } from './catalog.mjs';
import { sha256, buildScene, backend } from '../scene/engine.mjs';
import { COVER } from './constants.mjs';
import { prepareProject, nativeCommand, unchanged } from './prepare.mjs';
import { renderGeometry } from './render-geometry.mjs';
import { soundDesign } from './sound.mjs';
import { mix, mux } from '../engine/lib/audio.mjs';
import { captionCues, toVTT } from '../engine/lib/timing.mjs';
import { ffmpeg, ffmpegBin, writeJSON, log } from '../engine/lib/util.mjs';
import { phase, record } from '../engine/lib/runlog.mjs';
import { sha256File } from '../engine/lib/store.mjs';
import { snapshot, attachVideo } from '../engine/lib/revisions.mjs';

export function validateVideo(file, { width, height, fps, frames }) {
  const r = spawnSync(
    'ffprobe',
    ['-v', 'error', '-threads', '2', '-count_frames', '-show_streams', '-of', 'json', file],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) throw new Error(r.stderr || 'ffprobe failed');
  const streams = JSON.parse(r.stdout).streams,
    v = streams.find(s => s.codec_type === 'video');
  const [n, d] = (v?.avg_frame_rate ?? '0/1').split('/').map(Number);
  if (
    !v ||
    v.width !== width ||
    v.height !== height ||
    Math.abs(n / d - fps) > 0.001 ||
    Number(v.nb_read_frames) !== frames
  )
    throw new Error('Native output dimensions, frame rate or decoded frame count differ from the storyboard.');
  return { video: v, audio: streams.find(s => s.codec_type === 'audio') ?? null };
}
// The encoder settings live in scene/native/src/encode.rs; these labels describe them.
export const ENCODERS = { draft: 'draft (x264 veryfast, CRF 21)', final: 'final (x264 medium, CRF 16)' };

/** Rebuild the MP4 timeline from the packets themselves (an edit list that ends a frame early
 * makes players drop the final frame); frames are copied bit-for-bit. */
const packetTimeline = (raw, silent) =>
  ffmpeg([
    '-y',
    '-ignore_editlist',
    '1',
    '-i',
    raw,
    '-map',
    '0:v:0',
    '-c:v',
    'copy',
    '-bsf:v',
    'setts=pts=PTS-STARTPTS:dts=DTS-STARTPTS',
    '-an',
    silent,
  ]);

/** What a draft or rough render did not establish, carried in its receipt and revision. */
function unvalidated(ctx, check) {
  const estimated = ctx.timing.beats.filter(b => b.vo && b.vo.wordTiming !== 'measured').map(b => b.id);
  return {
    profile: ctx.manifest.profile,
    placeholders: ctx.placeholders ?? [],
    unfinished: ctx.unfinished ?? [],
    estimatedTiming: estimated,
    ...(check
      ? { craft: check.craft ?? [], audit: 'run' }
      : { audit: 'not run by this command (run check, or draft, for the frame audit)' }),
  };
}

export async function renderProject(
  root,
  { draft = false, rough = false, out, noAudio = false, force = false, scale = 1, check, revision = true, label } = {},
) {
  renderGeometry({ width: 1920, height: 1080 }, { draft: draft || rough, scale });
  const ctx = await phase('prepare', () => prepareProject(root, { draft, rough }));
  const geometry = renderGeometry(ctx.job, { draft: draft || rough, scale });
  const expected = { ...ctx.job, ...geometry };
  const output = path.resolve(out ?? path.join(root, 'build/video.mp4'));
  if (out && fs.existsSync(output) && !force)
    throw new Error(`Output exists: ${output}; choose a new file or use --force.`);
  const token = crypto.randomUUID(),
    raw = path.join(ctx.dir, `${token}-raw.mp4`),
    silent = path.join(ctx.dir, `${token}-video.mp4`),
    audio = path.join(ctx.dir, `${token}-mix.wav`),
    finished = path.join(ctx.dir, `${token}-final.mp4`);
  const start = performance.now();
  const fast = draft || rough;
  try {
    await phase('native-build', () => buildScene());
    // Scale only the output raster; layout, frame rate, speech and source media clocks stay authored.
    await phase('native-render', () => nativeCommand(ctx, 'render', [...(fast ? ['--draft', '--scale', String(scale)] : []), '-o', raw]), {
      frames: ctx.job.frames,
    });
    await phase('timeline', () => packetTimeline(raw, silent));
    const soundCues = soundDesign(ctx.job, ctx.sb.sfx);
    // The cue sheet, for review: what plays where (bench waveforms mark these).
    writeJSON(path.join(root, 'build/cues.json'), soundCues);
    const track = noAudio ? null : await phase('mix', () => mix(root, ctx.timing, audio, ctx.sb.mix, soundCues));
    await phase('mux', () => mux(silent, track, finished));
    // Decode/count the complete deliverable once, after muxing and before publication.
    const probe = await phase('validate-output', () => validateVideo(finished, expected));
    unchanged(ctx);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.renameSync(finished, output);
    const report = {
      ...ctx.manifest,
      encoder: fast ? ENCODERS.draft : ENCODERS.final,
      width: geometry.width,
      height: geometry.height,
      authoredWidth: ctx.job.width,
      authoredHeight: ctx.job.height,
      scale,
      fps: ctx.job.fps,
      frames: ctx.job.frames,
      seconds: (performance.now() - start) / 1000,
      backend: backend(),
      planSha256: ctx.manifest.planSha256,
      audio: !!probe.audio,
      colorSpace: probe.video.color_space ?? null,
      colorTransfer: probe.video.color_transfer ?? null,
      colorPrimaries: probe.video.color_primaries ?? null,
      colorRange: probe.video.color_range ?? null,
      // The native source hash excludes the JavaScript finishing step.
      finishingSourceHashes: {
        'film/render.mjs': sha256(fs.readFileSync(new URL(import.meta.url))),
        'engine/lib/audio.mjs': sha256(fs.readFileSync(new URL('../engine/lib/audio.mjs', import.meta.url))),
      },
      outputSha256: await phase('hash', () => sha256File(output)),
      voiceProviders: [...new Set(ctx.timing.beats.map(b => b.vo?.provider).filter(Boolean))],
      ...(fast ? { notValidated: unvalidated(ctx, check) } : {}),
    };
    writeJSON(`${output}.json`, report);
    log.ok(`Video → ${output}`);
    record({ frames: ctx.job.frames, profile: ctx.manifest.profile });
    if (revision) {
      // Whatever a person could watch gets a revision, so a note can say which cut it was about.
      const { revision: rev, created } = await phase('revision', () =>
        snapshot(root, { ctx, kind: 'render', label }),
      );
      attachVideo(root, rev.id, { file: output, receipt: report, profile: ctx.manifest.profile });
      report.revision = rev.id;
      writeJSON(`${output}.json`, report);
      record({ revision: rev.id });
      log.ok(`${created ? 'Revision' : 'Same content as revision'} ${rev.id} (review/revisions/${rev.id})`);
    }
    return report;
  } finally {
    for (const f of [raw, silent, audio, finished]) fs.rmSync(f, { force: true });
  }
}

// ------------------------------------------------------------------ range previews

/**
 * Frames [a, b) for a stretch of the prepared timeline: whole beats (with the transitions into
 * and out of them) or a time range, widened by `handles` seconds of context on either side.
 */
export function frameRange(job, { from, to, beats, handles = 2 } = {}) {
  const fps = job.fps;
  let a, b;
  if (beats?.length) {
    const idx = beats.map(id => {
      const i = job.beats.findIndex(x => x.id === id);
      if (i < 0) throw new Error(`No beat ${id} in the prepared film.`);
      return i;
    });
    const first = job.beats[Math.min(...idx)],
      last = job.beats[Math.max(...idx)],
      next = job.beats[Math.max(...idx) + 1];
    a = first.start_frame;
    b = last.start_frame + last.frames;
    // A transition draws both sides of its cut: keep the outgoing beat's exit and the next entrance.
    const span = t => Math.ceil(Math.max(COVER[t]?.[0] ?? 0, COVER[t]?.[1] ?? 0, 0.5) * fps);
    if (first.transition !== 'cut' && first.start_frame > 0) a -= span(first.transition);
    if (next && next.transition !== 'cut') b += span(next.transition);
  } else {
    if (!(Number.isFinite(from) && Number.isFinite(to) && to > from)) throw new Error('A range needs from < to (seconds).');
    a = Math.round(from * fps);
    b = Math.round(to * fps);
  }
  if (!(Number.isFinite(handles) && handles >= 0 && handles <= 30)) throw new Error('--handles must be 0–30 seconds.');
  a = Math.max(0, a - Math.round(handles * fps));
  b = Math.min(job.frames, b + Math.round(handles * fps));
  if (!(b > a)) throw new Error('The range is outside the film.');
  const covered = job.beats
    .filter(x => x.start_frame < b && x.start_frame + x.frames > a)
    .map(x => ({
      id: x.id,
      film: [x.start_frame / fps, (x.start_frame + x.frames) / fps],
      // Where the beat sits inside the preview (seconds, clipped to it).
      local: [Math.max(0, x.start_frame - a) / fps, (Math.min(b, x.start_frame + x.frames) - a) / fps],
    }));
  return { a, b, covered };
}

/** The film's full mix, made once per state of its sound: a preview cuts its stretch from it,
 * so the stretch plays at exactly the gain and ducking it has in the whole film. */
async function fullMix(root, ctx) {
  const cues = soundDesign(ctx.job, ctx.sb.sfx);
  const key = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        beats: ctx.timing.beats.map(b => [b.vo?.src, b.vo?.start, b.sfx, b.start, b.end, !!b.vo]),
        music: ctx.timing.music,
        duration: ctx.timing.duration,
        // Only what can be heard: a picture-only edit reuses the mix.
        audio: Object.entries(ctx.manifest.hashes).filter(([k]) => /^assets\/(vo|music|sfx)\//.test(k) || k === ctx.timing.music?.src),
        mix: ctx.sb.mix,
        cues,
      }),
    )
    .digest('hex')
    .slice(0, 16);
  const file = path.join(ctx.dir, `mix-${key}.wav`);
  if (!fs.existsSync(file)) {
    const tmp = path.join(ctx.dir, `mix-${key}-${crypto.randomUUID().slice(0, 8)}.wav`);
    const track = await mix(root, ctx.timing, tmp, ctx.sb.mix, cues);
    if (!track) return null;
    fs.renameSync(tmp, file);
    // Keep the newest few full mixes; they are rebuilt on demand.
    const old = fs
      .readdirSync(ctx.dir)
      .filter(f => /^mix-[0-9a-f]{16}\.wav$/.test(f) && f !== path.basename(file))
      .map(f => path.join(ctx.dir, f))
      .sort((x, y) => fs.statSync(y).mtimeMs - fs.statSync(x).mtimeMs);
    for (const f of old.slice(2)) fs.rmSync(f, { force: true });
  }
  return file;
}

export function loudness(file) {
  const r = spawnSync(
    ffmpegBin(),
    ['-hide_banner', '-nostats', '-i', file, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-'],
    { encoding: 'utf8', maxBuffer: 2 ** 28 },
  );
  const tail = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const i = tail.match(/I:\s+(-?[\d.]+) LUFS/),
    p = tail.match(/Peak:\s+(-?[\d.]+) dBFS/);
  return i ? { integrated: Number(i[1]), peak: p ? Number(p[1]) : null } : null;
}

/** PSNR (dB) between two images of the same size. */
async function psnr(x, y) {
  const log = await ffmpeg(['-i', x, '-i', y, '-lavfi', '[0][1]psnr', '-f', 'null', '-']);
  const m = /average:(inf|[\d.]+)/.exec(log);
  return m ? (m[1] === 'inf' ? Infinity : Number(m[1])) : null;
}

/** Decode frames (by index) of a video to PNGs: [file…]. */
async function decodeFrames(video, frames, dir) {
  const out = [];
  for (const n of frames) {
    const file = path.join(dir, `decoded-${n}.png`);
    await ffmpeg(['-y', '-i', video, '-vf', `select=eq(n\\,${n})`, '-fps_mode', 'passthrough', '-frames:v', '1', file]);
    out.push(file);
  }
  return out;
}

/**
 * Render frames [a, b) of the full prepared timeline: every beat keeps its place, its
 * neighbours, its world state and its transitions (nothing is cut out of the job). Audio is
 * the matching samples of the full mix. The first and last frames are checked against frames
 * the renderer draws directly at those film positions, so the preview's clock is the film's.
 */
export async function renderRange(
  root,
  { from, to, beats, handles = 2, rough = false, out, verify = true, name, ctx: given } = {},
) {
  const ctx = given ?? (await phase('prepare', () => prepareProject(root, { draft: true, rough })));
  const { a, b, covered } = frameRange(ctx.job, { from, to, beats, handles });
  const fps = ctx.job.fps,
    frames = b - a;
  const dir = path.join(root, 'review', 'previews');
  fs.mkdirSync(dir, { recursive: true });
  const base = name ?? `working-${a}-${b}-${ctx.manifest.inputId.slice(0, 8)}`;
  if (!/^[a-z0-9][a-z0-9._-]{0,100}$/i.test(base)) throw new Error(`Invalid preview name ${base}`);
  const output = path.resolve(out ?? path.join(dir, `${base}.mp4`));
  const token = crypto.randomUUID(),
    raw = path.join(ctx.dir, `${token}-range-raw.mp4`),
    silent = path.join(ctx.dir, `${token}-range-video.mp4`),
    cut = path.join(ctx.dir, `${token}-range.wav`),
    finished = path.join(ctx.dir, `${token}-range-final.mp4`),
    shots = path.join(ctx.dir, `${token}-range-frames`);
  const start = performance.now();
  try {
    await phase('native-build', () => buildScene());
    await phase('native-render', () => nativeCommand(ctx, 'render', [`${a}..${b}`, '--draft', '--scale', '1', '-o', raw]), { frames });
    await phase('timeline', () => packetTimeline(raw, silent));
    await phase('validate', () => validateVideo(silent, { ...ctx.job, frames }));
    const full = await phase('mix', () => fullMix(root, ctx));
    let audio = null;
    if (full) {
      const rate = 48000,
        s0 = (a * rate) / fps,
        s1 = (b * rate) / fps;
      await phase('audio-cut', () =>
        ffmpeg(['-y', '-i', full, '-af', `atrim=start_sample=${s0}:end_sample=${s1},asetpts=PTS-STARTPTS`, '-c:a', 'pcm_s16le', cut]),
      );
      audio = { from: 'the full film mix', samples: [s0, s1], rate, film: loudness(full), stretch: loudness(cut) };
    }
    await phase('mux', () => mux(silent, audio ? cut : null, finished));
    const probe = validateVideo(finished, { ...ctx.job, frames });
    let check = null;
    if (verify) {
      // Same frames, two routes: drawn directly at their film position, and decoded from the
      // preview. Each must match at least as well as its neighbour in the preview, so a clock
      // off by one frame fails wherever the picture moves (a still picture cannot tell, and
      // there an off-by-one is invisible anyway).
      fs.mkdirSync(shots);
      // The range's ends, and the first cut inside it, where a one-frame slip is plain to see.
      const cut = ctx.job.beats.map(x => x.start_frame).find(f => f > a && f < b - 1);
      const points = [
        { film: a, near: [a + 1] },
        ...(cut != null ? [{ film: cut, near: [cut - 1, cut + 1] }] : []),
        ...(b - 1 > a ? [{ film: b - 1, near: [b - 2] }] : []),
      ].map(p => ({ ...p, near: p.near.filter(f => f >= a && f < b) }));
      await phase('verify', async () => {
        await nativeCommand(ctx, 'frame', [points.map(p => p.film).join(','), '-o', shots], true);
        const drawn = fs
          .readdirSync(shots)
          .filter(f => f.endsWith('.png'))
          .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))
          .map(f => path.join(shots, f));
        if (drawn.length !== points.length) throw new Error(`Expected ${points.length} reference frames; got ${drawn.length}`);
        const wanted = [...new Set(points.flatMap(p => [p.film, ...p.near]).map(f => f - a))];
        const decoded = await decodeFrames(finished, wanted, shots);
        const at = f => decoded[wanted.indexOf(f - a)];
        check = [];
        for (const [k, p] of points.entries()) {
          const near = [];
          for (const f of p.near) near.push(await psnr(drawn[k], at(f)));
          check.push({ film: p.film, preview: p.film - a, psnr: await psnr(drawn[k], at(p.film)), neighbour: near.length ? Math.max(...near) : null });
        }
      });
      const bad = check.filter(c => !(c.psnr >= 35) || (c.neighbour != null && c.neighbour > c.psnr + 0.5));
      if (bad.length)
        throw new Error(
          `Preview frames do not match the film at ${bad.map(c => `frame ${c.film} (${c.psnr?.toFixed(1)} dB; its neighbour ${c.neighbour?.toFixed(1)} dB)`).join(', ')}; the preview clock is off.`,
        );
    }
    unchanged(ctx);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.renameSync(finished, output);
    // Speech for the page's player, on the preview's own clock.
    const cues = captionCues(ctx.timing)
      .filter(c => c.end > a / fps && c.start < b / fps)
      .map(c => ({ ...c, start: Math.max(0, c.start - a / fps), end: Math.min(frames / fps, c.end - a / fps) }));
    fs.writeFileSync(output.replace(/\.mp4$/, '.vtt'), toVTT(cues));
    const report = {
      kind: 'range-preview',
      profile: ctx.manifest.profile,
      inputId: ctx.manifest.inputId,
      rendererSourceHash: ctx.manifest.rendererSourceHash,
      range: { frames: [a, b], seconds: [a / fps, b / fps], fps, handles },
      beats: covered,
      width: ctx.job.width,
      height: ctx.job.height,
      fps,
      frames,
      encoder: ENCODERS.draft,
      audio,
      verified: check,
      captions: ctx.job.captions ? 'burned in by the renderer, as in the film' : 'none in the picture; speech cues in the .vtt beside the preview',
      output,
      outputSha256: sha256File(output),
      seconds: (performance.now() - start) / 1000,
      notValidated: unvalidated(ctx, null),
      colorSpace: probe.video.color_space ?? null,
    };
    writeJSON(`${output}.json`, report);
    record({ preview: path.relative(root, output), frames });
    return report;
  } finally {
    for (const f of [raw, silent, cut, finished]) fs.rmSync(f, { force: true });
    fs.rmSync(shots, { recursive: true, force: true });
  }
}

/**
 * Frames [a, b) of an existing film (a revision's stored video), re-encoded for side-by-side
 * review with its own audio samples. The frames are what that person watched.
 */
export async function cutPassage(video, { fps, a, b, out }) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', video], { encoding: 'utf8' });
  if (probe.status !== 0) throw new Error(`Cannot read ${video}`);
  const streams = JSON.parse(probe.stdout).streams,
    v = streams.find(s => s.codec_type === 'video'),
    hasAudio = streams.some(s => s.codec_type === 'audio');
  const rate = 48000;
  await ffmpeg([
    '-y',
    '-i',
    video,
    '-vf',
    `select=between(n\\,${a}\\,${b - 1}),setpts=N/(${fps}*TB)`,
    '-r',
    String(fps),
    ...(hasAudio ? ['-af', `aresample=${rate},atrim=start_sample=${(a * rate) / fps}:end_sample=${(b * rate) / fps},asetpts=PTS-STARTPTS`] : ['-an']),
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '18',
    '-pix_fmt',
    'yuv420p',
    ...(hasAudio ? ['-c:a', 'aac', '-b:a', '192k'] : []),
    '-movflags',
    '+faststart',
    out,
  ]);
  validateVideo(out, { width: v.width, height: v.height, fps, frames: b - a });
  return { output: out, frames: b - a, outputSha256: sha256File(out) };
}
/** Review copy of the prepared job with a labelled coordinate grid for placing art. */
function withGuides(ctx) {
  const dir = path.join(ctx.dir, `guides-${crypto.randomUUID()}`);
  fs.mkdirSync(dir);
  writeJSON(path.join(dir, 'job.json'), { ...ctx.job, guides: true });
  return { ...ctx, dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
export async function stillProject(root, { draft = false, rough = false, at, beat, pos = 0.6, out, grid = false } = {}) {
  let ctx = await prepareProject(root, { draft, rough });
  const b = beat && ctx.timing.beats.find(b => b.id === beat);
  if (beat && !b) throw new Error(`No beat ${beat}`);
  if (grid) ctx = withGuides(ctx);
  const time = b ? b.start + b.dur * pos : Number(at ?? 0);
  if (!Number.isFinite(time) || time < 0 || time >= ctx.timing.duration)
    throw new Error('Still time must lie within the film.');
  const file = path.resolve(out ?? path.join(root, 'build', `still-${time.toFixed(2)}${grid ? '-grid' : ''}.png`));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    await singleFrame(ctx, time, file);
  } finally {
    ctx.cleanup?.();
  }
  unchanged(ctx);
  return file;
}
async function singleFrame(ctx, time, file) {
  // Upstream's frame -o is always a directory, even for a single timestamp.
  const shots = path.join(ctx.dir, `frame-${crypto.randomUUID()}`);
  fs.mkdirSync(shots);
  try {
    await nativeCommand(ctx, 'frame', [`${time}s`, '-o', shots]);
    const pngs = fs.readdirSync(shots).filter(f => f.endsWith('.png') && fs.statSync(path.join(shots, f)).isFile());
    if (pngs.length !== 1) throw new Error(`Expected one frame PNG; received ${pngs.length}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.copyFileSync(path.join(shots, pngs[0]), file);
  } finally {
    fs.rmSync(shots, { recursive: true, force: true });
  }
}
/**
 * One image of a canvas world at its final state, with every beat's camera rect outlined
 * and numbered: the plan view for placing stations and choosing camera moves.
 */
export async function worldMap(root, { draft = true, rough = false, name, out } = {}) {
  const ctx = await prepareProject(root, { draft, rough });
  const beats = ctx.job.beats.filter(b => b.block === 'canvas' && b.props.world && (!name || b.props.world === name));
  if (!beats.length) throw new Error(name ? `No canvas beats in world "${name}"` : 'No canvas beats use props.world');
  const world = beats[0].props.world,
    stops = beats.filter(b => b.props.world === world),
    last = stops.at(-1);
  // Frame the union of the camera rects, padded, at the film's aspect ratio.
  const views = stops.map(b => b.props.view);
  let l = Math.min(...views.map(v => v[0])),
    t = Math.min(...views.map(v => v[1])),
    r = Math.max(...views.map(v => v[0] + v[2])),
    bt = Math.max(...views.map(v => v[1] + v[3]));
  const aspect = ctx.job.width / ctx.job.height;
  let w = (r - l) * 1.06,
    h = (bt - t) * 1.06;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  const [cx, cy] = [(l + r) / 2, (t + bt) / 2];
  const k = w / ctx.job.width;
  const placed = [];
  const overlay = stops.flatMap((b, i) => {
    const [x, y, vw, vh] = b.props.view,
      color = i % 2 ? '#8ecae6' : '#ff5da2';
    // Rects that share a corner (a return to an earlier view) stack their labels.
    let ly = y + 34 * k;
    while (placed.some(([px, py]) => Math.abs(px - x) < 200 * k && Math.abs(py - ly) < 32 * k)) ly += 34 * k;
    placed.push([x, ly]);
    return [
      {
        type: 'rect',
        x,
        y,
        w: vw,
        h: vh,
        fill: 'none',
        stroke: color,
        width: 3 * k,
        dash: [14 * k, 10 * k],
        enter: 'none',
        at: 0,
      },
      {
        type: 'text',
        text: `${i + 1} ${b.id}`,
        x: x + 12 * k,
        y: ly,
        size: 28 * k,
        font: 'mono',
        fill: color,
        enter: 'none',
        at: 0,
      },
    ];
  });
  const { viewFrom, viewNext, viewAt, viewDur, viewDrift, source, title, kicker, ...props } = last.props;
  const beat = {
    ...last,
    start_frame: 0,
    transition: 'cut',
    exit: 'none',
    camera: { move: 'none' },
    props: { ...props, view: [cx - w / 2, cy - h / 2, w, h], elements: [...props.elements, ...overlay] },
  };
  delete beat.tone;
  const dir = path.join(ctx.dir, `world-${crypto.randomUUID()}`);
  fs.mkdirSync(dir);
  const file = path.resolve(out ?? path.join(root, 'build', `world-${world}.png`));
  try {
    writeJSON(path.join(dir, 'job.json'), { ...ctx.job, frames: last.frames, frame: undefined, beats: [beat] });
    await singleFrame({ ...ctx, dir }, (last.frames - 1) / ctx.job.fps, file);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return file;
}
export async function sheetProject(
  root,
  { draft = false, rough = false, per = 3, columns = per, thumb = 400, out, grid = false } = {},
) {
  let ctx = await phase('prepare', () => prepareProject(root, { draft, rough }));
  if (grid) ctx = withGuides(ctx);
  if (
    !Number.isInteger(columns) ||
    columns < 1 ||
    columns > 8 ||
    !Number.isInteger(thumb) ||
    thumb < 100 ||
    thumb > 1920
  )
    throw new Error('Invalid sheet columns or thumb size');
  if (!Number.isInteger(per) || per < 1 || per > 3) throw new Error('sheet --per must be 1–3');
  const times = ctx.timing.beats.flatMap(b =>
    (per === 1 ? [0.65] : per === 2 ? [0.3, 0.85] : [0.15, 0.55, 0.9]).map(p =>
      Math.min(b.end - 1 / ctx.timing.fps, b.start + b.dur * p),
    ),
  );
  const shots = path.join(ctx.dir, `sheet-${crypto.randomUUID()}`);
  fs.mkdirSync(shots);
  const file = path.resolve(out ?? path.join(root, 'build/sheet.png'));
  try {
    await phase('native-frames', () => nativeCommand(ctx, 'frame', [times.map(t => `${t.toFixed(4)}s`).join(','), '-o', shots]), {
      frames: times.length,
    });
    const pngs = fs
      .readdirSync(shots)
      .filter(f => f.endsWith('.png'))
      .sort();
    if (pngs.length !== times.length) throw new Error(`Expected ${times.length} frame PNGs; got ${pngs.length}`);
    // Upstream names contain frame numbers; numeric sort preserves beat order.
    pngs.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    pngs.forEach((f, i) =>
      fs.copyFileSync(path.join(shots, f), path.join(shots, `tile-${String(i).padStart(4, '0')}.png`)),
    );
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await ffmpeg([
      '-y',
      '-framerate',
      '1',
      '-i',
      path.join(shots, 'tile-%04d.png'),
      '-vf',
      `scale=${thumb}:-1,tile=${columns}x${Math.ceil(times.length / columns)}:padding=8:margin=8:color=0x161b22`,
      '-frames:v',
      '1',
      '-threads',
      '1',
      file,
    ]);
    unchanged(ctx);
    writeJSON(`${file}.json`, { inputId: ctx.manifest.inputId, times, beats: ctx.job.beats.map(b => b.id) });
    return file;
  } finally {
    fs.rmSync(shots, { recursive: true, force: true });
    ctx.cleanup?.();
  }
}
export async function lookbookProject(root, { draft = false, rough = false, beat, pos = 0.6, out } = {}) {
  const ctx = await prepareProject(root, { draft, rough });
  const b = beat ? ctx.timing.beats.find(b => b.id === beat) : ctx.timing.beats[0];
  if (!b) throw new Error(`No beat ${beat}`);
  if (!Number.isFinite(pos) || pos < 0 || pos >= 1) throw new Error('Lookbook --pos must be 0–1, excluding 1.');
  const time = Math.min(b.end - 1 / ctx.job.fps, b.start + b.dur * pos);
  const temp = path.join(ctx.dir, `looks-${crypto.randomUUID()}`);
  fs.mkdirSync(temp);
  const file = path.resolve(out ?? path.join(root, 'build/looks.png')),
    themes = Object.keys(THEMES);
  try {
    for (const [i, name] of themes.entries()) {
      const dir = path.join(temp, name);
      fs.mkdirSync(dir);
      writeJSON(path.join(dir, 'job.json'), { ...ctx.job, theme: palette(name) });
      await singleFrame({ ...ctx, dir }, time, path.join(temp, `tile-${String(i).padStart(4, '0')}.png`));
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const columns = Math.min(4, themes.length),
      rows = Math.ceil(themes.length / columns);
    await ffmpeg([
      '-y',
      '-framerate',
      '1',
      '-i',
      path.join(temp, 'tile-%04d.png'),
      '-vf',
      `scale=480:-2,tile=${columns}x${rows}:padding=12:margin=12:color=0x161b22`,
      '-frames:v',
      '1',
      '-threads',
      '1',
      file,
    ]);
    unchanged(ctx);
    writeJSON(`${file}.json`, {
      inputId: ctx.manifest.inputId,
      beat: b.id,
      time,
      themes,
      order: 'left to right, top to bottom',
      note: 'Same scene and media; only the native palette changes. Generated footage is not recolored.',
    });
    return file;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
