#!/usr/bin/env node
// Every ClearFrame canvas × every frame rate through the renderer: a two-beat film with a
// block, a dissolve and a native stage (a packet on a link, text pinned to the screen, motion
// blur) rendered in full and as a mid-motion range. Checks the decoded dimensions, frame rate
// and frame count, and that a still drawn directly matches the same frame decoded from the full
// film and from the range (PSNR), so stills, ranges and films share one clock.
//
//   codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node scripts/engine-formats.mjs OUT
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { prepareProject } from '../film/prepare.mjs';
import { engineCommand } from '../scene/engine.mjs';
import { validateVideo } from '../film/render.mjs';
import { CANVASES, FRAME_RATES } from '../film/catalog.mjs';

const OUT = path.resolve(process.argv[2] ?? 'build/engine-formats');
fs.mkdirSync(OUT, { recursive: true });
const psnr = (a, b) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', a, '-i', b, '-lavfi', '[0][1]psnr', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /average:(inf|[\d.]+)/.exec(r.stderr);
  return m ? (m[1] === 'inf' ? 99 : Number(m[1])) : null;
};
const decode = (video, n, file) => spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', video, '-vf', `select=eq(n\\,${n})`, '-fps_mode', 'passthrough', '-frames:v', '1', file]);
const rows = [];
for (const [w, h] of CANVASES)
  for (const fps of FRAME_RATES) {
    const name = `${w}x${h}@${fps}`;
    const dir = path.join(OUT, name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const k = 1080 / Math.min(w, h),
      [W, H] = [w * k, h * k];
    fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({
      title: name, music: false, captions: false, theme: 'paper', format: { width: w, height: h, fps },
      sources: [{ id: 's', title: 'Format test' }],
      beats: [
        { id: 'a', block: 'statement', duration: 1.5, props: { text: 'Formats and rates' } },
        {
          id: 'b', block: 'stage', duration: 2, transition: 'dissolve',
          props: {
            title: 'A packet in flight', source: 'Format test', shutter: 0.5, samples: 4,
            actors: [{ id: 'x', label: 'From', x: W * 0.25, y: H * 0.55 }, { id: 'y', label: 'To', x: W * 0.75, y: H * 0.55 }],
            links: [{ from: 'x', to: 'y' }],
            events: [{ do: 'send', from: 'x', to: 'y', at: 0.4, dur: 1.2 }],
            over: [{ type: 'text', text: name, x: W / 2, y: H * 0.85, anchor: 'middle', size: 40, font: 'mono', fill: 'muted', enter: 'none', camera: false }],
          },
        },
      ],
    }));
    const row = { format: name };
    try {
      const ctx = await prepareProject(dir, { draft: true });
      const frames = ctx.job.frames;
      const full = path.join(dir, 'full.mp4'),
        range = path.join(dir, 'range.mp4');
      await engineCommand(ctx, 'render', ['-o', full], true);
      const probe = validateVideo(full, { width: w, height: h, fps, frames });
      // A mid-motion range: the packet is travelling at its first frame.
      const a = ctx.job.beats[1].start_frame + Math.round(0.9 * fps),
        b = Math.min(frames, a + Math.round(0.5 * fps));
      await engineCommand(ctx, 'render', [`${a}..${b}`, '--draft', '--scale', '1', '-o', range], true);
      validateVideo(range, { width: w, height: h, fps, frames: b - a });
      const shots = path.join(dir, 'shots');
      await engineCommand(ctx, 'frame', [String(a), '-o', shots], true);
      const still = path.join(shots, fs.readdirSync(shots)[0]);
      decode(full, a, path.join(dir, 'from-full.png'));
      decode(range, 0, path.join(dir, 'from-range.png'));
      decode(full, a + 1, path.join(dir, 'neighbour.png'));
      Object.assign(row, {
        ok: true, frames, size: `${probe.video.width}x${probe.video.height}`, rate: probe.video.avg_frame_rate,
        stillVsFull: psnr(still, path.join(dir, 'from-full.png')), stillVsRange: psnr(still, path.join(dir, 'from-range.png')),
        stillVsNextFrame: psnr(still, path.join(dir, 'neighbour.png')),
      });
      row.ok = row.stillVsFull >= 35 && row.stillVsRange >= 35 && row.stillVsFull > row.stillVsNextFrame;
    } catch (e) {
      Object.assign(row, { ok: false, error: e.message.slice(0, 400) });
    }
    rows.push(row);
    console.log(`${row.ok ? '✓' : '✗'} ${name} ${row.size ?? ''} ${row.rate ?? ''} frames ${row.frames ?? '—'} still/full ${row.stillVsFull?.toFixed(1) ?? '—'} dB, still/range ${row.stillVsRange?.toFixed(1) ?? '—'} dB, still/next ${row.stillVsNextFrame?.toFixed(1) ?? '—'} dB ${row.error ?? ''}`);
    for (const f of ['full.mp4', 'range.mp4']) fs.rmSync(path.join(dir, f), { force: true });
  }
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(rows, null, 2));
console.log(`${rows.filter(r => r.ok).length}/${rows.length} formats pass`);
