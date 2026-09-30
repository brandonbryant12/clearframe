// Break a reference video down into what a director borrows: its cut rhythm, a keyframe per
// shot, its palette and how much it moves. The model reads REFERENCE.md and the sheet, then
// writes what to keep and what to change in DIRECTION.md.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ffmpeg, writeJSON } from './util.mjs';
import { THEMES } from '../../fframes/catalog.mjs';

const probe = file => {
  const r = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration:stream=codec_type,width,height,avg_frame_rate',
      '-of',
      'json',
      file,
    ],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) throw new Error(`Cannot read ${file}`);
  const j = JSON.parse(r.stdout),
    v = j.streams.find(s => s.codec_type === 'video');
  if (!v) throw new Error('The reference has no video stream');
  const [n, d] = (v.avg_frame_rate ?? '0/1').split('/').map(Number);
  return {
    duration: Number(j.format.duration),
    width: v.width,
    height: v.height,
    fps: d ? n / d : 0,
    audio: j.streams.some(s => s.codec_type === 'audio'),
  };
};
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const rgb = h =>
  h
    .slice(1)
    .match(/../g)
    .map(x => parseInt(x, 16));
const spark = values => {
  const bars = '▁▂▃▄▅▆▇█',
    max = Math.max(...values, 1e-6);
  return values.map(v => bars[Math.min(7, Math.floor((v / max) * 7.999))]).join('');
};

