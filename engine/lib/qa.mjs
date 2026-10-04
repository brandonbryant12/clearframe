// Time-bug QA on the encoded film. Stills catch design bugs; these checks catch what only
// shows in motion: a one-frame flash, a picture that stops changing under the voice, a world
// seam that jumps, an export that players read differently. Independent implementation of
// the checks described in Raphaël Aubry's "the bugs (and the checks that catch them)" (2026).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { computeTiming } from './timing.mjs';
import { loadStoryboard } from './project.mjs';
import { ffmpeg, ffmpegBin, writeJSON } from './util.mjs';
import { measureDrop } from './beatmap.mjs';
import { sha256 } from '../../fframes/native-build.mjs';
import { reviewGeometry } from '../../fframes/render-geometry.mjs';
import { COVER } from '../../fframes/constants.mjs';

// Analysis grid: the long side at 128 px is enough to see a pop or a jump, and small enough
// to hold a few minutes of film in memory.
const LONG = 128;
// Mean absolute grey difference (0–255) over one second. The viral references we measured
// never drop under 3 for even 2.5 s (medians 8–42); a held slide sits under 1.
export const HELD = { change: 2, seconds: 2.5 };

/** Compare the active picture, excluding authored horizontal bars (same rule as lens.rs).
 * The caller passes the original aspect to avoid analysis-grid rounding changing the crop.
 */
export function pictureDifference(a, b, width, height, letterbox = 0, aspect = width / height) {
  const bar =
    letterbox > aspect && aspect > 1
      ? Math.min(Math.floor((height - 1) / 2), Math.ceil((height * (1 - aspect / letterbox)) / 2))
      : 0;
  return diff(a.subarray(bar * width, (height - bar) * width), b.subarray(bar * width, (height - bar) * width));
}

function grid(width, height) {
  const k = LONG / Math.max(width, height);
  const even = n => Math.max(2, Math.round((n * k) / 2) * 2);
  return [even(width), even(height)];
}

/** Decoded grey frames of a video at the analysis grid. */
function decode(file, w, h) {
  const r = spawnSync(
    ffmpegBin(),
    [
      '-v', 'error', '-threads', '2', '-filter_threads', '2', '-i', file, '-an',
      '-vf', `scale=${w}:${h}:flags=area,format=gray`, '-threads', '2', '-f', 'rawvideo', '-',
    ],
    { maxBuffer: 2 ** 31 - 1 },
  );
  if (r.status !== 0) throw new Error(`ffmpeg could not decode ${file}: ${r.stderr}`);
  const n = w * h;
  return { frames: Math.floor(r.stdout.length / n), at: i => r.stdout.subarray(i * n, (i + 1) * n), size: n };
}

const diff = (a, b) => {
  let s = 0;
  for (let k = 0; k < a.length; k++) s += Math.abs(a[k] - b[k]);
  return s / a.length;
};
const median = xs => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : 0;
};
const r2 = n => Math.round(n * 100) / 100;

/**
 * Pure analysis of per-frame differences, so the rules are testable without a video.
 * d[i] = difference between frame i-1 and i; skip[i] = difference between i-1 and i+1;
 * second[i] = difference between frame i and the frame one second earlier.
 */
