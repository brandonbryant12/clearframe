#!/usr/bin/env node
// Film-level effects: one small storyboard per backdrop, texture, lens setting and chrome, frame
// 30 drawn at draft scale. With --reference DIR (an earlier run of this script, or the retained
// FFFrames-era stills: DIR/<variant>/fframes/*.png), PSNR against each reference still.
//   node scripts/engine-effects.mjs OUT [--reference DIR] [variant …]      → OUT/report.json
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { prepareProject } from '../film/prepare.mjs';
import { engineCommand } from '../scene/engine.mjs';

const base = { title: 'fx', music: false, captions: false, theme: 'paper', beats: [{ id: 'a', block: 'statement', duration: 2, props: { text: 'A clear statement', support: 'Supporting line' } }] };
const variants = {
  plain: {}, paper: { backdrop: 'paper' }, grain: { texture: { grain: 0.6 } }, grainAnim: { texture: 'film' }, vignette: { texture: { vignette: 0.8 } },
  glow: { backdrop: 'glow' }, grid: { backdrop: 'grid' }, dots: { backdrop: 'dots' }, mosaic: { backdrop: 'mosaic' },
  noirGlow: { theme: 'noir', backdrop: 'glow' }, teal: { lens: { grade: 'teal-orange' } }, mono: { lens: { grade: 'mono' } }, sepia: { lens: { grade: 'sepia', gradeAmount: 1 } },
  bloomDark: { theme: 'noir', lens: { bloom: 0.8 } }, aberration: { lens: { aberration: 1 } }, leak: { lens: { leak: 0.8 } }, letterbox: { lens: { letterbox: 2.39 } },
  handheld: { lens: { handheld: 0.6 } }, chrome: { chrome: true }, frame: { frame: { brand: 'clearframe', left: 'Field notes', right: 'Issue 4' }, beats: [{ ...base.beats[0], label: 'Section' }] },
  vertical: { format: { preset: 'vertical' }, texture: 'film', lens: { grade: 'warm' } },
  grainDark: { theme: 'noir', texture: { grain: 0.6 } }, grainDarkAnim: { theme: 'noir', texture: 'film' },
};
const args = process.argv.slice(2);
const flag = args.indexOf('--reference');
const reference = flag >= 0 ? path.resolve(args.splice(flag, 2)[1]) : null;
const out = path.resolve(args[0] ?? 'build/engine-effects');
const only = args.slice(1);
export const psnr = (a, b) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', a, '-i', b, '-lavfi', '[0][1]psnr', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /average:(inf|[\d.]+)/.exec(r.stderr);
  return m ? (m[1] === 'inf' ? 99 : Number(m[1])) : null;
};
const firstPng = dir => (fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.png')).map(f => path.join(dir, f))[0] : null);
const rows = [];
for (const [name, v] of Object.entries(variants).filter(([n]) => !only.length || only.includes(n))) {
  const dir = path.join(out, name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({ ...base, ...v }));
  const ctx = await prepareProject(dir, { draft: true });
  await engineCommand(ctx, 'frame', ['30', '-o', path.join(dir, 'still')], true);
  const still = firstPng(path.join(dir, 'still'));
  const ref = reference && (firstPng(path.join(reference, name, 'fframes')) ?? firstPng(path.join(reference, name, 'still')));
  const db = ref ? psnr(still, ref) : null;
  rows.push({ variant: name, still: path.relative(out, still), ...(ref ? { reference: ref, psnr: db } : {}) });
  console.log(name.padEnd(14), db == null ? '' : `${db.toFixed(1)} dB`);
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(rows, null, 2));
