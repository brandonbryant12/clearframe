#!/usr/bin/env node
// A new art-directed cut of the sourced Coca-Cola recap. Reuses verified speech.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { authorStoryboard, claims, releaseURL } from './coca-cola.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const json = (f, data) => fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n');
const red = '#e41e2b', white = '#ffffff';
const show = { at: 0, enter: 'none' };
const text = (value, x, y, size, extra = {}) => ({ type: 'text', text: value, x, y, size, font: 'display', fill: 'ink', fit: 1500, ...show, ...extra });
const label = (value, x, y, extra = {}) => text(value, x, y, 28, { font: 'mono', fill: 'muted', ...extra });
const logo = (x, y, w) => ({ type: 'image', asset: 'logo', x, y, w, h: w * 80 / 493, fit: 'contain', ...show });
const source = 'Coca-Cola Q2 2026 release · July 28, 2026';

export function author(base) {
  const sb = authorStoryboard(base, true);
  sb.title = 'Inside the quarter — Coca-Cola in 3D';
  sb.logline = 'A familiar brand, a dimensional reveal, and the reported drivers of Q2 growth.';
  sb.theme.ink = red;
  sb.texture = { grain: 0.035 };
  sb.continuity = { maxGeneratedShare: 1, treatment: 'Actual Coca-Cola identity and photographs, red native typography beside monochrome dimensional material panels.',
    camera: 'Brand close-up, dimensional revenue reveal, assembly mechanism, native financial evidence, photographic close.',
    motion: '3D art illustrates discovery and opening a mechanism. Quantities are only native labels and charts; physical part counts encode no data.' };
  sb.assets.push({ id: 'quarter-reveal', kind: 'clip', file: 'assets/clips/petal-reveal-panel.mp4' },
    { id: 'growth-mechanism', kind: 'clip', file: 'assets/clips/exploded-core-panel.mp4' });
  const revenue = sb.beats.find(b => b.id === 'revenue');
  revenue.camera = 'none';
  revenue.plate = { asset: 'quarter-reveal', side: 'full', treatment: 'none', drift: 'none', scrim: 0, loop: true };
  revenue.props = { source, elements: [logo(150, 106, 435), text('A larger top line.', 150, 300, 74, { fit: 760 }),
    text('$13.4B', 145, 510, 184, { font: 'poster', fill: red, fit: 680, at: 0.2, enter: 'wipe-up', dur: 0.8 }),
    text('Net revenue', 155, 650, 46, { fill: '#1d1d1f', fit: 660 }),
    text('+7%', 148, 839, 149, { font: 'poster', fill: red, at: 0.9, enter: 'rise', dur: 0.7 }),
    text('year over year', 465, 828, 43, { fill: '#1d1d1f', fit: 475 }),
    label('USD · Quarter ended July 3, 2026', 155, 940), label('Illustrative reveal', 1230, 920, { size: 24, fit: 500, fill: '#1d1d1f' })] };
  const organic = sb.beats.find(b => b.id === 'organic');
  organic.tone = 'accent'; organic.camera = 'none'; organic.transition = 'cut';
  organic.plate = { asset: 'growth-mechanism', side: 'full', treatment: 'none', drift: 'none', scrim: 0, loop: true };
  organic.props = { source, elements: [text('Inside the growth.', 150, 240, 84, { fill: white, fit: 650 }),
    text('+6%', 145, 490, 205, { font: 'poster', fill: white, fit: 680, at: 0.2, enter: 'wipe-up', dur: 0.8 }),
    text('Organic revenue', 157, 633, 48, { fill: white, fit: 680 }), label('NON-GAAP', 160, 685, { fill: white, size: 25 }),
    { type: 'line', x1: 160, y1: 727, x2: 825, y2: 727, stroke: white, width: 2, opacity: 0.6, ...show },
    text('+4%', 155, 827, 89, { font: 'poster', fill: white, at: 0.9, enter: 'rise', dur: 0.6 }),
    text('Concentrate sales', 350, 820, 42, { fill: white, fit: 475 }),
    text('+2%', 155, 906, 89, { font: 'poster', fill: white, at: 1.7, enter: 'rise', dur: 0.6 }),
    text('Price / mix', 350, 899, 42, { fill: white, fit: 475 }),
    label('Conceptual assembly', 1230, 920, { fill: white, size: 24, fit: 500 })] };
  const margin = sb.beats.find(b => b.id === 'margin');
  margin.camera = 'none';
  margin.props = { source, kpi: {
    form: 'comparison', label: 'GAAP operating margin', unit: 'Percent of revenue', suffix: '%', decimals: 1,
    domain: [0, 40], values: [{ label: 'Q2 2025', value: 34.1 }, { label: 'Q2 2026', value: 34.9 }],
    motion: { preset: 'stagger', duration: 0.85, stagger: 0.18 },
  }, elements: [text('+0.8 percentage points', 1690, 292, 40, { anchor: 'end', fill: red, fit: 720, at: 1.4, enter: 'fade', dur: 0.3 })] };
  // Accounting bases remain explicit. Constant depth adds no quantitative dimension.
  for (const b of sb.beats) if (b.id === 'opening') {
    const caption = b.props.elements.find(e => e.text === 'Independent earnings recap');
    if (caption) caption.text = 'Independent earnings recap · 3D edition';
  }
  return sb;
}

