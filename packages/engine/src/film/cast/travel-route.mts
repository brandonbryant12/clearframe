import type {
  CastStage,
  CastStep,
  CastPose,
  CastFormation,
} from './contracts.mjs';
import { check, hash, objectAt } from './common.mjs';
import { objectExtent } from './draw.mjs';

export function destination(
  stage: CastStage,
  step: CastStep,
  id: string,
  index: number,
  target: CastPose,
): CastPose {
  const { frame, pose, spec, size } = stage,
    p = objectAt(pose, id);
  let end = { ...target };
  if (!step.f.center) {
    const reach = (object: string, scale = 1) =>
      Math.max(...objectExtent(objectAt(spec.objects, object), size)) * scale;
    const dx = p.x - end.x,
      dy = p.y - end.y,
      d = Math.hypot(dx, dy) || 1;
    const to = typeof step.f.to === 'string' ? step.f.to : '';
    const gap =
      reach(to, end.scale) + reach(id, p.scale) * (1 + index * 2) + size * 0.2;
    end = { x: end.x + (dx / d) * gap, y: end.y + (dy / d) * gap };
  }
  const W = frame.width,
    H = frame.height,
    [mx, my] = H > W ? [W * 0.1, H * 0.06] : [W * 0.05, H * 0.05];
  const [hw, hh] = objectExtent(objectAt(spec.objects, id), size).map(
    (v) => v * (p.scale ?? 1) * 1.16,
  );
  return {
    x: Math.min(Math.max(end.x, mx + hw), W - mx - hw),
    y: Math.min(
      Math.max(end.y, Math.max(my, frame.top ?? 0) + hh),
      Math.min(H - my, frame.bottom ?? H) - hh,
    ),
  };
}
export function route(
  start: CastPose,
  end: CastPose,
  step: CastStep,
  id: string,
) {
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const len = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const bend = len * 0.22 * (hash(`${id}${step.k}`) > 0.5 ? 1 : -1);
  const waypoints = step.f.via ?? [
    [
      mid.x - ((end.y - start.y) / len) * bend,
      mid.y + ((end.x - start.x) / len) * bend,
    ],
  ];
  const points = [start, ...waypoints.map(([x, y]) => ({ x, y })), end];
  return (value: number) => {
    const segment = Math.min(
      points.length - 2,
      Math.floor(value * (points.length - 1)),
    );
    const local = value * (points.length - 1) - segment;
    const [a, b, c, d] = [
      points[Math.max(0, segment - 1)],
      points[segment],
      points[segment + 1],
      points[Math.min(points.length - 1, segment + 2)],
    ];
    const interpolate = (k0: number, k1: number, k2: number, k3: number) =>
      0.5 *
      (2 * k1 +
        (-k0 + k2) * local +
        (2 * k0 - 5 * k1 + 4 * k2 - k3) * local * local +
        (-k0 + 3 * k1 - 3 * k2 + k3) * local * local * local);
    return {
      x: interpolate(a.x, b.x, c.x, d.x),
      y: interpolate(a.y, b.y, c.y, d.y),
    };
  };
}
function touches(move: CastFormation, id: string): boolean {
  if (move.form === 'swap')
    return [move.out, move.in, ...(move.by ?? [])].includes(id);
  if (move.form === 'merge')
    return move.into === id || (move.ids ?? []).includes(id);
  if (move.form === 'split')
    return move.from === id || (move.ids ?? []).includes(id);
  return (
    !['mark', 'camera'].includes(move.form) &&
    (!move.ids || move.ids.includes(id))
  );
}
function keysPerMove(move: CastFormation): number {
  switch (move.form) {
    case 'wave':
      return 2;
    case 'swap':
      return 6;
    case 'merge':
      return 2 * Math.max(1, (move.ids ?? []).length);
    case 'split':
      return 3;
    default:
      return 1;
  }
}
export function routeBudget(
  stage: CastStage,
  step: CastStep,
  id: string,
  keys: number,
): number {
  const later = stage.spec.formations.filter(
    (move, index) => index > step.k && touches(move, id),
  );
  const routes = 1 + later.filter((move) => move.form === 'travel').length;
  const reserve = later
    .filter((move) => move.form !== 'travel')
    .reduce((sum, move) => sum + keysPerMove(move), 0);
  const count = Math.min(16, Math.floor((23 - keys - reserve) / routes));
  check(
    count >= 4,
    `${id} has more moves in this beat than one object can carry (24 keyframes: ${routes} journey${routes > 1 ? 's' : ''} and ${later.length - routes + 1} other move${later.length - routes + 1 === 1 ? '' : 's'} after ${keys} keys); move some of it to the next beat`,
  );
  return count;
}
