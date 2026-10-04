// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { THEMES, palette } from './catalog.mjs';
import { sha256 } from './native-build.mjs';
import { prepareProject, nativeCommand, unchanged } from './prepare.mjs';
import { renderGeometry } from './render-geometry.mjs';
import { soundDesign } from './sound.mjs';
import { mix, mux } from '../engine/lib/audio.mjs';
import { ffmpeg, writeJSON, log } from '../engine/lib/util.mjs';

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
export async function renderProject(root, { draft = false, out, noAudio = false, force = false, scale = 1 } = {}) {
  renderGeometry({ width: 1920, height: 1080 }, { draft, scale });
  const ctx = await prepareProject(root, { draft });
  const geometry = renderGeometry(ctx.job, { draft, scale });
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
  try {
    // Scale only the output raster; layout, frame rate, speech and source media clocks stay authored.
    await nativeCommand(ctx, 'render', [...(draft ? ['--draft', '--scale', String(scale)] : []), '-o', raw]);
    // Upstream segment concatenation can end the MP4 edit list one frame early at some
    // lengths (e.g. 451 frames), so players drop the final frame. Rebuild the timeline
    // from the packets themselves; frames are copied bit-for-bit.
    await ffmpeg([
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
    const soundCues = soundDesign(ctx.job, ctx.sb.sfx);
    // The cue sheet, for review: what plays where (bench waveforms mark these).
    writeJSON(path.join(root, 'build/cues.json'), soundCues);
    const track = noAudio ? null : await mix(root, ctx.timing, audio, ctx.sb.mix, soundCues);
    await mux(silent, track, finished);
    // Decode/count the complete deliverable once, after muxing and before publication.
    const probe = validateVideo(finished, expected);
    unchanged(ctx);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.renameSync(finished, output);
    const report = {
      ...ctx.manifest,
      encoder: draft ? 'draft (x264 veryfast, CRF 21)' : 'final (x264 medium, CRF 16)',
      width: geometry.width,
      height: geometry.height,
      authoredWidth: ctx.job.width,
      authoredHeight: ctx.job.height,
      scale,
      fps: ctx.job.fps,
      frames: ctx.job.frames,
      seconds: (performance.now() - start) / 1000,
      backend: process.platform === 'darwin' ? 'skia-metal' : 'cpu',
      audio: !!probe.audio,
      colorSpace: probe.video.color_space ?? null,
      colorTransfer: probe.video.color_transfer ?? null,
      colorPrimaries: probe.video.color_primaries ?? null,
      colorRange: probe.video.color_range ?? null,
      // The native source hash excludes the JavaScript finishing step.
      finishingSourceHashes: {
        'fframes/render.mjs': sha256(fs.readFileSync(new URL(import.meta.url))),
        'engine/lib/audio.mjs': sha256(fs.readFileSync(new URL('../engine/lib/audio.mjs', import.meta.url))),
      },
      outputSha256: sha256(fs.readFileSync(output)),
      voiceProviders: [...new Set(ctx.timing.beats.map(b => b.vo?.provider).filter(Boolean))],
    };
    writeJSON(`${output}.json`, report);
    log.ok(`FFFrames video → ${output}`);
    return report;
  } finally {
    for (const f of [raw, silent, audio, finished]) fs.rmSync(f, { force: true });
  }
}
/** Review copy of the prepared job with a labelled coordinate grid for placing art. */
function withGuides(ctx) {
  const dir = path.join(ctx.dir, `guides-${crypto.randomUUID()}`);
  fs.mkdirSync(dir);
  writeJSON(path.join(dir, 'job.json'), { ...ctx.job, guides: true });
  return { ...ctx, dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
export async function stillProject(root, { draft = false, at, beat, pos = 0.6, out, grid = false } = {}) {
  let ctx = await prepareProject(root, { draft });
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
export async function worldMap(root, { draft = true, name, out } = {}) {
  const ctx = await prepareProject(root, { draft });
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
  { draft = false, per = 3, columns = per, thumb = 400, out, grid = false } = {},
) {
  let ctx = await prepareProject(root, { draft });
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
    await nativeCommand(ctx, 'frame', [times.map(t => `${t.toFixed(4)}s`).join(','), '-o', shots]);
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
export async function lookbookProject(root, { draft = false, beat, pos = 0.6, out } = {}) {
  const ctx = await prepareProject(root, { draft });
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
