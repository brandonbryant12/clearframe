import { fail, finite, numberOr, own } from '../fields.mjs';

import { STATUS, actorOf } from '../stage-kit.mjs';

import type { Handler } from './contracts.mjs';
import { linkOf } from './send.mjs';

/** A bump and a coloured outline; a pulse (or a highlight with an end) returns to its status colour. */
export const pulse: Handler = (build, { kind, ev, where, t, until }) => {
  const a = actorOf(build, ev.actor, where);
  a.group.keys.push(
    { at: t, scale: 1.07, dur: 0.16, ease: 'out' },
    { at: t + 0.16, scale: 1, dur: 0.4 },
  );
  const color = ev.color ?? 'accent';
  a.card.keys.push({ at: t, stroke: color, dur: 0.25 });
  if (kind === 'pulse' || until != null)
    a.card.keys.push({
      at: until ?? t + numberOr(ev.dur, 1.2, where, 'dur'),
      stroke: a.color,
      dur: 0.4,
    });
};

/** A new status: outline and light change colour; a new label replaces the old one. */
export const state: Handler = (build, { ev, where, t }) => {
  const a = actorOf(build, ev.actor, where);
  const color =
    own(STATUS, ev.status) ??
    fail(where, `status is ${Object.keys(STATUS).join(', ')}`);
  a.card.keys.push({ at: t, stroke: color, dur: 0.35 });
  a.dot.keys.push(
    { at: t, fill: color === 'line' ? 'muted' : color, dur: 0.35 },
    { at: t, scale: 1.6, dur: 0.15 },
    { at: t + 0.15, scale: 1, dur: 0.3 },
  );
  if (ev.status === 'removed')
    a.group.keys.push({ at: t + 0.2, opacity: 0.45, dur: 0.5 });
  if (ev.label) {
    const label = a.label;
    label.exitAt = t;
    label.exit = 'fade';
    label.exitDur = 0.2;
    a.group.children.push({
      ...label,
      id: `${a.id}.label-${build.count}`,
      text: String(ev.label).slice(0, 28),
      at: t + 0.15,
      enter: 'fade',
      dur: 0.3,
      exitAt: undefined,
      exit: undefined,
    });
  }
};

export const move: Handler = (build, { ev, where, t }) => {
  const a = actorOf(build, ev.actor, where);
  if (!finite(ev.x) && !finite(ev.y))
    fail(where, 'move needs x and/or y (frame pixels)');
  a.group.keys.push({
    at: t,
    ...(finite(ev.x) ? { x: ev.x - a.x } : {}),
    ...(finite(ev.y) ? { y: ev.y - a.y } : {}),
    dur: numberOr(ev.dur, 1.0, where, 'dur'),
    ease: ev.ease ?? 'inOut',
  });
};

export const show: Handler = (build, { ev, where, t }) => {
  const a = actorOf(build, ev.actor, where);
  a.group.at = t;
  a.appear = t;
};

/** The actor leaves, and every link that touches it with it. */
export const hide: Handler = (build, { ev, where, t }) => {
  const a = actorOf(build, ev.actor, where);
  Object.assign(a.group, {
    exitAt: t,
    exit: ev.exit ?? 'fade',
    exitDur: ev.dur ?? 0.4,
  });
  for (const l of build.links.values())
    if (l.from === ev.actor || l.to === ev.actor) {
      Object.assign(l.el, { exitAt: t, exit: 'fade', exitDur: ev.dur ?? 0.4 });
      if (l.label)
        Object.assign(l.label, {
          exitAt: t,
          exit: 'fade',
          exitDur: ev.dur ?? 0.4,
        });
    }
};

export const connect: Handler = (build, { ev, where, t }) => {
  linkOf(build, ev.link, where).el.at = t;
};

export const disconnect: Handler = (build, { ev, where, t }) => {
  const l = linkOf(build, ev.link, where);
  Object.assign(l.el, { exitAt: t, exit: 'undraw', exitDur: ev.dur ?? 0.5 });
  if (l.label)
    Object.assign(l.label, { exitAt: t, exit: 'fade', exitDur: ev.dur ?? 0.5 });
};
