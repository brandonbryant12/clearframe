// Frame-accurate render: N headless pages each seek + capture a contiguous frame range,
// streaming frames into ffmpeg. Segments are concatenated, then audio is mixed and muxed.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { captureAt, defaultWorkers, launch, openComposition } from './browser.mjs';
import { mix, mux } from './audio.mjs';
import { loadStoryboard, paths } from './project.mjs';
import { serve } from './server.mjs';
import { computeTiming } from './timing.mjs';
import { color, ffmpeg, ffmpegBin, log, slug, writeJSON } from './util.mjs';

function encoder(out, { fps, draft, lossless, width, height }) {
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', lossless ? 'png' : 'mjpeg', '-i', '-',
    // Fixed output size: a stray off-size frame gets scaled, never cropped.
    '-vf', `scale=${width}:${height}:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p`,
    '-c:v', 'libx264', '-preset', draft ? 'veryfast' : lossless ? 'slow' : 'medium', '-crf', draft ? '24' : '16',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-r', String(fps), '-movflags', '+faststart', out,
  ];
  const p = spawn(ffmpegBin(), args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let err = '';
  let broken = null;
  p.stderr.on('data', (d) => { err += d; });
  p.stdin.on('error', (e) => { broken = e; });
  const done = new Promise((res, rej) => p.on('close', (code) => (code === 0 ? res() : rej(new Error(`encoder failed (${code}): ${err}`)))));
  const write = async (buf) => {
    if (broken) throw new Error(`encoder pipe closed: ${err || broken.message}`);
    if (!p.stdin.write(buf)) await new Promise((res) => p.stdin.once('drain', res));
  };
  return { write, end: () => { p.stdin.end(); return done; } };
}

/**
 * Render a project to MP4.
 * opts: { workers, draft, lossless (PNG capture, slower), from, to (seconds), out, audio (default true), scale }
 */
export async function render(root, opts = {}) {
  const sb = loadStoryboard(root);
  const P = paths(root);
  fs.mkdirSync(P.build, { recursive: true });
  const timing = computeTiming(root);
  writeJSON(path.join(P.build, 'timing.json'), timing);
  if (timing.estimated) log.warn('Some beats have no recorded voice yet — timing is estimated. Run `clearframe voice` (or `voice --draft`) first for real timing.');

  const { fps } = timing;
  const scale = opts.scale ?? (opts.draft ? 0.5 : 1);
  const first = Math.max(0, Math.round((opts.from ?? 0) * fps));
  const last = Math.min(timing.frames, Math.round((opts.to ?? timing.duration) * fps));
  const total = last - first;
  if (total <= 0) throw new Error('Nothing to render (empty frame range).');
  const workers = Math.max(1, Math.min(opts.workers ?? defaultWorkers(), Math.ceil(total / 30)));

  const server = await serve(root);
  const browser = await launch({ scale });
  const outW = Math.round((timing.width * scale) / 2) * 2, outH = Math.round((timing.height * scale) / 2) * 2;
  const segDir = path.join(P.build, 'segments');
  fs.rmSync(segDir, { recursive: true, force: true });
  fs.mkdirSync(segDir, { recursive: true });

  log.step(`Rendering ${total} frames @ ${fps}fps (${(total / fps).toFixed(2)}s, ${timing.width}×${timing.height}${scale !== 1 ? ` ×${scale}` : ''}) with ${workers} worker(s)`);
  const started = Date.now();
  let doneFrames = 0;
  let lastDecile = -1;
  const progress = setInterval(() => {
    const pct = (doneFrames / total) * 100;
    const line = `${pct.toFixed(1)}% · ${doneFrames}/${total} frames · ${(doneFrames / ((Date.now() - started) / 1000)).toFixed(1)} fps`;
    if (process.stdout.isTTY) process.stdout.write(`\r  ${color.dim(line)}   `);
    else if (Math.floor(pct / 25) > lastDecile) { lastDecile = Math.floor(pct / 25); console.log(`  ${line}`); }
  }, 500);

  const warnings = new Set();
  const issues = new Set();
  try {
    const per = Math.ceil(total / workers);
    const segments = [];
    await Promise.all(Array.from({ length: workers }, async (_, w) => {
      const a = first + w * per, b = Math.min(last, a + per);
      if (a >= b) return;
      const seg = path.join(segDir, `seg-${String(w).padStart(3, '0')}.mp4`);
      segments[w] = seg;
      const { page, cdp, info, issues: iss } = await openComposition(browser, server.url, { width: timing.width, height: timing.height, scale });
      info.warnings.forEach((x) => warnings.add(x));
      const enc = encoder(seg, { fps, draft: opts.draft, lossless: opts.lossless, width: outW, height: outH });
      const shot = { format: opts.lossless ? 'png' : 'jpeg', quality: opts.draft ? 80 : 95 };
      const size = { width: timing.width, height: timing.height, scale, shot, onFix: (m) => log.dim(`  frame ${m}`) };
      for (let f = a; f < b; f++) {
        await enc.write(await captureAt(page, cdp, f / fps, size));
        doneFrames++;
      }
      await enc.end();
      [...iss.errors, ...iss.failed].forEach((x) => issues.add(x));
      await page.close();
    }));
    clearInterval(progress);
    if (process.stdout.isTTY) process.stdout.write('\n');

    const silent = path.join(P.build, 'video.mp4');
    const list = path.join(segDir, 'list.txt');
    fs.writeFileSync(list, segments.filter(Boolean).map((s) => `file '${s.replace(/'/g, "'\\''")}'`).join('\n'));
    await ffmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', silent]);

    for (const wmsg of warnings) log.warn(wmsg);
    for (const i of issues) log.warn(`page issue: ${i}`);

    const name = opts.out ?? path.join(P.build, `${slug(sb.title ?? path.basename(root))}${opts.draft ? '.draft' : ''}.mp4`);
    let audioFile = null;
    if (opts.audio !== false && first === 0) {
      audioFile = await mix(root, timing, path.join(P.build, 'mix.wav'), sb.mix);
      if (!audioFile) log.dim('  no audio yet (no voice or music files) — rendering silent');
    }
    await mux(silent, audioFile, name);
    fs.rmSync(segDir, { recursive: true, force: true });
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    log.ok(`Rendered ${path.relative(process.cwd(), name)} in ${secs}s`);
    return name;
  } finally {
    clearInterval(progress);
    await browser.close();
    await server.close();
  }
}