export function timeFindings({ d, skip, second, fps, beats = [], worlds = {}, covers = {} }) {
  const n = d.length;
  const beatAt = t => beats.find(b => t >= b.start && t < b.end) ?? beats.at(-1);
  const where = i => {
    const t = i / fps,
      b = beatAt(t);
    return { t: r2(t), frame: i, beat: b?.id ?? null, local: b ? r2(t - b.start) : null };
  };
  // A join is the cut plus whatever a graphic transition covers on either side of it.
  const joins = new Set();
  for (const b of beats.slice(1)) {
    const f = Math.round(b.start * fps),
      [before, after] = covers[b.id] ?? [0, 0];
    for (let k = -2 - Math.ceil(before * fps); k <= 2 + Math.ceil(after * fps); k++) joins.add(f + k);
  }
  const findings = [];
  // A frame that differs from both neighbours while they agree: a flash, a pop, an element
  // drawn for one frame. Flash transitions are several frames long, so they never match.
  for (let i = 1; i < n - 1; i++) {
    const lo = Math.min(d[i], d[i + 1]);
    if (lo > Math.max(1.5, 3 * skip[i]))
      findings.push({
        level: 'error',
        kind: 'pop',
        ...where(i),
        message: `one-frame pop: frame ${i} differs from both neighbours (${r2(lo)} vs ${r2(skip[i])} between them)`,
      });
  }
  // A world's cut is meant to be invisible: the frame either side should be the same picture.
  for (const b of beats.slice(1)) {
    const prev = beats[beats.indexOf(b) - 1];
    const w = worlds[b.id];
    if (!w || worlds[prev.id] !== w || (b.transition && b.transition !== 'cut')) continue;
    const f = Math.round(b.start * fps);
    if (f <= 0 || f >= n) continue;
    const around = median(d.slice(Math.max(1, f - 15), f - 1).concat(d.slice(f + 2, f + 17)));
    if (d[f] > Math.max(6, 4 * around))
      findings.push({
        level: 'warn',
        kind: 'seam',
        ...where(f),
        message: `world "${w}" seam jumps between ${prev.id} and ${b.id} (${r2(d[f])} against ${r2(around)} around it)`,
      });
  }
  // Hard changes away from any join: a cut nobody planned, or a deliberate one worth seeing.
  // Consecutive frames (a whip, a fast move) are one change.
  for (let i = 1; i < n; i++) {
    if (!(d[i] > 12) || joins.has(i)) continue;
    let j = i;
    while (j + 1 < n && d[j + 1] > 12 && !joins.has(j + 1)) j++;
    const peak = Math.max(...d.slice(i, j + 1));
    findings.push({
      level: 'note',
      kind: 'jump',
      ...where(i),
      message: `hard change inside the beat${j > i ? ` over ${j - i + 1} frames` : ''} (${r2(peak)})`,
    });
    i = j;
  }
  // Held picture: every frame within a second of a frame it barely differs from (under
  // HELD.change), for at least HELD.seconds. A silent beat may hold on purpose.
  const F = Math.round(fps);
  const held = new Uint8Array(n);
  for (let i = F; i < n; i++)
    if (beatAt(i / fps) === beatAt((i - F) / fps) && second[i] < HELD.change) held.fill(1, i - F, i + 1);
  for (let i = 0; i < n; i++) {
    if (!held[i]) continue;
    let j = i;
    while (j + 1 < n && held[j + 1] && beatAt((j + 1) / fps) === beatAt(i / fps)) j++;
    const seconds = (j - i + 1) / fps;
    if (seconds >= HELD.seconds) {
      const s = where(i),
        e = where(j);
      const voiced = beats.some(x => x.vo && x.vo.start < e.t && x.vo.end > s.t);
      findings.push({
        level: voiced ? 'warn' : 'note',
        kind: 'held',
        ...s,
        end: e.t,
        seconds: r2(seconds),
        message: `the picture barely changes for ${r2(seconds)} s (${s.t}–${e.t} s)${voiced ? ' during the narration span' : ''}: review for an unintended freeze or an empty late-cue lead-in. Slow pushes, dark scenes and deliberate cinematic holds can also trigger this advisory; judge the shot in motion before changing its pacing`,
      });
    }
    i = j;
  }
  return findings;
}

