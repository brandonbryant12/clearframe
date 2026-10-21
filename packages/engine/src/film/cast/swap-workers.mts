import type { CastStage, CastStep } from './contracts.mjs';

import { objectAt, required } from './common.mjs';

export function swapWorkers(stage: CastStage, step: CastStep): void {
  const { size, pose, times, group, alive } = stage;
  const { f, k, t, dur } = step;

  const c = objectAt(pose, f.out),
    reach = size * (c.scale ?? 1) * 0.4,
    from = Math.max(k ? times[k - 1] + 0.2 : 0, t - 1.2);
  (f.by ?? [])
    .filter((id) => pose.has(id) && alive(id))
    .forEach((id, i) => {
      const p0 = objectAt(pose, id),
        { el, base } = group(id),
        x = c.x + reach * (i % 2 ? -1 : 1) - base.x,
        y = c.y - reach - base.y,
        s = p0.scale ?? 1;
      // Then, the change made, it goes back to where it stood, upright.
      el.keys.push(
        {
          at: from,
          x,
          y,
          scale: s,
          rotate: -18,
          dur: Math.max(0.2, Math.min(0.6, t - from - 0.45)),
          ease: 'inOut',
        },
        { at: t - 0.42, rotate: -4, y: y + 6, dur: 0.12 },
        { at: t - 0.28, rotate: -22, y, dur: 0.12 },
        { at: t - 0.14, rotate: -8, y: y + 6, dur: 0.12 },
        { at: t, rotate: -18, y, dur: 0.2 },
        {
          at: t + Math.max(0.5, dur * 0.9),
          x: p0.x - base.x,
          y: p0.y - base.y,
          scale: s,
          rotate: p0.rotate ?? 0,
          dur: 0.7,
          ease: 'inOut',
        },
      );
    });
  // The one being changed gives under each stroke.
  const { el, base } = group(required(f.out, 'out')),
    s0 = c.scale ?? 1,
    [x, y] = [c.x - base.x, c.y - base.y];
  for (const [dt, k] of [
    [0.42, 0.95],
    [0.28, 1.02],
    [0.14, 0.95],
  ])
    el.keys.push({ at: t - dt, x, y, scale: s0 * k, dur: 0.12 });
}
