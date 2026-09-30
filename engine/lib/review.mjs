// Encoded-output review, inspired by video-use's boundary-focused filmstrip workflow.
// Independent implementation. No extra renderer, server or runtime dependency.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { computeTiming } from './timing.mjs';
import { ffmpeg, readJSON, writeJSON } from './util.mjs';
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const escape = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function reviewSamples(timing, { beat } = {}) {
  const selected = beat ? timing.beats.filter(b => b.id === beat) : timing.beats;
  if (!selected.length) throw new Error(`No beat ${beat}`);
  const samples = new Map();
  const add = (frame, reason) => {
    frame = Math.max(0, Math.min(timing.frames - 1, frame));
    if (!samples.has(frame)) samples.set(frame, { frame, time: frame / timing.fps, reasons: [] });
    samples.get(frame).reasons.push(reason);
  };
  for (const b of selected) {
    const start = Math.round(b.start * timing.fps), end = Math.round(b.end * timing.fps);
    if (start) add(start - 1, `Before ${b.id}`);
    add(start, `${b.id}: first frame`);
    add(Math.min(end - 1, start + Math.ceil(timing.fps * .2)), `${b.id}: entrance`);
    add(end - 1, `${b.id}: last frame`);
    const words = b.vo?.words ?? [];
    for (const word of words.length > 1 ? [words[0], words.at(-1)] : words) {
      const first = Math.ceil(word.t0 * timing.fps - 1e-7), after = Math.ceil(word.t1 * timing.fps - 1e-7);
      add(first - 1, `${b.id}: before “${word.w}”`);
      add(first, `${b.id}: start “${word.w}”`);
      add(after - 1, `${b.id}: last “${word.w}”`);
      add(after, `${b.id}: after “${word.w}”`);
    }
  }
  if (samples.size > 512) throw new Error('More than 512 review frames; use --beat to review one beat at a time.');
  return [...samples.values()].sort((a, b) => a.frame - b.frame);
}

export async function reviewProject(root, { video, beat } = {}) {
  const file = path.resolve(video ?? path.join(root, 'build/video.mp4'));
  const report = readJSON(`${file}.json`);
  if (sha(fs.readFileSync(file)) !== report.outputSha256) throw new Error('Video changed since rendering; render again before review.');
  for (const [relative, hash] of Object.entries(report.hashes)) {
    if (sha(fs.readFileSync(path.join(root, relative))) !== hash) throw new Error(`Input changed since rendering: ${relative}. Render again before review.`);
  }
  const timing = computeTiming(root);
  if (timing.frames !== report.frames || timing.fps !== report.fps) throw new Error('Timeline differs from the encoded video. Render again before review.');
  const samples = reviewSamples(timing, { beat });
  const dir = path.join(root, 'build', `review-${crypto.randomUUID()}`);
  fs.mkdirSync(dir, { recursive: true });
  try {
    const select = samples.map(s => `eq(n\\,${s.frame})`).join('+');
    await ffmpeg(['-i', file, '-map', '0:v:0', '-an', '-vf', `select=${select},scale=360:-2`, '-fps_mode', 'vfr', '-start_number', '0', '-threads', '1', path.join(dir, 'frame-%04d.png')]);
    const images = fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort();
    if (images.length !== samples.length) throw new Error(`Expected ${samples.length} decoded review frames; received ${images.length}`);
    samples.forEach((s, i) => { s.image = images[i]; });
    // One tiled image of every sample, in order, so a reviewer (human or model) reads it at a glance.
    await ffmpeg(['-y', '-framerate', '1', '-i', path.join(dir, 'frame-%04d.png'), '-vf', `scale=240:-2,tile=8x${Math.ceil(samples.length / 8)}:padding=4:margin=4:color=0x161b22`, '-frames:v', '1', '-threads', '1', path.join(dir, 'strip.png')]);
    writeJSON(path.join(dir, 'review.json'), { video: file, outputSha256: report.outputSha256, inputId: report.inputId, draft: report.draft, samples });
    const cards = samples.map(s => `<figure><img src="${s.image}" alt="Decoded frame ${s.frame}"><figcaption><b>${s.time.toFixed(3)}s · frame ${s.frame}</b><br>${s.reasons.map(escape).join('<br>')}</figcaption></figure>`).join('\n');
    const playback = `<video controls preload="metadata" style="width:min(100%,800px);max-height:550px;margin-bottom:24px" src="${escape(path.relative(dir,file).split(path.sep).join('/'))}"></video>`;
    fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Video boundary review</title><style>body{background:#151b24;color:#f5f3ed;font:16px system-ui;margin:32px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:20px}figure{margin:0;background:#26303c;padding:12px}img{width:100%;max-height:440px;object-fit:contain}figcaption{padding-top:10px;line-height:1.5}p{max-width:850px;color:#b9c5d3}</style><h1>Video boundary review</h1><p>Decoded from ${escape(path.basename(file))}. ${report.draft ? 'Draft timing: estimates may be present.' : 'Final render.'} Inspect joins, caption visibility and word starts/ends. Frame labels belong to this review page only. Listen to the MP4 to judge synchronization and sound.</p>${playback}<main>${cards}</main>`);
    return `${path.join(dir, 'index.html')}\n${path.join(dir, 'strip.png')} (all ${samples.length} frames in order; labels in review.json)`;
  } catch (error) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw error;
  }
}