/** Container and loudness facts a platform reads before it shows a single frame. */
export function deliveryFindings(probe, { loudness, target = -14, fps, frames, width, height }) {
  const v = probe.streams.find(s => s.codec_type === 'video'),
    a = probe.streams.find(s => s.codec_type === 'audio');
  const out = [];
  const bad = (level, message) => out.push({ level, kind: 'delivery', message });
  if (!v) return [{ level: 'error', kind: 'delivery', message: 'no video stream' }];
  if (v.width !== width || v.height !== height)
    bad('error', `size ${v.width}×${v.height}, storyboard ${width}×${height}`);
  const [n, dd] = String(v.avg_frame_rate ?? '0/1')
    .split('/')
    .map(Number);
  if (Math.abs(n / dd - fps) > 0.001) bad('error', `frame rate ${r2(n / dd)}, storyboard ${fps}`);
  if (frames && Number(v.nb_frames) && Number(v.nb_frames) !== frames)
    bad('error', `${v.nb_frames} frames, storyboard ${frames}`);
  if (v.sample_aspect_ratio && !['1:1', '0:1', 'N/A'].includes(v.sample_aspect_ratio))
    bad('error', `pixel aspect ratio ${v.sample_aspect_ratio}: players that respect it stretch the film (setsar=1)`);
  if (v.pix_fmt !== 'yuv420p') bad('warn', `pixel format ${v.pix_fmt}; social players expect yuv420p`);
  if (v.color_range && v.color_range !== 'tv') bad('warn', `colour range ${v.color_range}; deliver TV range`);
  for (const k of ['color_primaries', 'color_transfer', 'color_space'])
    if (!v[k] || v[k] === 'unknown') bad('warn', `${k.replace('_', ' ')} untagged: players guess, and guesses differ`);
  if (a) {
    const vd = Number(v.duration),
      ad = Number(a.duration);
    if (Number.isFinite(vd) && Number.isFinite(ad) && ad + 1 / fps < vd)
      bad('warn', `audio ends ${r2(vd - ad)} s before the picture`);
    if (loudness) {
      if (Math.abs(loudness.integrated - target) > 1)
        bad('warn', `loudness ${loudness.integrated} LUFS, target ${target}`);
      if (loudness.peak > -1) bad('warn', `true peak ${loudness.peak} dBTP; keep it under −1`);
    }
  }
  return out;
}

function probeStreams(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || 'ffprobe failed');
  return JSON.parse(r.stdout);
}

function measureLoudness(file) {
  const r = spawnSync(
    ffmpegBin(),
    [
      '-hide_banner', '-nostats', '-threads', '2', '-filter_threads', '2', '-i', file,
      '-map', '0:a:0', '-af', 'ebur128=peak=true', '-threads', '2', '-f', 'null', '-',
    ],
    { encoding: 'utf8', maxBuffer: 2 ** 28 },
  );
  const tail = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const i = tail.match(/I:\s+(-?[\d.]+) LUFS/),
    p = tail.match(/Peak:\s+(-?[\d.]+) dBFS/);
  return i ? { integrated: Number(i[1]), peak: p ? Number(p[1]) : null } : null;
}

/** Share the decode and one-second samples; keep each sheet's original tile geometry. */
async function sheets(file, dir, { portrait, seconds }) {
  const sizes = [
    { name: 'timeline', width: portrait ? 160 : 240, columns: portrait ? 10 : 8 },
    { name: 'phone', width: 360, columns: portrait ? 6 : 4 },
  ];
  const filters = sizes.map(({ name, width, columns }, i) => {
    const rows = Math.max(1, Math.ceil(Math.ceil(seconds) / columns));
    return `[sample${i}]scale=${width}:-2,tile=${columns}x${rows}:padding=4:margin=4:color=0x161b22[${name}]`;
  });
  await ffmpeg([
    '-y',
    '-i',
    file,
    '-filter_complex',
    ['[0:v:0]fps=1,split=2[sample0][sample1]', ...filters].join(';'),
    ...sizes.flatMap(({ name }) => [
      '-map', `[${name}]`, '-frames:v', '1', '-threads', '1', path.join(dir, `${name}.png`),
    ]),
  ]);
}

