import { fail, numberOr } from '../fields.mjs';

import { actorOf } from '../stage-kit.mjs';
import type { LinkEntry, StageBuild } from '../stage-kit.mjs';
import type { Handler } from './contracts.mjs';

export function findLink(
  build: StageBuild,
  from: unknown,
  to: unknown,
  where: string,
): { id: string; forward: boolean } {
  for (const [id, l] of build.links) {
    if (l.from === from && l.to === to) return { id, forward: true };
    if (l.from === to && l.to === from) return { id, forward: false };
  }
  return fail(
    where,
    `no link between ${String(from)} and ${String(to)}; add one to links`,
  );
}

export const linkOf = (
  build: StageBuild,
  id: unknown,
  where: string,
): LinkEntry =>
  (typeof id === 'string' ? build.links.get(id) : undefined) ??
  fail(where, `no link ${String(id)}`);

/** A packet travels a link; its receiver bumps when it arrives (and may burst). */
export const send: Handler = (build, { ev, where, t, id }) => {
  if (!ev.via) {
    // Both ends must be actors before the link between them is looked up.
    actorOf(build, ev.from, where);
    actorOf(build, ev.to, where);
  }
  const route = ev.via
    ? { id: String(ev.via), forward: ev.reverse !== true }
    : findLink(build, ev.from, ev.to, where);
  const link = build.links.get(route.id) ?? fail(where, `no link ${route.id}`);
  const dur = numberOr(ev.dur, 1.0, where, 'dur');
  const color = ev.color ?? 'accent2';
  build.out.effects.push({
    type: 'circle',
    id,
    cx: 0,
    cy: 0,
    r: ev.size ?? 13,
    fill: color,
    glow: { blur: 12, opacity: 0.9 },
    along: {
      path: route.id,
      at: t,
      dur,
      ease: ev.ease ?? 'inOut',
      from: route.forward ? 0 : 1,
      to: route.forward ? 1 : 0,
    },
    at: t,
    enter: 'pop',
    dur: 0.2,
    exitAt: t + dur,
    exit: 'fade',
    exitDur: 0.18,
  });
  if (ev.label)
    build.out.effects.push({
      type: 'text',
      id: `${id}.label`,
      text: String(ev.label).slice(0, 24),
      attach: { to: id, dx: 0, dy: -30 },
      anchor: 'middle',
      size: 24,
      font: 'mono',
      fill: 'ink',
      at: t,
      enter: 'fade',
      dur: 0.2,
      exitAt: t + dur,
      exit: 'fade',
      exitDur: 0.18,
    });
  const target = actorOf(build, route.forward ? link.to : link.from, where);
  if (ev.arrive !== false)
    target.group.keys.push(
      { at: t + dur, scale: 1.06, dur: 0.12, ease: 'out' },
      { at: t + dur + 0.12, scale: 1, dur: 0.35 },
    );
  if (ev.burst)
    build.out.effects.push({
      type: 'particles',
      id: `${id}.burst`,
      kind: 'burst',
      x: 0,
      y: 0,
      w: 0,
      h: 0,
      attach: { to: target.id },
      count: ev.burst === true ? 220 : ev.burst,
      velocity: 380,
      size: 3,
      gravity: 120,
      life: 1.1,
      fill: color,
      at: t + dur,
      enter: 'none',
    });
};
