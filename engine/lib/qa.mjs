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
import { sha256 } from '../../scene/engine.mjs';
import { reviewGeometry } from '../../film/render-geometry.mjs';
import { COVER } from '../../film/constants.mjs';
import { pictureFor, chartFor } from './pictures.mjs';
import { spoken } from './word-align.mjs';

// Analysis grid: the long side at 128 px is enough to see a pop or a jump, and small enough
// to hold a few minutes of film in memory.
const LONG = 128;
// Mean absolute grey difference (0–255) over one second. The viral references we measured
// never drop under 3 for even 2.5 s (medians 8–42); a held slide sits under 1.
export const HELD = { change: 2, seconds: 2.5, local: 7 };

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

/**
 * The largest change in any 16×16 cell of the analysis grid (about 240 px at 1080p), above a
 * band at the bottom (burned captions change with every phrase and are not the picture). A coin
 * dropping, a value typed or a menu opening is small next to the whole frame but plain in its
 * cell; the frame average alone called such a picture held.
 */
export function localDifference(a, b, width, height, skipBottom = 0) {
  const T = 16,
    rows = height - skipBottom;
  let best = 0;
  for (let ty = 0; ty < rows; ty += T)
    for (let tx = 0; tx < width; tx += T) {
      let sum = 0,
        n = 0;
      for (let y = ty; y < Math.min(rows, ty + T); y++)
        for (let x = tx; x < Math.min(width, tx + T); x++) {
          sum += Math.abs(a[y * width + x] - b[y * width + x]);
          n++;
        }
      if (n && sum / n > best) best = sum / n;
    }
  return best;
}

/**
 * Where the picture sits in one decoded frame: the bounding box of 4×4-pixel cells that differ
 * from the background (the median of the frame's top and side edges), above a band at the bottom
 * for the source line and captions. Shares of the frame's width and height, and the box's centre.
 * A lone line of small type (a source, a footnote) does not fill a cell, so it does not count.
 */