export async function qaProject(root, { video, loop = false } = {}) {
  const file = path.resolve(video ?? path.join(root, 'build/video.mp4'));
  if (!fs.existsSync(file)) throw new Error(`No film at ${file}; render first.`);
  const sb = loadStoryboard(root);
  const timing = computeTiming(root);
  const probe = probeStreams(file);
  let receipt;
  try { receipt = JSON.parse(fs.readFileSync(`${file}.json`, 'utf8')); } catch {}
  const output = reviewGeometry(sb.format, receipt, {
    videoHash: receipt?.draft ? sha256(fs.readFileSync(file)) : undefined,
    storyboardHash: receipt?.draft ? sha256(fs.readFileSync(path.join(root, 'storyboard.json'))) : undefined,
  });
  const v = probe.streams.find(s => s.codec_type === 'video');
  const [w, h] = grid(v.width, v.height);
  const film = decode(file, w, h);
  const n = film.frames,
    fps = timing.fps,
    F = Math.round(fps);
  const d = [0],
    skip = [0],
    second = [];
  const same = timing.frames === n;
  const beats = same ? timing.beats : [];
  const letterboxes = beats.map(b => sb.beats[b.index].lens?.letterbox ?? sb.lens?.letterbox ?? 0);
  let beatIndex = 0;
  for (let i = 1; i < n; i++) d.push(diff(film.at(i - 1), film.at(i)));
  for (let i = 1; i < n - 1; i++) skip.push(diff(film.at(i - 1), film.at(i + 1)));
  skip.push(0);
  for (let i = 0; i < n; i++) {
    while (beatIndex + 1 < beats.length && i / fps >= beats[beatIndex].end) beatIndex++;
    const withinBeat = !same || !beats.length || (i - F) / fps >= beats[beatIndex].start;
    second.push(
      i >= F && withinBeat
        ? pictureDifference(film.at(i - F), film.at(i), w, h, letterboxes[beatIndex] ?? 0, v.width / v.height)
        : Infinity,
    );
  }
  const worlds = Object.fromEntries(sb.beats.map(b => [b.id, b.props?.world ?? null]));
  const covers = Object.fromEntries(
    sb.beats.map(b => {
      const t = b.transition ?? sb.transition ?? 'fade';
      return [b.id, COVER[t] ?? (t === 'cut' ? [0, 0] : [0.35, 0.35])];
    }),
  );
  const findings = timeFindings({ d, skip, second, fps, beats, worlds, covers });
  if (!same)
    findings.unshift({
      level: 'warn',
      kind: 'timeline',
      message: `the film has ${n} frames, the storyboard ${timing.frames}: findings carry no beat names (render again)`,
    });
  // A loop must end on the picture it starts with: its seam quieter than an ordinary frame change.
  if (loop && n > 2) {
    const seam = diff(film.at(n - 1), film.at(0)),
      typical = median(d.slice(1));
    if (seam > Math.max(1, 2 * typical))
      findings.push({
        level: 'warn',
        kind: 'loop',
        message: `loop seam ${r2(seam)} against ${r2(typical)} between neighbours: the restart shows`,
      });
  }
  const loudness = probe.streams.some(s => s.codec_type === 'audio') ? measureLoudness(file) : null;
  findings.push(
    ...deliveryFindings(probe, {
      loudness,
      target: sb.mix?.loudness ?? -14,
      fps,
      frames: timing.frames,
      width: output.width,
      height: output.height,
    }),
  );
  // Measure the result, not the plan: the music's drop should be heard where it was placed.
  const drop = timing.music?.drop;
  if (drop?.film != null && loudness) {
    const heard = measureDrop(file, { near: drop.film });
    if (!heard || heard.jump < 6 || Math.abs(heard.t - drop.film) > 0.12)
      findings.push({
        level: 'warn',
        kind: 'drop',
        message:
          heard && heard.jump >= 6
            ? `the music's drop is heard at ${heard.t} s, planned for ${drop.film} s (${drop.beat ?? ''})`
            : `no drop heard near ${drop.film} s: the bass does not jump there in the mix`,
      });
  }
  const dir = path.join(root, 'build', 'qa');
  fs.mkdirSync(dir, { recursive: true });
  const portrait = v.height > v.width;
  // The phone sheet is what a viewer's thumb sees: 360 px wide frames.
  const seconds = n / fps;
  await sheets(file, dir, { portrait, seconds });
  const change = second.filter(Number.isFinite);
  const summary = {
    seconds: r2(n / fps),
    frames: n,
    changePerSecond: r2(median(change)),
    heldSeconds: r2(findings.filter(f => f.kind === 'held').reduce((s, f) => s + f.seconds, 0)),
    pops: findings.filter(f => f.kind === 'pop').length,
    loudness,
    color: [v.color_primaries, v.color_transfer, v.color_space, v.color_range].join('/'),
  };
  writeJSON(path.join(dir, 'qa.json'), {
    video: file,
    output: { width: output.width, height: output.height, scale: output.scale, draft: output.draft },
    summary,
    findings,
    change: change.map(r2),
    heldAnalysis: {
      ...HELD,
      region: same ? 'active picture excluding authored letterbox bars' : 'full frame (timeline mismatch)',
      advisory: true,
    },
  });
  return { dir, summary, findings };
}
