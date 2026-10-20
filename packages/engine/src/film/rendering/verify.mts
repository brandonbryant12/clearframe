import fs from 'node:fs';
import path from 'node:path';
import { nativeCommand } from '../prepare.mjs';
import { phase } from '../../engine/lib/runlog.mjs';
import { decodeFrames, psnr } from './frames.mjs';
import type { PreparedContext } from '../preparation/contracts.mjs';
import type { FrameComparison } from './contracts.mjs';
export async function verifyFrames(
  ctx: PreparedContext,
  a: number,
  b: number,
  finished: string,
  shots: string,
): Promise<FrameComparison[]> {
  // Same frames, two routes: drawn directly at their film position, and decoded from the
  // preview. Each must match at least as well as its neighbour in the preview, so a clock
  // off by one frame fails wherever the picture moves (a still picture cannot tell, and
  // there an off-by-one is invisible anyway).
  fs.mkdirSync(shots);
  // The range's ends, and the first cut inside it, where a one-frame slip is plain to see.
  const cut = ctx.job.beats
    .map((x) => x.start_frame)
    .find((f) => f > a && f < b - 1);
  const points = [
    { film: a, near: [a + 1] },
    ...(cut != null ? [{ film: cut, near: [cut - 1, cut + 1] }] : []),
    ...(b - 1 > a ? [{ film: b - 1, near: [b - 2] }] : []),
  ].map((p) => ({ ...p, near: p.near.filter((f) => f >= a && f < b) }));
  const check = await phase('verify', async () => {
    await nativeCommand(
      ctx,
      'frame',
      [points.map((p) => p.film).join(','), '-o', shots],
      true,
    );
    const drawn = fs
      .readdirSync(shots)
      .filter((f) => f.endsWith('.png'))
      .sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))
      .map((f) => path.join(shots, f));
    if (drawn.length !== points.length)
      throw new Error(
        `Expected ${points.length} reference frames; got ${drawn.length}`,
      );
    const wanted = [
      ...new Set(points.flatMap((p) => [p.film, ...p.near]).map((f) => f - a)),
    ];
    const decoded = await decodeFrames(finished, wanted, shots);
    const at = (f: number) => decoded[wanted.indexOf(f - a)];
    const comparisons: FrameComparison[] = [];
    for (const [k, p] of points.entries()) {
      const near: number[] = [];
      for (const f of p.near) {
        const score = await psnr(drawn[k], at(f));
        if (score !== null) near.push(score);
      }
      comparisons.push({
        film: p.film,
        preview: p.film - a,
        psnr: await psnr(drawn[k], at(p.film)),
        neighbour: near.length ? Math.max(...near) : null,
      });
    }
    return comparisons;
  });
  const bad = check.filter(
    (c) =>
      !(c.psnr != null && c.psnr >= 35) ||
      (c.neighbour != null && c.psnr != null && c.neighbour > c.psnr + 0.5),
  );
  if (bad.length)
    throw new Error(
      `Preview frames do not match the film at ${bad.map((c) => `frame ${c.film} (${c.psnr?.toFixed(1)} dB; its neighbour ${c.neighbour?.toFixed(1)} dB)`).join(', ')}; the preview clock is off.`,
    );
  return check;
}
