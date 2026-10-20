import { finite, numberOr } from '../fields.mjs';

import { actorOf } from '../stage-kit.mjs';

import type { Handler } from './contracts.mjs';

export const burst: Handler = (build, { ev, where, t, id }) => {
  const a = actorOf(build, ev.actor, where);
  build.out.effects.push({
    type: 'particles',
    id,
    kind: 'burst',
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    attach: { to: a.id },
    count: ev.count ?? 260,
    velocity: ev.velocity ?? 420,
    size: ev.size ?? 3.5,
    gravity: ev.gravity ?? 160,
    life: ev.life ?? 1.3,
    fill: ev.color ?? 'accent2',
    at: t,
    enter: 'none',
  });
};

/** A camera key: authored x/y, or an actor's authored centre (`follow`). */
export const camera: Handler = (build, { ev, where, t }) => {
  let x = ev.x,
    y = ev.y;
  if (ev.follow) ({ x, y } = actorOf(build, ev.follow, where));
  build.cameraKeys.push({
    at: t,
    ...(finite(x) ? { x } : {}),
    ...(finite(y) ? { y } : {}),
    ...(finite(ev.zoom) ? { zoom: ev.zoom } : {}),
    ...(finite(ev.rotate) ? { rotate: ev.rotate } : {}),
    dur: numberOr(ev.dur, 1.4, where, 'dur'),
    ease: ev.ease ?? 'inOut',
  });
};
