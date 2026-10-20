import type {
  CastFormation,
  CastObject,
  CastPose,
  CastStage,
  CastStep,
} from './contracts.mjs';
import type { CanvasElement } from '../types.mjs';
import { swapWorkers } from './swap-workers.mjs';
import { warnOverlap } from './warn-overlap.mjs';
import { drawThread } from './draw-thread.mjs';
import { heroWord } from './hero-word.mjs';
import { required, objectAt } from './common.mjs';
import { objectElement, objectExtent, labelBelow } from './draw.mjs';
import { formationTargets } from './formations.mjs';
export function move(stage: CastStage, step: CastStep): void {
  const { spec, frame, size, pose, groups, elements, notes, release } = stage;
  const { f, k, t, stagger, dur, ids } = step;

  // What causes a swap acts first: each `by` object travels onto the one that changes and works
  // at it (a pencil scribbles), and the change lands on the cue.
  if (f.form === 'swap' && f.by?.length && pose.has(required(f.out, 'out'))) {
    swapWorkers(stage, step);
  }
  const targets = formationTargets(f, ids, frame, {
    size,
    seed: spec.seed + k,
    current: pose,
    extent: (id) => objectExtent(objectAt(spec.objects, id), size),
    below: (id) => labelBelow(objectAt(spec.objects, id), size),
  });
  [...targets.keys()].forEach((id, i) => {
    const to = objectAt(targets, id),
      at = Math.max(0, t + i * stagger),
      o = objectAt(spec.objects, id);
    if (!groups.has(id)) {
      const from = pose.get(id);
      // Carried objects stand where the last beat left them; new ones arrive in place, on the cue.
      // `enter: 'none'` stands on frame one: the establishing picture is there before anything moves.
      const g = objectElement(
        o,
        `cast-${id}`,
        size,
        from ?? to,
        entrance(o, size, at, from != null),
        spec.look,
      );
      groups.set(id, { el: g, base: from ?? to });
      elements.push(g);
      if (!from) {
        pose.set(id, { ...to, z: ++stage.top });
        return;
      }
    }
    const { el, base } = objectAt(groups, id);
    el.keys.push({
      at,
      x: to.x - base.x,
      y: to.y - base.y,
      scale: to.scale,
      rotate: to.rotate,
      opacity: to.opacity,
      dur,
      ease: f.ease ?? 'inOut',
    });
    pose.set(id, {
      ...to,
      z: pose.get(id)?.z ?? ++stage.top,
      gone: f.form === 'exit' || (f.form === 'swap' && id === f.out),
      ...roleAfterMove(stage, f, id),
    });
  });
  if (f.form === 'exit' || f.form === 'swap') release(t + 0.1);
  // Two objects standing on each other once a formation settles: usually a new formation laid over
  // objects carried from an earlier beat (a hero still large in the middle). Said once per beat.
  // (A swap's workers stand on what they change, by design; an exit's regathering settles at the next move.)
  if (
    !notes.some((n) => n.startsWith('overlap:')) &&
    !(f.form === 'swap' && f.by?.length) &&
    !['exit', 'wave'].includes(f.form)
  ) {
    warnOverlap(stage, step);
  }
  // What causes a swap is drawn over what it changed.
  for (const id of f.form === 'swap' ? (f.by ?? []) : [])
    if (pose.has(id)) pose.set(id, { ...objectAt(pose, id), z: ++stage.top });
  // A thread drawn through the formation once it settles: the pieces are now one sequence. Each
  // segment draws only after both its ends have arrived. If the beat ends before the formation can
  // settle, there is no thread (and none carried): drawing it early would show the line before
  // the pieces it joins, so the author is told to cue the move earlier or lengthen the beat.
  if (f.thread) {
    drawThread(stage, step, targets);
  }
  if (f.form === 'hero' && f.word) {
    heroWord(stage, step, targets);
  }
}

function roleAfterMove(
  stage: CastStage,
  f: CastFormation,
  id: string,
): Partial<CastPose> {
  if (f.form === 'hero')
    return id === f.hero ? { hero: true } : { quiet: true };
  if (
    f.form === 'swap' &&
    id === f.in &&
    stage.pose.get(required(f.out, 'out'))?.hero
  )
    return { hero: true };
  return {};
}

function entrance(
  object: CastObject,
  size: number,
  at: number,
  carried: boolean,
): Pick<CanvasElement, 'at' | 'enter' | 'dur' | 'dist'> {
  if (carried || object.enter === 'none') return { at: 0, enter: 'none' };
  const enter = object.enter ?? 'pop';
  return {
    at,
    enter,
    dur: enter === 'pop' ? 0.5 : 0.8,
    ...(!['pop', 'fade'].includes(enter) ? { dist: size * 4 } : {}),
  };
}
