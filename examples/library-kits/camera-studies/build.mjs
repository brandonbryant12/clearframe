// Bind native editorial cues to the exact retained source clip phase manifests.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { loadStoryboard } from '../../../engine/lib/project.mjs';
import { computeTiming } from '../../../engine/lib/timing.mjs';
import { createJob } from '../../../fframes/job.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const bytes = fs.readFileSync(path.join(root, 'inputs.json')), inputs = JSON.parse(bytes);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const bindings = [];
const heldFrames = new Map();
for (const item of inputs.cases) for (const preset of ['landscape', 'vertical']) {
  const name = `${item.id}-${preset}`, mediaName = `${item.mechanism}-${preset}`;
  const media = path.join(root, 'media', mediaName), receipt = JSON.parse(fs.readFileSync(path.join(media, 'receipt.json')));
  const clip = fs.readFileSync(path.join(media, 'clip.mp4'));
  if (receipt.status !== 'ready-for-review' || receipt.outputs['clip.mp4'].sha256 !== sha(clip) || receipt.config.loop) throw new Error(`Unverified one-way clip: ${name}`);
  if (!heldFrames.has(mediaName)) {
    const finalFrame = path.join(media, 'final-frame.png');
    const decoded = spawnSync('ffmpeg', ['-v', 'error', '-threads', '2', '-filter_threads', '2', '-i', path.join(media, 'clip.mp4'),
      '-vf', `select=eq(n\\,${receipt.config.frames - 1})`, '-frames:v', '1', '-threads', '2', '-update', '1', '-y', finalFrame], { encoding: 'utf8' });
    if (decoded.status !== 0) throw new Error(decoded.stderr || 'Cannot decode final frame');
    const holdFile = path.join(media, 'final-hold.mp4');
    const encoded = spawnSync('ffmpeg', ['-v', 'error', '-threads', '2', '-filter_threads', '2', '-i', path.join(media, 'clip.mp4'),
      '-frames:v', String(2 * receipt.config.fps), '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '0', '-pix_fmt', 'yuv420p',
      '-vf', `select=eq(n\\,${receipt.config.frames - 1}),setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=2`, '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-colorspace', 'bt709', '-color_range', 'tv', '-an', '-y', holdFile], { encoding: 'utf8' });
    if (encoded.status !== 0) throw new Error(encoded.stderr || 'Cannot encode static hold');
    const yuvFrame = (file, index) => {
      const decoded = spawnSync('ffmpeg', ['-v', 'error', '-threads', '2', '-filter_threads', '2', '-i', file,
        '-vf', `select=eq(n\\,${index})`, '-frames:v', '1', '-threads', '2', '-pix_fmt', 'yuv420p', '-f', 'rawvideo', '-'], { maxBuffer: 4*1024*1024 });
      if (decoded.status !== 0 || !decoded.stdout.length) throw Error('Cannot verify held YUV frame');
      return sha(decoded.stdout);
    };
    const sourceYuvSha256 = yuvFrame(path.join(media, 'clip.mp4'), receipt.config.frames - 1);
    if ([0, 2*receipt.config.fps-1].some(n => yuvFrame(holdFile, n) !== sourceYuvSha256)) throw Error('Static hold must preserve source YUV pixels');
    const bytes = fs.readFileSync(finalFrame);
    heldFrames.set(mediaName, bytes);
    fs.writeFileSync(path.join(media, 'hold.json'), JSON.stringify({ sourceClipSha256: sha(clip), sourceFrame: receipt.config.frames - 1,
      sourceFps: receipt.config.fps, file: 'final-frame.png', sha256: sha(bytes), holdClip: 'final-hold.mp4', holdClipSha256: sha(fs.readFileSync(holdFile)),
      sourceYuvSha256, holdYuvEndpointsEqual: true, purpose: 'Explicit native reading hold; lossless source-YUV final frame clone, no new motion or simulation.' }, null, 2) + '\n');
  }
  const portrait = preset === 'vertical', width = portrait ? 1080 : 1920, height = portrait ? 1920 : 1080, margin = width * (portrait ? .105 : .08);
  const phases = receipt.config.motion.phases;
  if (Object.keys(item.labels).length !== phases.length || phases.some(p => !item.labels[p.id])) throw new Error(`Phase labels do not match ${name}`);
  const elements = [
    {id:'header-band',type:'rect',x:0,y:0,w:width,h:height*(portrait?.33:.31),fill:'#f3f2ef',at:0,enter:'none'},
    {id:'footer-band',type:'rect',x:0,y:height*.84,w:width,h:height*.16,fill:'#f3f2ef',at:0,enter:'none'},
    {id:'qualification',type:'text',text:item.source,x:margin,y:height*(portrait?.885:.90),size:width*(portrait?.033:.029),width:width-2*margin,height:height*.065,font:'text',fill:'ink',at:0,enter:'none'},
    { id: 'subject', type: 'text', text: item.subject, x: margin, y: height * (portrait ? .12 : .10), size: width * (portrait ? .028 : .024), width: width - 2 * margin, height: height * .04, fill: 'ink', at: 0, enter: 'none', font: 'text' },
    { id: 'title', type: 'text', text: item.title, x: margin, y: height * (portrait ? .18 : .165), size: width * (portrait ? .052 : .036), width: width - 2 * margin, height: height * (portrait ? .105 : .082), ...(portrait ? {} : { fit: width - 2 * margin }), fill: 'ink', at: 0, enter: 'none', font: 'display' },
    ...phases.map((phase, index) => ({ id: `phase-${phase.id}`, type: 'text', text: item.labels[phase.id],
      x: margin, y: height * (portrait ? .30 : .26), size: width * (portrait ? .037 : .027), width: width - 2 * margin, height: height * .068,
      font: 'text', fill: 'ink', at: phase.startSeconds, enter: index === 0 ? 'none' : 'fade', dur: .12,
      ...(index < phases.length - 1 ? { exit: 'fade', exitAt: phases[index + 1].startSeconds - .12, exitDur: .12 } : {}) }))
  ];
  const storyboard = { version: 2, title: item.title, format: { preset, fps: 30 }, theme: 'research-paper', type: 'inter', backdrop: 'none',
    motion: { preset: 'gentle', intensity: .3 }, transition: 'cut', sfx: 'off', captions: false, music: false,
    assets: [{ id: 'mechanism', kind: 'clip', file: 'media/clip.mp4' }, { id: 'settled', kind: 'clip', file: 'media/final-hold.mp4' }],
    sources: [{ claim: `${item.subject}: ${item.source}`, source: 'Original ClearFrame procedural artwork and fictional explanatory scenario.' }],
    beats: [{ id: 'mechanism', block: 'canvas', duration: receipt.config.frames / receipt.config.fps, camera: 'none', exit: 'none',
      plate: { asset: 'mechanism', side: 'full', treatment: 'none', drift: 'none', scrim: 0, loop: false },
      props: { elements } },
      { id: 'reading-hold', block: 'canvas', duration: 2, camera: 'none', exit: 'none', transition: 'cut',
        plate: { asset: 'settled', side: 'full', treatment: 'none', drift: 'none', scrim: 0, loop: false },
        props: {
          elements: [...elements.filter(e=>!e.id.startsWith('phase-')), { ...elements.at(-1), at: 0, enter: 'none', dur: 0 }] } }
    ] };
  const dir = path.join(root, 'specimens', name);
  fs.mkdirSync(path.join(dir, 'media'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'media/clip.mp4'), clip);
  fs.writeFileSync(path.join(dir, 'media/final-frame.png'), heldFrames.get(mediaName));
  fs.copyFileSync(path.join(media, 'final-hold.mp4'), path.join(dir, 'media/final-hold.mp4'));
  fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(storyboard, null, 2) + '\n');
  const job = createJob(loadStoryboard(dir), computeTiming(dir), { draft: true });
  if (job.errors.length) throw new Error(`${name}: ${job.errors.join('\n')}`);
  bindings.push({ name, mediaName, sourceClipSha256: sha(clip), storyboardSha256: sha(fs.readFileSync(path.join(dir, 'storyboard.json'))),
    sourceFps: receipt.config.fps, sourceFrames: receipt.config.frames, nativeFps: 30, nativeFrames: 300,
    heldSourceFrame: receipt.config.frames - 1, heldImageSha256: sha(heldFrames.get(mediaName)), holdClipSha256: sha(fs.readFileSync(path.join(media, 'final-hold.mp4'))), explicitStaticHoldSeconds: 2,
    cueSeconds: Object.fromEntries(phases.map(p => [p.id, p.startSeconds])), finalHoldSeconds: 10 - phases.at(-1).startSeconds });
}
fs.writeFileSync(path.join(root, 'bindings.json'), JSON.stringify({ version: 1, inputSha256: sha(bytes), bindings }, null, 2) + '\n');
console.log(`Compiled ${bindings.length} native specimens with source-phase cues.`);