export function pictureExtent(frame, width, height, skipBottom = 0) {
  const edge = [];
  for (let x = 0; x < width; x++) edge.push(frame[x]);
  for (let y = 0; y < height - skipBottom; y++) edge.push(frame[y * width], frame[y * width + width - 1]);
  const bg = median(edge),
    C = 4,
    rows = height - skipBottom;
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let ty = 0; ty < rows; ty += C)
    for (let tx = 0; tx < width; tx += C) {
      let on = 0;
      for (let y = ty; y < Math.min(rows, ty + C); y++)
        for (let x = tx; x < Math.min(width, tx + C); x++) if (Math.abs(frame[y * width + x] - bg) > 16) on++;
      if (on >= 5) {
        x0 = Math.min(x0, tx); y0 = Math.min(y0, ty);
        x1 = Math.max(x1, Math.min(width, tx + C)); y1 = Math.max(y1, Math.min(rows, ty + C));
      }
    }
  if (x1 < 0) return { w: 0, h: 0, cx: 0.5, cy: 0.5 };
  return { w: (x1 - x0) / width, h: (y1 - y0) / rows, cx: (x0 + x1) / 2 / width, cy: (y0 + y1) / 2 / rows };
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
export function timeFindings({ d, skip, second, local = [], fps, beats = [], worlds = {}, covers = {}, holds = new Set() }) {
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
    if (beatAt(i / fps) === beatAt((i - F) / fps) && second[i] < HELD.change && (local[i] ?? 0) < HELD.local)
      held.fill(1, i - F, i + 1);
  for (let i = 0; i < n; i++) {
    if (!held[i]) continue;
    let j = i;
    while (j + 1 < n && held[j + 1] && beatAt((j + 1) / fps) === beatAt(i / fps)) j++;
    const seconds = (j - i + 1) / fps;
    if (seconds >= HELD.seconds) {
      const s = where(i),
        e = where(j);
      const voiced = beats.some(x => x.vo && x.vo.start < e.t && x.vo.end > s.t);
      // `pace: "hold"` on a beat declares a reading hold: still reported, never as a slide.
      const deliberate = holds.has(s.beat);
      findings.push({
        level: voiced && !deliberate ? 'warn' : 'note',
        kind: 'held',
        ...s,
        end: e.t,
        seconds: r2(seconds),
        ...(deliberate ? { deliberate: true } : {}),
        message: deliberate
          ? `the picture holds for ${r2(seconds)} s (${s.t}–${e.t} s): a declared reading hold (pace: "hold")`
          : voiced
            ? `the picture sits still for ${r2(seconds)} s (${s.t}–${e.t} s) while the voice talks: a viewer sees a slide. Change something on a later word (a cue, a key, a camera move, a cast formation), shorten the beat, or declare a reading hold with pace: "hold"`
            : `the picture sits still for ${r2(seconds)} s (${s.t}–${e.t} s) with no voice: fine for a breath or a title, long for anything else`,
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

const clip = (t, n) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const TYPE_BLOCKS = ['kinetic', 'statement', 'title', 'quote', 'endcard', 'chapter', 'list', 'checklist', 'callout'];
const NUMBER_CARDS = ['stat', 'kpis', 'delta', 'magnitude', 'donut', 'waffle', 'compare'];
/** The change that fits a still beat, from what it is made of. */
export function stillFix(beat) {
  const p = beat.props ?? {};
  if (p.sketch)
    return `Land a later moment of the ${p.sketch} sketch on one of those words (sketchSay; \`sketch ${p.sketch}\` lists its moments in order), or shorten the beat to its last moment.`;
  if (p.chart)
    return `Give each chart value a \`say\` word from that line so each figure lands as it is spoken${p.chart.kind === 'number' ? ' (a number with several cued values steps through them)' : ''}, or add a \`note\` on the word that makes the point.`;
  if (p.cast) return 'Give the cast a formation or a move (a swap, a merge, a hero) on one of those words.';
  if (p.world || beat.stage) return 'Move the camera or an actor on one of those words.';
  if (beat.block === 'canvas') return 'Cue an element or a key (`say`) on one of those words, so the drawing changes while it is explained.';
  if (NUMBER_CARDS.includes(beat.block))
    return 'This is a number card: give each figure its own moment as it is said (a canvas `chart` with a `say` on each value, or the sketch for this kind of fact: `match` for money added, `split` for where it goes).';
  if (TYPE_BLOCKS.includes(beat.block))
    return 'This is type on its own: give the idea a picture that changes on those words (`critique` names a sketch for it), or cut the beat to the line.';
  return 'Change something on one of those words, or shorten the beat.';
}

/** How to make a beat's picture fill its frame, from what it is made of. */
function sizeFix(beat) {
  const p = beat.props ?? {};
  if (p.cast) return 'Give the objects a larger `size` (up to 360), a `spread` for the formation, or a camera `zoom` on the cast.';
  if (p.chart || p.box) return 'Give the chart a larger `box` ([x, y, w, h] in frame pixels).';
  if (beat.block === 'canvas') return 'Fit the drawing to the space with `view: "auto"` (its bounds, enlarged up to 2×), or draw it larger.';
  return 'Use the space: a larger size, or a layout that spans the frame.';
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
    second = [],
    local = [];
  // Burned captions sit in the bottom of the frame; their phrases are not the picture moving.
  const captionBand = sb.captions ? Math.round(h * (h > w ? 0.24 : 0.16)) : 0;
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
    local.push(i >= F && withinBeat ? localDifference(film.at(i - F), film.at(i), w, h, captionBand) : Infinity);
  }
  const worlds = Object.fromEntries(sb.beats.map(b => [b.id, b.props?.world ?? null]));
  const covers = Object.fromEntries(
    sb.beats.map(b => {
      const t = b.transition ?? sb.transition ?? 'fade';
      return [b.id, COVER[t] ?? (t === 'cut' ? [0, 0] : [0.35, 0.35])];
    }),
  );
  const holds = new Set(sb.beats.filter(b => b.pace === 'hold').map(b => b.id));
  const findings = timeFindings({ d, skip, second, local, fps, beats, worlds, covers, holds });
  // A picture that has landed but fills a corner of the frame: judges read it as unfinished, and
  // on a phone it is a small thing in an empty field. Measured late in the beat, once built.
  const band = Math.round(h * 0.12);
  for (const b of beats) {
    // Type sets its own size (a short line is short on purpose); this is about pictures.
    if (TYPE_BLOCKS.includes(sb.beats[b.index]?.block)) continue;
    const i = Math.min(n - 1, Math.round((b.start + Math.max(0.5, Math.min(b.dur * 0.85, b.dur - 0.3))) * fps));
    const e = pictureExtent(film.at(i), w, h, band);
    if (e.w === 0) continue;
    const small = (e.w < 0.5 && e.h < 0.5) || e.w * e.h < 0.12;
    const corner = Math.abs(e.cx - 0.5) > 0.22 || Math.abs(e.cy - 0.5) > 0.22
      ? `${e.cy < 0.35 ? 'top' : e.cy > 0.65 ? 'bottom' : ''}${e.cx < 0.35 ? (e.cy < 0.35 || e.cy > 0.65 ? ' left' : 'left') : e.cx > 0.65 ? (e.cy < 0.35 || e.cy > 0.65 ? ' right' : 'right') : ''}`
      : '';
    if (!small) continue;
    findings.push({
      level: 'warn',
      kind: 'small',
      t: r2(i / fps),
      frame: i,
      beat: b.id,
      fill: { w: r2(e.w), h: r2(e.h) },
      fix: sizeFix(sb.beats[b.index] ?? {}),
      message: `the picture fills ${Math.round(e.w * 100)}% of the width and ${Math.round(e.h * 100)}% of the height${corner ? `, in the ${corner}` : ''}: a small thing in an empty frame, smaller still on a phone. ${sizeFix(sb.beats[b.index] ?? {})}`,
    });
  }
  // A still stretch under the voice says what was said over it and what would move there.
  for (const f of findings) {
    if (f.kind !== 'held' || f.level !== 'warn' || !f.beat) continue;
    const tb = beats.find(b => b.id === f.beat);
    f.said = (tb?.vo?.words ?? []).filter(w => w.t0 >= f.t - 0.05 && w.t0 < f.end).map(w => w.w).join(' ');
    f.fix = stillFix(sb.beats[tb?.index] ?? {});
    // Still to the end of a drawing whose moments have all landed: the rest of the line is
    // another idea, and it needs a beat and a picture of its own rather than more of this one.
    const authored = sb.beats[tb?.index] ?? {};
    if (tb && f.end >= tb.end - 0.4 && (authored.props?.sketch || authored.props?.chart || authored.props?.cast) && /[.!?]\s+\S+\s+\S/.test(f.said)) {
      const next = pictureFor(f.said);
      f.fix = `Its picture has finished while the voice goes on: give "${clip(f.said, 70)}" a beat of its own${next ? ` with ${next.sketch ? `the \`${next.sketch}\` sketch` : next.use}` : ' and a picture of its own'}, or cut those words. (A longer film needs more pictures, not more words over one.)`;
    }
    f.message = `the picture sits still for ${f.seconds} s (${f.t}–${f.end} s) while the voice says "${clip(f.said, 120)}": a viewer sees a slide. ${f.fix}`;
  }
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
    heldSeconds: r2(findings.filter(f => f.kind === 'held' && !f.deliberate).reduce((s, f) => s + f.seconds, 0)),
    deliberateSeconds: r2(findings.filter(f => f.kind === 'held' && f.deliberate).reduce((s, f) => s + f.seconds, 0)),
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

/**
 * The motion verdict on a measured film (`qaProject`'s result): how long the picture sits still under
 * the voice, how much of the film is type on its own, the stillest beats with what to change, and the
 * length against the one asked for. `draft` prints it, and the studio's agent reads it after a draft.
 */
export function motionVerdict(dir, q, { warnings = [] } = {}) {
  const s = q.summary;
  // The voice talking over an empty scene (check's pacing warning): never fine, whatever the share.
  const blank = warnings
    .map(w => w.match(/^([^:]+): the voice starts ([\d.]+) s before/))
    .filter(m => m && Number(m[2]) >= 2)
    .map(m => `    ${m[1]}: the voice talks for ${m[2]} s over an empty scene. Put the picture on screen by the first word (cue it to an earlier word, or draw its frame at 0 and only the change on the late word).`);
  // Stretches under the voice: a silent breath or title may hold.
  const held = q.findings.filter(f => f.kind === 'held' && !f.deliberate && f.level === 'warn');
  const voicedHeld = Math.round(10 * held.reduce((t, f) => t + f.seconds, 0)) / 10;
  const byBeat = {};
  for (const f of held) byBeat[f.beat ?? '?'] = (byBeat[f.beat ?? '?'] ?? 0) + f.seconds;
  // Reading holds are for a figure or a step to read: about a fifth of a film at most. Past
  // that, declared holds count as still again (a film of declared holds is still a deck).
  const allowance = Math.round(2 * s.seconds) / 10,
    overflow = Math.max(0, Math.round(10 * ((s.deliberateSeconds ?? 0) - allowance)) / 10);
  const share = s.seconds ? Math.round((100 * (voicedHeld + overflow)) / s.seconds) : 0;
  const worst = Object.entries(byBeat).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const fixOf = id => held.find(f => f.beat === id && f.fix);
  const verdict =
    share >= 40
      ? 'READS AS NARRATED SLIDES (40% or more): the picture sits still while the voice talks'
      : share >= 20
        ? 'some scenes hold still under the voice (20–40%: fix the stillest)'
        : 'the picture keeps moving with the voice (under 20%)';
  // Moving words are still words: how much of the film is type on its own.
  const TYPE = ['kinetic', 'statement', 'title', 'quote', 'endcard', 'chapter', 'list', 'checklist', 'callout'];
  const sb = JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8'));
  const timed = JSON.parse(fs.readFileSync(path.join(dir, 'build/timing.json'), 'utf8')).beats ?? [];
  const typeOnly = b => TYPE.includes(b.block) && !b.plate && !b.art?.under?.length && !b.stage;
  const typeSeconds = timed.reduce((t, tb, i) => t + (typeOnly(sb.beats[tb.index ?? i] ?? {}) ? (tb.dur ?? tb.end - tb.start) : 0), 0);
  const typeShare = s.seconds ? Math.round((100 * typeSeconds) / s.seconds) : 0;
  const said = typeShare >= 60 && share < 40 ? 'the picture moves, but as words: type over a background reads as narrated slides too' : verdict;
  // Well short of the length asked for means facts were dropped to pass the other tests.
  const short = sb.length && s.seconds < 0.6 * sb.length;
  // Narration that was never voiced plays as a silent film of words (a podcast built without its recording).
  const narrated = timed.filter(tb => tb.vo?.text), unvoiced = narrated.filter(tb => !tb.vo?.src);
  const mute = narrated.length > 0 && unvoiced.length > narrated.length / 2;
  const ready = !(share >= 40 || (typeShare >= 60 && share < 40) || blank.length || short || mute);
  const lines = [
    `motion: ${ready ? 'READY' : 'NOT READY'} · ${s.changePerSecond} change/s; still under the voice ${Math.round(10 * (voicedHeld + overflow)) / 10} s of ${s.seconds} s (${share}%${s.deliberateSeconds ? `; ${s.deliberateSeconds} s more declared as reading holds${overflow ? `, ${overflow} s of them over budget and counted above` : ''}` : ''}): ${said}.`,
    ...(overflow
      ? [`  holds: ${s.deliberateSeconds} s are declared as reading holds (pace: "hold"), more than a fifth of the film; ${overflow} s of them count as still. A reading hold is for a figure or a step that must be read, not a way past this check.`]
      : []),
    ...(typeShare >= 50
      ? [
          `  words: ${typeShare}% of the film is type on its own (kinetic, statements, titles). Moving words are still words on a background: give the ideas pictures and keep type for the one or two lines worth repeating:`,
          ...(() => {
            const typed = timed.map((tb, i) => sb.beats[tb.index ?? i]).filter(b => b && typeOnly(b));
            // A sketch that fits the line first; else a line that says figures gets its chart ready to
            // paste (the values and the words they land on); else the recipe for its kind of idea.
            const lines = typed.map(b => {
              const f = pictureFor(b.vo ?? ''), chart = !f?.sketch && chartFor(b.vo ?? '', spoken);
              if (f?.sketch) return [b, `the \`${f.sketch}\` sketch (${f.why.toLowerCase().replace(/^this line is /, '')}; \`sketch ${f.sketch}\` prints the beat to paste)`];
              if (chart) return [b, `paste {"block": "canvas", "props": {"source": "…", "chart": ${JSON.stringify(chart)}}} and name each value (its label)`];
              return [b, f?.use ?? null];
            });
            const rest = lines.filter(([, l]) => !l).map(([b]) => b.id);
            return [
              ...lines.filter(([, l]) => l).map(([b, l]) => `    ${b.id}: ${l}`),
              ...(rest.length
                ? [`    ${rest.join(', ')}: a picture of what each line says (a sketch: \`sketch\` lists them; a cast of the film's objects; a chart with a \`say\` on each value), or fold the line into the next picture's narration`]
                : []),
            ];
          })(),
        ]
      : []),
    ...(worst.length
      ? [
          `  stillest (a deliberate reading hold is fine; mark it with pace: "hold"):`,
          ...worst.map(([id, sec]) => {
            const f = fixOf(id);
            return `    ${id} ${sec.toFixed(1)} s still${f?.said ? ` over "${clip(f.said, 90)}"` : ''}: ${f?.fix ?? 'change something on its later words, or shorten it.'}`;
          }),
        ]
      : []),
    // The length the person asked for (`new`/`start --length`): agents cut films to half
    // of it and dropped the brief's facts on the way.
    ...(sb.length && s.seconds < 0.75 * sb.length
      ? [`  length: ${Math.round(s.seconds)} s of the ${sb.length} s asked for${short ? ' (under 60%: not ready)' : ''}. Check BRIEF.md and EVIDENCE.md for the facts the film dropped and give each its own beat and picture (a longer film needs more pictures, not more words over the same ones), or say in DIRECTION.md why it is shorter.`]
      : sb.length && s.seconds > 1.3 * sb.length
        ? [`  length: ${Math.round(s.seconds)} s against the ${sb.length} s asked for: cut to the facts that matter.`]
        : []),
    ...(mute
      ? [`  sound: ${unvoiced.length} of ${narrated.length} beats have narration but no voice, so the film plays their words in silence. Record it free with \`voice DIR --draft\`, or, for a recording (a podcast, an interview), import it with \`ingest DIR --audio FILE\` so the film plays the recording itself.`]
      : []),
    ...(blank.length ? ['  blank under the voice:', ...blank] : []),
    ...(q.findings.some(f => f.kind === 'small')
      ? ['  small in the frame:', ...q.findings.filter(f => f.kind === 'small').slice(0, 5).map(f => `    ${f.beat}: fills ${Math.round(f.fill.w * 100)}% × ${Math.round(f.fill.h * 100)}% of the frame. ${f.fix}`)]
      : []),
    ...(ready ? [] : ['  not ready to hand over: fix the beats above (each is one edit), then run draft again.']),
  ];
  return { share, typeShare, ready, lines };
}
