// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { THEMES, palette } from '../catalog.mjs';

import { prepareProject, unchanged } from '../prepare.mjs';

import { ffmpeg, writeJSON } from '../../engine/lib/util.mjs';

import { singleFrame } from './stills.mjs';
import { readRenderPlan } from './schemas.mjs';
import type { LookbookOptions } from './contracts.mjs';

export async function lookbookProject(
  root: string,
  { draft = false, rough = false, beat, pos = 0.6, out }: LookbookOptions = {},
) {
  const ctx = await prepareProject(root, { draft, rough });
  const b = beat
    ? ctx.timing.beats.find((b) => b.id === beat)
    : ctx.timing.beats[0];
  if (!b) throw new Error(`No beat ${beat}`);
  if (!Number.isFinite(pos) || pos < 0 || pos >= 1)
    throw new Error('Lookbook --pos must be 0–1, excluding 1.');
  const time = Math.min(b.end - 1 / ctx.job.fps, b.start + b.dur * pos);
  const temp = path.join(ctx.dir, `looks-${crypto.randomUUID()}`);
  fs.mkdirSync(temp);
  const file = path.resolve(out ?? path.join(root, 'build/looks.png')),
    themes = Object.keys(THEMES);
  // The renderer opens plan.json, which names its job and media relative to itself.
  const plan = readRenderPlan(path.join(ctx.dir, 'plan.json'));
  try {
    for (const [i, name] of themes.entries()) {
      const dir = path.join(temp, name);
      fs.mkdirSync(dir);
      writeJSON(path.join(dir, 'job.json'), {
        ...ctx.job,
        theme: palette(name),
      });
      writeJSON(path.join(dir, 'plan.json'), {
        ...plan,
        job: 'job.json',
        media: path.join(ctx.dir, plan.media ?? 'media'),
      });
      await singleFrame(
        { ...ctx, dir },
        time,
        path.join(temp, `tile-${String(i).padStart(4, '0')}.png`),
      );
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const columns = Math.min(4, themes.length),
      rows = Math.ceil(themes.length / columns);
    await ffmpeg([
      '-y',
      '-framerate',
      '1',
      '-i',
      path.join(temp, 'tile-%04d.png'),
      '-vf',
      `scale=480:-2,tile=${columns}x${rows}:padding=12:margin=12:color=0x161b22`,
      '-frames:v',
      '1',
      '-threads',
      '1',
      file,
    ]);
    unchanged(ctx);
    writeJSON(`${file}.json`, {
      inputId: ctx.manifest.inputId,
      beat: b.id,
      time,
      themes,
      order: 'left to right, top to bottom',
      note: 'Same scene and media; only the native palette changes. Generated footage is not recolored.',
    });
    return file;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
