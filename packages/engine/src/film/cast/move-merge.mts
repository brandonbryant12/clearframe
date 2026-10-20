import { required, objectAt } from './common.mjs';

import type { CastStage, CastStep } from './contracts.mjs';
import { objectElement, objectExtent, labelBelow } from './draw.mjs';
import { formationTargets } from './formations.mjs';
export function merge(stage: CastStage, step: CastStep): void {
  const {
    spec,
    frame,
    size,
    pose,
    groups,
    elements,
    notes,
    group,
    release,
    alive,
  } = stage;
  const { f, t, dur, ids } = step;

  const hub = required(
      f.form === 'merge' ? f.into : f.from,
      'merge or split hub',
    ),
    h = pose.get(hub);
  if (!h || !alive(hub)) {
    notes.push(`${f.form}: ${hub} is not on screen, so nothing moves`);
    return;
  }
  const st = f.stagger ?? 0.18,
    hs = h.scale ?? 1,
    pulse = [];
  const out =
    f.form === 'split'
      ? formationTargets(
          {
            form: 'ring',
            on: hub,
            spread: splitSpread(f.spread, size * hs * 1.8),
          },
          ids,
          frame,
          {
            size,
            current: pose,
            extent: (id) => objectExtent(objectAt(spec.objects, id), size),
            below: (id) => labelBelow(objectAt(spec.objects, id), size),
          },
        )
      : null;
  ids.forEach((id, i) => {
    const at = t + i * st;
    if (f.form === 'merge') {
      const p = pose.get(id);
      if (!p || p.gone) return;
      const { el, base } = group(id);
      el.keys.push({
        at,
        x: h.x - base.x,
        y: h.y - base.y,
        scale: (p.scale ?? 1) * 0.35,
        rotate: 0,
        opacity: 0,
        dur,
        ease: f.ease ?? 'in',
      });
      pose.set(id, {
        x: h.x,
        y: h.y,
        scale: (p.scale ?? 1) * 0.35,
        rotate: 0,
        opacity: 0,
        z: p.z,
        gone: true,
      });
      pulse.push(at + dur * 0.85);
    } else {
      // Out of the hub: an object not yet on screen (or absorbed) starts inside it, small.
      if (!groups.has(id) && (!pose.has(id) || pose.get(id)?.gone)) {
        const g = objectElement(
          objectAt(spec.objects, id),
          `cast-${id}`,
          size,
          { x: h.x, y: h.y, scale: 0.3, opacity: 0 },
          { at: 0, enter: 'none' },
          spec.look,
        );
        groups.set(id, { el: g, base: { x: h.x, y: h.y } });
        elements.push(g);
        pose.set(id, {
          x: h.x,
          y: h.y,
          scale: 0.3,
          opacity: 0,
          z: (h.z ?? 0) - 0.5,
        });
      }
      const { el, base } = group(id),
        to = objectAt(required(out, 'split targets'), id);
      el.keys.push(
        {
          at,
          x: h.x - base.x,
          y: h.y - base.y,
          scale: 0.3,
          opacity: 0,
          dur: 0,
        },
        {
          at,
          x: to.x - base.x,
          y: to.y - base.y,
          scale: to.scale,
          rotate: 0,
          opacity: 1,
          dur,
          ease: f.ease ?? 'out',
        },
      );
      pose.set(id, { ...to, z: pose.get(id)?.z ?? ++stage.top });
    }
  });
  if (f.form === 'split') pulse.push(t);
  else release(t + dur * 0.5);
  const { el, base } = group(hub),
    x = h.x - base.x,
    y = h.y - base.y;
  for (const at of pulse)
    el.keys.push(
      { at, x, y, scale: hs * 1.12, dur: 0.12, ease: 'out' },
      { at: at + 0.12, x, y, scale: hs, dur: 0.3, ease: 'spring' },
    );
  return;
}

function splitSpread(spread: number | undefined, base: number): number {
  if (spread == null) return base;
  return spread <= 4 ? spread * base : spread;
}