export async function analyseReference(video, out) {
  const info = probe(video);
  fs.mkdirSync(out, { recursive: true });
  // Cuts: frames whose scene-change score is high.
  const log = await ffmpeg(['-i', video, '-an', '-vf', "select='gt(scene,0.28)',showinfo", '-f', 'null', '-'], {
    quiet: false,
  });
  const hardCuts = [...log.matchAll(/pts_time:([\d.]+)/g)]
    .map(m => Number(m[1]))
    .filter(t => t > 0.2 && t < info.duration - 0.2);
  // Palette and motion from tiny frames at 4 fps.
  const w = 32,
    h = 18,
    raw = spawnSync(
      'ffmpeg',
      ['-v', 'error', '-i', video, '-an', '-vf', `fps=4,scale=${w}:${h}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
      { maxBuffer: 1 << 28 },
    ).stdout;
  const size = w * h * 3,
    frames = Math.floor(raw.length / size);
  const diffs = [0];
  for (let f = 1; f < frames; f++) {
    let sum = 0;
    for (let i = 0; i < size; i++) sum += Math.abs(raw[f * size + i] - raw[(f - 1) * size + i]);
    diffs.push(sum / size);
  }
  // Designed transitions (floods, irises, wipes) are bursts of change, not single hard cuts.
  const sorted = [...diffs].sort((a, b) => a - b),
    base = Math.max(1, sorted[Math.floor(sorted.length / 2)]);
  const bursts = [];
  diffs.forEach((d, f) => {
    if (d > base * 4 && d >= (diffs[f - 1] ?? 0) && d >= (diffs[f + 1] ?? 0)) bursts.push(f / 4);
  });
  const edgesIn = [...hardCuts, ...bursts].sort((a, b) => a - b).filter(t => t > 0.4 && t < info.duration - 0.4);
  const edges = [0, ...edgesIn.filter((t, i, a) => !i || t - a[i - 1] > 1.2), info.duration];
  const shots = edges
    .slice(0, -1)
    .map((t, i) => ({
      index: i + 1,
      start: +t.toFixed(2),
      end: +edges[i + 1].toFixed(2),
      seconds: +(edges[i + 1] - t).toFixed(2),
      kind: hardCuts.some(c => Math.abs(c - t) < 0.3) ? 'cut' : i ? 'transition' : 'open',
    }));
  // One keyframe per shot (evenly sampled when there are many), tiled into a sheet.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-ref-'));
  try {
    const picks =
      shots.length <= 30 ? shots : Array.from({ length: 30 }, (_, i) => shots[Math.floor((i * shots.length) / 30)]);
    for (const [i, s] of picks.entries())
      await ffmpeg([
        '-y',
        '-ss',
        String(s.start + s.seconds * 0.5),
        '-i',
        video,
        '-frames:v',
        '1',
        '-vf',
        'scale=360:-2',
        path.join(tmp, `k-${String(i).padStart(3, '0')}.png`),
      ]);
    const columns = Math.min(5, picks.length);
    await ffmpeg([
      '-y',
      '-framerate',
      '1',
      '-i',
      path.join(tmp, 'k-%03d.png'),
      '-vf',
      `tile=${columns}x${Math.ceil(picks.length / columns)}:padding=6:margin=6:color=0x161b22`,
      '-frames:v',
      '1',
      path.join(out, 'sheet.png'),
    ]);
    // A fine strip of the first seconds shows how things enter.
    await ffmpeg([
      '-y',
      '-t',
      String(Math.min(4, info.duration)),
      '-i',
      video,
      '-vf',
      'fps=6,scale=240:-2,tile=8x3:padding=4:color=0x161b22',
      '-frames:v',
      '1',
      path.join(out, 'opening.png'),
    ]);
    const buckets = new Map();
    for (let i = 0; i + 2 < frames * size; i += 3) {
      const key = ((raw[i] >> 4) << 8) | ((raw[i + 1] >> 4) << 4) | (raw[i + 2] >> 4);
      const b = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      b.n++;
      b.r += raw[i];
      b.g += raw[i + 1];
      b.b += raw[i + 2];
      buckets.set(key, b);
    }
    const total = frames * w * h,
      colors = [];
    for (const b of [...buckets.values()].sort((a, c) => c.n - a.n)) {
      const c = [b.r / b.n, b.g / b.n, b.b / b.n];
      const near = colors.find(x => dist(x.rgb, c) < 42);
      if (near) near.n += b.n;
      else colors.push({ rgb: c, n: b.n });
      if (colors.length >= 12) break;
    }
    const palette = colors
      .sort((a, b) => b.n - a.n)
      .slice(0, 6)
      .map(c => ({ hex: hex(c.rgb), share: +((100 * c.n) / total).toFixed(1), rgb: c.rgb }));
    const sat = ([r, g, b]) => (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(1, Math.max(r, g, b));
    const bg = palette[0],
      accent =
        palette.slice(1).sort((a, b) => sat(b.rgb) * Math.sqrt(b.share) - sat(a.rgb) * Math.sqrt(a.share))[0] ??
        palette[0];
    const theme = Object.entries(THEMES)
      .map(([name, t]) => ({ name, d: dist(rgb(t.bg), bg.rgb) * 1.5 + dist(rgb(t.accent), accent.rgb) }))
      .sort((a, b) => a.d - b.d)[0].name;
    const perSecond = [];
    diffs.forEach((d, f) => {
      if (f) {
        const sec = Math.floor(f / 4);
        perSecond[sec] = (perSecond[sec] ?? 0) + d / 4;
      }
    });
    const energy = perSecond.map(v => +(v ?? 0).toFixed(1)),
      mean = energy.reduce((a, b) => a + b, 0) / Math.max(1, energy.length);
    const lengths = shots.map(s => s.seconds).sort((a, b) => a - b),
      median = lengths[Math.floor(lengths.length / 2)];
    const summary = {
      video: path.resolve(video),
      ...info,
      shots: shots.length,
      cutsPerMinute: +((60 * (shots.length - 1)) / info.duration).toFixed(1),
      medianShot: median,
      palette: palette.map(({ rgb, ...p }) => p),
      suggestedTheme: { base: theme, bg: bg.hex, accent: accent.hex },
      motion: {
        perSecond: energy,
        mean: +mean.toFixed(1),
        feel: mean < 3 ? 'calm' : mean < 9 ? 'steady' : 'energetic',
      },
    };
    writeJSON(path.join(out, 'reference.json'), { ...summary, shotList: shots });
    fs.writeFileSync(
      path.join(out, 'REFERENCE.md'),
      `# Reference: ${path.basename(video)}

${info.width}×${info.height} · ${info.fps.toFixed(2)} fps · ${info.duration.toFixed(1)} s · ${info.audio ? 'with audio' : 'silent'}

Open \`sheet.png\` (one keyframe per shot, left to right) and \`opening.png\` (the first four seconds at 6 fps). Describe each shot's layout, type roles, how things enter and how it cuts, then write **Keep** and **Change** in DIRECTION.md. Borrow structure and craft, never footage, logos or proprietary artwork.

## Rhythm
- ${shots.length} shots (${shots.filter(x => x.kind === 'cut').length} hard cuts, ${shots.filter(x => x.kind === 'transition').length} designed transitions), ${summary.cutsPerMinute} changes per minute; median shot ${median.toFixed(1)} s (shortest ${lengths[0].toFixed(1)} s, longest ${lengths.at(-1).toFixed(1)} s).
- Shots: ${shots.map(s => `${s.index}: ${s.start.toFixed(1)}–${s.end.toFixed(1)}s${s.kind === 'transition' ? ' (after a transition)' : ''}`).join(' · ')}
- Match it: set beat lengths (or \`hold\`) near the median; a shot under 1 s is a cut on a beat, not a scene.

## Palette
${palette.map(p => `- ${p.hex} — ${p.share}% of the frame`).join('\n')}
- Closest ClearFrame palette: **${theme}**. Override to match: \`"theme": { "base": "${theme}", "bg": "${bg.hex}", "accent": "${accent.hex}" }\` (check contrast warnings).

## Motion
- Energy per second: ${spark(energy)} (mean ${mean.toFixed(1)}: **${summary.motion.feel}**).
- ${summary.motion.feel === 'energetic' ? 'Use snappy motion at high intensity, cuts and whips, stepped or kinetic type.' : summary.motion.feel === 'steady' ? 'Use gentle or spring motion around 0.6–0.8 intensity; let something move in every held frame.' : 'Use gentle motion at low intensity, long holds and fades; motion comes from the camera and slow drifts.'}
`,
    );
    return summary;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
