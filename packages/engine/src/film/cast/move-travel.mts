import type { CastStage, CastStep, CastPose } from './contracts.mjs';
import { check, objectAt, oneId } from './common.mjs';
import { objectElement, objectExtent } from './draw.mjs';
import { destination, route, routeBudget } from './travel-route.mjs';

function arrive(
  stage: CastStage,
  step: CastStep,
  id: string,
  target: CastPose,
): void {
  const { spec, frame, pose, groups, elements, size } = stage;
  if (pose.has(id) && !pose.get(id)?.gone) return;
  const object = objectAt(spec.objects, id),
    [hw, hh] = objectExtent(object, size);
  const s = object.size ?? size;
  const labelW = object.label
    ? object.label.length * Math.max(22, s * 0.2) * 0.32
    : 0;
  const labelDown = object.label ? s * 0.34 + Math.max(22, s * 0.2) + 12 : 0;
  const ox = Math.max(hw, labelW) * 1.3 + 60;
  let start = { x: -ox, y: target.y };
  if (object.enter === 'right') start = { x: frame.width + ox, y: target.y };
  if (object.enter === 'drop')
    start = { x: target.x, y: -(hh * 1.3 + labelDown + 60) };
  if (object.enter === 'rise')
    start = { x: target.x, y: frame.height + hh * 1.3 };
  if (groups.has(id)) {
    const { el, base } = objectAt(groups, id);
    el.keys.push({
      at: step.t,
      x: start.x - base.x,
      y: start.y - base.y,
      scale: 1,
      rotate: 0,
      opacity: 1,
      dur: 0,
    });
  } else {
    const el = objectElement(
      object,
      `cast-${id}`,
      size,
      { ...start, scale: 1, rotate: 0, opacity: 1 },
      { at: 0, enter: 'none' },
      spec.look,
    );
    groups.set(id, { el, base: start });
    elements.push(el);
  }
  pose.set(id, { ...start, scale: 1, rotate: 0, opacity: 1, z: ++stage.top });
}
function trail(
  stage: CastStage,
  step: CastStep,
  id: string,
  count: number,
  at: number,
  point: ReturnType<typeof route>,
): void {
  const { frame, size, spec, until, under } = stage,
    { k, dur } = step;
  const d = Array.from({ length: count + 1 }, (_, index) => {
    const q = point(index / count);
    return `${index ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
  }).join(' ');
  let exitAt = until(k);
  if (exitAt == null && (frame.duration ?? 0) > at + dur + 1.2)
    exitAt = (frame.duration ?? 0) - 0.4;
  under.push({
    type: 'path',
    id: `cast-trail-${k}-${id}`,
    d,
    fill: 'none',
    stroke: 'muted',
    width: Math.max(4, size * 0.035),
    cap: 'round',
    join: 'round',
    dash: [size * 0.12, size * 0.1],
    ...(spec.look === 'drawn' ? { rough: { amount: 1, passes: 1 } } : {}),
    at,
    enter: 'draw',
    dur: dur * 0.75,
    drawEase: 'linear',
    ...(exitAt != null ? { exitAt, exit: 'fade' } : {}),
  });
}
function journey(
  stage: CastStage,
  step: CastStep,
  id: string,
  index: number,
  target: CastPose,
): void {
  const p = objectAt(stage.pose, id),
    { el, base } = stage.group(id);
  const end = destination(stage, step, id, index, target),
    point = route(p, end, step, id);
  const count = routeBudget(stage, step, id, el.keys.length);
  const start = step.t + index * (step.f.stagger ?? 0.3);
  const ease = (value: number) =>
    value < 0.5
      ? 4 * value * value * value
      : 1 - Math.pow(-2 * value + 2, 3) / 2;
  for (let j = 1; j <= count; j++) {
    const q = point(ease(j / count));
    el.keys.push({
      at: start + (step.dur * (j - 1)) / count,
      x: q.x - base.x,
      y: q.y - base.y,
      dur: step.dur / count,
      ease: 'linear',
    });
  }
  stage.pose.set(id, { ...p, x: end.x, y: end.y });
  if (step.f.trail !== false && index === 0)
    trail(stage, step, id, count, start, point);
}
export function travel(stage: CastStage, step: CastStep): void {
  const { f, ids } = step;
  const target: CastPose | undefined = f.center
    ? { x: f.center[0], y: f.center[1] }
    : stage.pose.get(oneId(f.to));
  check(
    target && !target.gone,
    `${f.to} is not on screen when ${ids.join(', ')} travel${ids.length > 1 ? '' : 's'} to it; place it first (for example a cluster at a center) or travel to a center point`,
  );
  for (const id of ids) arrive(stage, step, id, target);
  ids
    .filter((id) => stage.pose.has(id) && stage.alive(id))
    .forEach((id, index) => journey(stage, step, id, index, target));
}
