import type { CastStage, CastStep } from './contracts.mjs';
import { hash, objectAt } from './common.mjs';

export function mark(stage: CastStage, step: CastStep): void {
  const { spec, frame, size, pose, words, times, group, alive } = stage;
  const { f, k, t, ids } = step;

  const color = f.color ?? (f.mark === 'cross' ? 'negative' : 'accent2');
  const next = spec.formations.findIndex(
    (g, j) => j > k && !['wave', 'mark'].includes(g.form),
  );
  const fade = (id: string | null): number | null => {
    if (next >= 0) {
      const formation = spec.formations[next];
      if (formation.form === 'exit' && (formation.ids ?? []).includes(id ?? ''))
        return null;
      return times[next];
    }
    return (frame.duration ?? 0) > t + 1.6 ? (frame.duration ?? 0) - 0.4 : null;
  };
  const pen = {
    fill: 'none',
    stroke: color,
    cap: 'round',
    join: 'round',
    rough: { amount: 1, passes: 2 },
    enter: 'draw',
  };
  ids
    .filter((id) => pose.has(id) && alive(id))
    .forEach((id, i) => {
      const p = objectAt(pose, id),
        at = t + i * (f.stagger ?? 0.25),
        seed = hash(`${id}${k}`);
      if (f.mark !== 'arrow') {
        // In the object's own coordinates: its centre is the origin and its scale applies to the pen too.
        const { el } = group(id),
          r = (objectAt(spec.objects, id).size ?? size) * 0.5;
        const d = markPath(f.mark, r, seed);
        const out = fade(id);
        el.children.push({
          type: 'path',
          id: `${el.id}-mark-${k}`,
          d,
          ...pen,
          width: Math.max(5, size * 0.045) / (p.scale ?? 1),
          at,
          dur: f.mark === 'circle' ? 0.6 : 0.45,
          ...(out != null
            ? { exitAt: Math.max(at + 0.9, out), exit: 'fade' }
            : {}),
        });
        return;
      }
      const r = size * (p.scale ?? 1) * 0.5,
        pt = (x: number, y: number) =>
          `${(p.x + x).toFixed(1)} ${(p.y + y).toFixed(1)}`,
        out = fade(null),
        width = Math.max(5, size * 0.045);
      (typeof f.to === 'string' ? [f.to] : (f.to ?? []))
        .filter((to) => pose.has(to) && to !== id)
        .forEach((to, j) => {
          // From the edge of one to just short of the other, bowed a little: a pen stroke, not a connector.
          const q = objectAt(pose, to),
            dx = q.x - p.x,
            dy = q.y - p.y,
            len = Math.hypot(dx, dy) || 1,
            ux = dx / len,
            uy = dy / len,
            rq = size * (q.scale ?? 1) * 0.5;
          const [ax, ay, bx, by] = [
              ux * r * 1.2,
              uy * r * 1.2,
              dx - ux * rq * 1.4,
              dy - uy * rq * 1.4,
            ],
            bend = len * 0.16 * (hash(`${id}${to}`) > 0.5 ? 1 : -1);
          words.push({
            type: 'path',
            id: `cast-mark-${k}-${id}-${to}`,
            d: `M${pt(ax, ay)} Q${pt((ax + bx) / 2 - uy * bend, (ay + by) / 2 + ux * bend)} ${pt(bx, by)}`,
            ...pen,
            width,
            arrow: 'end',
            head: width * 3.2,
            at: at + j * 0.2,
            dur: 0.45,
            ...(out != null
              ? { exitAt: Math.max(at + j * 0.2 + 0.9, out), exit: 'fade' }
              : {}),
          });
        });
    });
  return;
}

function markPath(
  mark: string | undefined,
  radius: number,
  seed: number,
): string {
  const xy = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;
  if (mark === 'circle')
    return Array.from({ length: 29 }, (_, j) => {
      const angle = -2.2 + seed + (j / 28) * Math.PI * 2.15,
        r = radius * (1.55 + (0.1 * j) / 28);
      return `${j ? 'L' : 'M'}${xy(Math.cos(angle) * r * 1.08, Math.sin(angle) * r * 0.96)}`;
    }).join(' ');
  if (mark === 'underline')
    return `M${xy(-radius * 1.2, radius * 1.42)} Q${xy(0, radius * 1.62)} ${xy(radius * 1.25, radius * 1.36)}`;
  return `M${xy(-radius * 1.1, -radius * 1.05)} L${xy(radius * 1.1, radius * 1.1)} M${xy(radius * 1.05, -radius * 1.1)} L${xy(-radius * 1.1, radius * 1.05)}`;
}