export function prepare(sourceProject, assetRoot, out) {
  sourceProject = path.resolve(sourceProject); assetRoot = path.resolve(assetRoot); out = path.resolve(out);
  if (fs.existsSync(out)) throw new Error('Output exists. Preserve it and choose a new project directory.');
  const base = read(path.join(sourceProject, 'storyboard.json'));
  const inputs = ['petal-reveal', 'exploded-core'].map(id => {
    const dir = path.join(assetRoot, id), r = read(path.join(dir, 'receipt.json'));
    assert.equal(r.status, 'ready-for-review'); assert.equal(r.config.width, 1920); assert.equal(r.config.height, 1080); assert.equal(r.config.draft, false);
    for (const [file, info] of Object.entries(r.outputs)) assert.equal(sha(path.join(dir, file)), info.sha256, `${id}/${file} changed`);
    return { id, dir, receipt: r };
  });
  fs.mkdirSync(out, { recursive: true });
  fs.cpSync(path.join(sourceProject, 'assets'), path.join(out, 'assets'), { recursive: true });
  fs.cpSync(path.join(sourceProject, 'source'), path.join(out, 'source'), { recursive: true });
  for (const name of ['intake.json', 'brand.json', 'BRAND.md', 'EVIDENCE.md']) if (fs.existsSync(path.join(sourceProject, name))) fs.copyFileSync(path.join(sourceProject, name), path.join(out, name));
  fs.cpSync(path.join(path.dirname(sourceProject), 'source-kit'), path.join(out, 'source/official-kit'), { recursive: true });
  fs.mkdirSync(path.join(out, 'assets/clips'), { recursive: true });
  fs.mkdirSync(path.join(out, 'logs'), { recursive: true });
  const manifest = [];
  for (const { id, dir, receipt } of inputs) {
    const saved = path.join(out, 'source/sculptures', id); fs.mkdirSync(saved, { recursive: true });
    for (const file of ['clip.mp4', 'poster.png', 'scene.blend', 'receipt.json', 'render-config.json']) fs.copyFileSync(path.join(dir, file), path.join(saved, file));
    fs.cpSync(path.join(dir, 'source'), path.join(saved, 'source'), { recursive: true });
    const framed = path.join(out, 'assets/clips', id + '-panel.mp4');
    const color = id === 'petal-reveal' ? 'white' : '0xe41e2b';
    const cropX = id === 'petal-reveal' ? 520 : 450;
    const filter = `crop=1224:1080:${cropX}:0,hue=s=0,scale=1070:945,pad=1920:1080:850:0:${color}`;
    const args = ['-v', 'error', '-nostdin', '-threads', '2', '-filter_threads', '2', '-i', path.join(saved, 'clip.mp4'), '-vf', filter,
      '-c:v', 'libx264', '-threads', '2', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-an',
      '-color_primaries', 'bt709', '-color_trc', 'iec61966-2-1', '-colorspace', 'bt709', '-color_range', 'tv', '-movflags', '+faststart', framed];
    const t = performance.now(), r = spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
    fs.writeFileSync(path.join(out, 'logs', id + '-framing.log'), r.stderr ?? '');
    assert.equal(r.status, 0, r.stderr);
    manifest.push({ id, original: `source/sculptures/${id}/clip.mp4`, originalSHA256: receipt.outputs['clip.mp4'].sha256,
      framed: `assets/clips/${id}-panel.mp4`, framedSHA256: sha(framed), filter, seconds: (performance.now() - t) / 1000,
      note: 'Monochrome editorial crop in a full-height material panel. Original 3D scene, rendered video and receipt retained.' });
  }
  const sb = author(base); json(path.join(out, 'storyboard.json'), sb);
  for (const beat of sb.beats) assert.equal(beat.vo, base.beats.find(b => b.id === beat.id).vo, `${beat.id} changed the retained narration`);
  json(path.join(out, 'source-to-claim.json'), claims);
  json(path.join(out, 'asset-manifest.json'), manifest);
  json(path.join(out, 'voice-reuse.json'), { provider: 'local synthetic narration', sourceProject,
    files: Object.fromEntries(fs.readdirSync(path.join(out, 'assets/vo')).filter(f => /\.(wav|json)$/.test(f)).map(f => {
      const rel = 'assets/vo/' + f; assert.equal(sha(path.join(out, rel)), sha(path.join(sourceProject, rel))); return [rel, sha(path.join(out, rel))];
    })), timing: 'Preserved original alignment, including explicitly estimated words. No new measured-timing claim.' });
  fs.writeFileSync(path.join(out, 'DIRECTION.md'), `# Inside the quarter — Coca-Cola in 3D\n\nA sourced Q2 2026 earnings update, based on ${releaseURL}. The user requested a new film using the 3D assets.\n\nSelected direction: the actual brand opens the story; a ceramic reveal introduces the top line; a machined assembly opens the growth mechanism. Native margin bars with a common zero baseline and constant shallow depth, plus separate GAAP/comparable EPS retain literal financial proof. The close returns to actual product photography. Full-height monochrome material panels preserve dimensional contrast beside red native brand typography, without changing source logos or photographs.\n\nAlternatives considered: a single red ribbon throughout the recap; or an architectural journey through the results. The selected mix uses two distinct operations and retains stronger literal brand and financial evidence between them. Shapes and physical part counts are illustrative. All figures remain native, attributed and independent of the artwork.\n\nPreserve the seven existing narration segments byte-for-byte. They are local synthetic speech from the earlier recap; some word timings are estimated. Only pictures and editorial typography change. Source original HTML, SVG and JPEGs, 3D receipts/scenes and compositing transformations are retained.\n\nReview the actual encoded film at phone size, verify the revenue/organic distinction, the +4/+2 drivers, separate volume measurement, fixed 0–40% margin scale, EPS accounting labels and end context.\n`);
  json(path.join(out, 'trajectory.json'), { version: 1, kind: 'actual-source-3d-update', status: 'prepared', sourceProject, assetRoot, project: out, preparedAt: new Date().toISOString(), newBlenderRenders: 0, newVoiceCalls: 0, paidCalls: 0 });
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values: v } = parseArgs({ options: { source: { type: 'string' }, 'asset-root': { type: 'string' }, out: { type: 'string' } } });
  if (!v.source || !v['asset-root'] || !v.out) throw new Error('Usage: coca-cola-3d.mjs --source EARLIER-RECAP-PROJECT --asset-root MASTER-ROOT --out NEW-PROJECT');
  console.log(prepare(v.source, v['asset-root'], v.out));
}
