// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { prepareProject, nativeCommand, unchanged } from '../prepare.mjs';

import { writeJSON } from '../../engine/lib/util.mjs';

import { readRenderPlan } from './schemas.mjs';
import type { StillOptions } from './contracts.mjs';
import type { PreparedContext } from '../preparation/contracts.mjs';
/** Review copy of the prepared job with a labelled coordinate grid for placing art. */
export function withGuides(ctx: PreparedContext) {
  const dir = path.join(ctx.dir, `guides-${crypto.randomUUID()}`);
  fs.mkdirSync(dir);
  writeJSON(path.join(dir, 'job.json'), { ...ctx.job, guides: true });
  // The renderer opens plan.json, which names its job and media relative to itself: point them
  // back at the prepared media and at this job with guides.
  const plan = readRenderPlan(path.join(ctx.dir, 'plan.json'));
  writeJSON(path.join(dir, 'plan.json'), {
    ...plan,
    job: 'job.json',
    media: path.join(ctx.dir, plan.media ?? 'media'),
  });
  return {
    ...ctx,
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
export async function stillProject(
  root: string,
  {
    draft = false,
    rough = false,
    at,
    beat,
    pos = 0.6,
    out,
    grid = false,
  }: StillOptions = {},
) {
  let ctx = await prepareProject(root, { draft, rough });
  const b = beat && ctx.timing.beats.find((b) => b.id === beat);
  if (beat && !b) throw new Error(`No beat ${beat}`);
  if (grid) ctx = withGuides(ctx);
  const time = b ? b.start + b.dur * pos : Number(at ?? 0);
  if (!Number.isFinite(time) || time < 0 || time >= ctx.timing.duration)
    throw new Error('Still time must lie within the film.');
  const file = path.resolve(
    out ??
      path.join(
        root,
        'build',
        `still-${time.toFixed(2)}${grid ? '-grid' : ''}.png`,
      ),
  );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    await singleFrame(ctx, time, file);
  } finally {
    ctx.cleanup?.();
  }
  unchanged(ctx);
  return file;
}
export async function singleFrame(
  ctx: PreparedContext,
  time: number,
  file: string,
) {
  // Upstream's frame -o is always a directory, even for a single timestamp.
  const shots = path.join(ctx.dir, `frame-${crypto.randomUUID()}`);
  fs.mkdirSync(shots);
  try {
    await nativeCommand(ctx, 'frame', [`${time}s`, '-o', shots]);
    const pngs = fs
      .readdirSync(shots)
      .filter(
        (f) => f.endsWith('.png') && fs.statSync(path.join(shots, f)).isFile(),
      );
    if (pngs.length !== 1)
      throw new Error(`Expected one frame PNG; received ${pngs.length}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.copyFileSync(path.join(shots, pngs[0]), file);
  } finally {
    fs.rmSync(shots, { recursive: true, force: true });
  }
}
