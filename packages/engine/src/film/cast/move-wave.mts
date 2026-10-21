import { objectAt } from './common.mjs';
import type { CastStage, CastStep } from './contracts.mjs';

export function wave(stage: CastStage, step: CastStep): void {
  const { size, pose, group, alive } = stage;
  const { f, t, ids } = step;

  ids
    .filter((id) => pose.has(id) && alive(id))
    .forEach((id, i) => {
      const { el, base } = group(id),
        p = objectAt(pose, id),
        at = t + i * (f.stagger ?? 0.16),
        s = p.scale ?? 1,
        x = p.x - base.x,
        y = p.y - base.y;
      el.keys.push(
        {
          at,
          x,
          y: y - size * 0.22 * (f.scale ?? 1),
          scale: s * 1.16,
          dur: 0.2,
          ease: 'out',
        },
        { at: at + 0.2, x, y, scale: s, dur: 0.34, ease: 'spring' },
      );
    });
  return;
}
