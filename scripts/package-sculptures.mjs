#!/usr/bin/env node
// Bundle prepared procedural assets into a portable offline gallery; no render.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { sculptures } from '../engine/lib/sculptures.mjs';
const [input, destination] = process.argv.slice(2);
if (!input || !destination) throw new Error('Usage: package-sculptures.mjs ASSET-ROOT NEW-OUTPUT-DIR');
const out = path.resolve(destination), root = path.resolve(input);
if (fs.existsSync(out)) throw new Error('The output directory exists. Choose a new one.');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const known = new Set(sculptures().map(s => s.id));
const ids = fs.readdirSync(root).filter(id => fs.existsSync(path.join(root, id, 'receipt.json'))).sort();
if (!ids.length) throw new Error('No retained sculpture receipts found.');
for (const id of ids) if (!known.has(id)) throw new Error(`Unknown sculpture receipt directory: ${id}`);
const entries = ids.map(id => {
  const source = path.join(root, id), receiptBytes = fs.readFileSync(path.join(source, 'receipt.json')), receipt = JSON.parse(receiptBytes);
  if (receipt.status !== 'ready-for-review' || !receipt.outputs['clip.mp4']) throw new Error(`${id} is not a completed clip`);
  for (const key of ['width', 'height', 'frames', 'fps']) {
    if (!Number.isSafeInteger(receipt.config[key]) || receipt.config[key] <= 0) throw new Error(`${id} has invalid ${key}`);
  }
  const configBytes = fs.readFileSync(path.join(source, 'render-config.json')), config = JSON.parse(configBytes);
  for (const [key, value] of Object.entries(receipt.config)) {
    if (JSON.stringify(config[key]) !== JSON.stringify(value)) throw new Error(`${id} configuration differs from its receipt: ${key}`);
  }
  for (const name of ['clip.mp4', 'poster.png', 'scene.blend']) {
    if (sha(fs.readFileSync(path.join(source, name))) !== receipt.outputs[name].sha256) throw new Error(`${id}/${name} changed since rendering`);
  }
  for (const [name, hash] of Object.entries(receipt.sourceHashes)) {
    if (sha(fs.readFileSync(path.join(source, 'source', path.basename(name)))) !== hash) throw new Error(`${id}/${name} retained source changed`);
  }
  return { id, source, receipt, receiptBytes, configBytes };
});
fs.mkdirSync(path.dirname(out), { recursive: true });
const staging = fs.mkdtempSync(path.join(path.dirname(out), '.sculpture-gallery-'));
try {
  fs.copyFileSync(new URL('../LICENSE', import.meta.url), path.join(staging, 'LICENSE'));
  for (const { id, source, receipt: r, receiptBytes, configBytes } of entries) {
    const dir = path.join(staging, id); fs.mkdirSync(dir);
    for (const file of ['clip.mp4', 'poster.png', 'scene.blend']) {
      fs.copyFileSync(path.join(source, file), path.join(dir, file));
      if (sha(fs.readFileSync(path.join(dir, file))) !== r.outputs[file].sha256) throw new Error(`${id}/${file} changed while packaging`);
    }
    fs.writeFileSync(path.join(dir, 'receipt.json'), receiptBytes);
    fs.writeFileSync(path.join(dir, 'render-config.json'), configBytes);
    fs.mkdirSync(path.join(dir, 'source'));
    for (const [name, hash] of Object.entries(r.sourceHashes)) {
      const file = path.basename(name);
      fs.copyFileSync(path.join(source, 'source', file), path.join(dir, 'source', file));
      if (sha(fs.readFileSync(path.join(dir, 'source', file))) !== hash) throw new Error(`${id}/${name} source changed while packaging`);
    }
    fs.writeFileSync(path.join(dir, 'asset.json'), JSON.stringify({ version: 1, id, title: r.title, description: r.recipe.description, use: r.recipe.use,
      copy: r.recipe.copy, metaphor: r.recipe.metaphor, license: 'MIT; original procedural artwork', provenance: 'Original ClearFrame recipe; no external models or textures.',
      kind: 'clip', file: 'clip.mp4', poster: 'poster.png', editableScene: 'scene.blend', loop: r.config.loop,
      width: r.config.width, height: r.config.height, duration: r.config.frames / r.config.fps, fps: r.config.fps,
      configuration: r.config, sourceHashes: r.sourceHashes, outputs: r.outputs,
      blender: { version: r.blender.blenderVersion, hash: r.blender.blenderBuildHash, samples: r.blender.samples, engine: r.blender.engine, requiresAutoExec: false },
      mechanicalStatus: r.status, visualAcceptance: 'Review in the context of the destination film.' }, null, 2) + '\n');
  }
  const cards = entries.map(({ id, receipt: r }) => `<article class="card">
    <video controls ${r.config.loop ? 'loop ' : ''}muted playsinline preload="none" poster="${id}/poster.png" aria-label="${esc(r.title)} ${r.config.loop ? 'looping' : 'one-way'} 3D study"><source src="${id}/clip.mp4" type="video/mp4"></video>
    <div class="copy"><p class="meta">${r.config.width} × ${r.config.height} · ${r.config.frames / r.config.fps}s · ${r.config.fps} fps</p>
    <h2>${esc(r.title)}</h2><p>${esc(r.recipe.description)}</p><p class="use">${esc(r.recipe.use)}</p>
    <details><summary>Direction &amp; provenance</summary><p>${esc(r.recipe.copy)}</p><p>${esc(r.recipe.metaphor)}</p><code>clearframe sculpture ${id} --out NEW-DIR</code></details>
    <nav aria-label="${esc(r.title)} files"><a href="${id}/clip.mp4" download>MP4 ↗</a><a href="${id}/scene.blend" download>Editable scene ↗</a><a href="${id}/asset.json">Receipt ↗</a></nav></div></article>`).join('\n');
  fs.writeFileSync(path.join(staging, 'index.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ClearFrame — Material operations</title>
<style>
:root{color-scheme:light;--paper:#f2f0e9;--ink:#242821;--muted:#596054;--line:#ced0c5;--accent:#3e604c}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1480px;margin:auto;padding:52px 44px 64px}.eyebrow{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);margin:0 0 22px}header{display:grid;grid-template-columns:1.2fr 1fr;align-items:end;gap:72px;border-bottom:1px solid var(--line);padding-bottom:35px;margin-bottom:34px}h1{font:clamp(48px,5.5vw,86px)/.99 Georgia,serif;letter-spacing:-.045em;margin:0}header p{max-width:500px;color:var(--muted);margin:0}header p+p{margin-top:12px;font-size:13px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:44px 30px}.card{min-width:0;border-bottom:1px solid var(--line);padding-bottom:24px}video{display:block;width:100%;aspect-ratio:16/9;background:#e4e4df;object-fit:contain;border-radius:2px}.copy{padding:18px 2px 0}.meta{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:0 0 5px}h2{font:31px/1.15 Georgia,serif;letter-spacing:-.02em;margin:0 0 12px}.copy p{margin:0 0 10px}.use{font-size:14px;color:var(--muted)}details{margin:15px 0;font-size:14px}summary{cursor:pointer;font-weight:600}details p{margin-top:10px!important}code{display:block;white-space:normal;overflow-wrap:anywhere;font-size:12px}nav{display:flex;gap:20px;flex-wrap:wrap}a{color:var(--accent);font-size:13px;text-decoration-thickness:1px;text-underline-offset:4px}a:focus-visible,summary:focus-visible{outline:2px solid var(--accent);outline-offset:4px}footer{margin-top:42px;color:var(--muted);font-size:13px;max-width:870px}@media(max-width:800px){main{padding:28px 20px}header{grid-template-columns:1fr;gap:22px}h1{font-size:56px}.grid{grid-template-columns:1fr;gap:30px}h2{font-size:29px}}
</style></head><body><main><header><div><p class="eyebrow">ClearFrame / Original asset studies</p><h1>Material<br>operations.</h1></div><div><p>Original objects with distinct ways of moving. Ceramic opens. Metal separates. A ribbon connects. Weights balance. Light reveals space. Layers expose what sits beneath. Choices rise. A missing piece completes a connection.</p><p>Play a study to inspect its motion. Starting another pauses the previous one. Download the clip or open its baked Blender scene; add factual text and evidence in the native film.</p></div></header><section class="grid" aria-label="${entries.length} original 3D studies">${cards}</section><footer>Original procedural geometry with no external models or textures. These are qualitative art studies; shapes, counts and motion do not encode factual measurements. Each package includes recipe sources, asset hashes and a baked scene that opens without Python auto-execution. Judge the motion, crop and copy placement in your own film.</footer></main><script>const videos=[...document.querySelectorAll('video')];for(const video of videos)video.addEventListener('play',()=>{for(const other of videos)if(other!==video)other.pause()});document.addEventListener('visibilitychange',()=>{if(document.hidden)videos.forEach(video=>video.pause())});</script></body></html>`);
  fs.writeFileSync(path.join(staging, 'README.md'), `# Material operations\n\nOpen index.html for the offline gallery. Nothing autoplays. Each folder contains a prepared clip, poster, editable baked scene, original recipe source, full render receipt and asset.json with hashes. Reuse the clip under native film graphics; changing a headline does not need Blender.\n\nThese original sources and procedural artwork use the repository's MIT license. See docs/sculptures.md in ClearFrame for generation, integration, verification and creative guidance. Baked scenes can render with automatic Python execution disabled. The source recipes provide easier parameter changes.\n\nRebuild a gallery from retained asset passes with:\n\n    node scripts/package-sculptures.mjs /path/to/asset-root NEW-GALLERY-DIR\n\nThe retained render-config.json records the original rendering paths. Use the CLI with a fresh output directory to regenerate it elsewhere. Full PNG sequences stay in the external production evidence; they are intentionally not duplicated in this compact reusable pack.\n`);
  fs.renameSync(staging, out);
} catch (e) { fs.rmSync(staging, { recursive: true, force: true }); throw e; }
console.log(out);
