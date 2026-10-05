#!/usr/bin/env node
// Film-level effect parity: one small storyboard per backdrop, texture, lens setting and chrome,
// frame 30 drawn by the scene engine and by FFFrames (draft scale), PSNR between them.
//   node scripts/engine-effects.mjs OUT [variant …]      → OUT/report.json
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process';
const { prepareProject } = await import(path.resolve('fframes/prepare.mjs'));
const { engineCommand } = await import(path.resolve('scene/engine.mjs'));
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
const out = path.resolve(process.argv[2] ?? 'build/engine-effects');
const only = process.argv.slice(3);
const rows = [];
for (const [name, v] of Object.entries(variants).filter(([n]) => !only.length || only.includes(n))) {
  const dir = path.join(out, name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({ ...base, ...v }));
  const files = {};
  for (const e of ['scene', 'fframes']) {
    process.env.CLEARFRAME_ENGINE = e;
    const ctx = await prepareProject(dir, { draft: true });
    await engineCommand(ctx, 'frame', ['30', '-o', path.join(dir, e)], true);
    files[e] = path.join(dir, e, fs.readdirSync(path.join(dir, e))[0]);
  }
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', files.scene, '-i', files.fframes, '-lavfi', '[0][1]psnr', '-f', 'null', '-'], { encoding: 'utf8' });
  const db = /average:(inf|[\d.]+)/.exec(r.stderr)?.[1];
  rows.push([name, db]); console.log(name.padEnd(12), db);
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(rows));
