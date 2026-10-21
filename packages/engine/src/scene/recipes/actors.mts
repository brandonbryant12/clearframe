import { fail, fieldsOf, finite, optNumber, own } from '../fields.mjs';
import type { Fields } from '../fields.mjs';
import { ACTOR_KINDS, cardSize, cueOr, statusColor } from '../stage-kit.mjs';
import type { Actor, LabelElement, StageBuild } from '../stage-kit.mjs';

import type { ActorGroup, KeyedElement, PlanElement } from '../types.mjs';
import { SLUG } from './contracts.mjs';

export interface ActorPlace {
  id: string;
  label: string;
  icon: unknown;
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
  appear: number;
}

/** A card with an icon, a label and a status light; the group carries the identity. */
export function actorEntry(a: Fields, p: ActorPlace): Actor {
  const { id, w, h, color } = p;
  const card: KeyedElement = {
    type: 'rect',
    id: `${id}.card`,
    x: -w / 2,
    y: -h / 2,
    w,
    h,
    r: 22,
    fill: 'surface',
    stroke: color,
    width: 3,
    enter: 'none',
    keys: [],
  };
  const dot: KeyedElement = {
    type: 'circle',
    id: `${id}.status`,
    cx: w / 2 - 22,
    cy: -h / 2 + 22,
    r: 7,
    fill: color === 'line' ? 'muted' : color,
    enter: 'none',
    keys: [],
  };
  const label: LabelElement = {
    type: 'text',
    id: `${id}.label`,
    text: p.label,
    x: -w / 2 + 88,
    y: (a.detail ? -14 : 0) + 11,
    size: 32,
    font: 'strong',
    fill: 'ink',
    enter: 'none',
    fit: w - 120,
  };
  const children: PlanElement[] = [
    card,
    {
      type: 'icon',
      id: `${id}.icon`,
      name: p.icon,
      x: -w / 2 + 48,
      y: a.detail ? -14 : 0,
      size: 44,
      stroke: 'accent',
      enter: 'none',
    },
    label,
    dot,
  ];
  if (a.detail)
    children.push({
      type: 'text',
      id: `${id}.detail`,
      text: String(a.detail).slice(0, 40),
      x: -w / 2 + 28,
      y: 44,
      size: 22,
      font: 'mono',
      fill: 'muted',
      enter: 'none',
      fit: w - 56,
    });
  const group: ActorGroup = {
    type: 'group',
    id,
    x: p.x,
    y: p.y,
    at: p.appear,
    enter: a.enter ?? 'pop',
    dur: a.dur,
    keys: [],
    children,
    ...(a.z != null ? { z: a.z } : {}),
  };
  return {
    id,
    color,
    group,
    card,
    dot,
    label,
    w,
    h,
    appear: p.appear,
    x: p.x,
    y: p.y,
  };
}

export function compileActors(
  build: StageBuild,
  actors: readonly unknown[],
): void {
  actors.forEach((raw, i) => {
    const w0 = `${build.where}.actors[${i}]`;
    const a = fieldsOf(raw);
    const { id, x, y } = a;
    if (typeof id !== 'string' || !SLUG.test(id))
      return fail(w0, 'needs an id (a slug)');
    if (build.actors.has(id)) fail(w0, `duplicate actor ${id}`);
    if (!finite(x) || !finite(y))
      return fail(w0, 'needs x and y (the card centre, in frame pixels)');
    const kind = a.kind ?? 'service';
    const icon =
      own(ACTOR_KINDS, kind) ??
      fail(w0, `kind is ${Object.keys(ACTOR_KINDS).join(', ')}`);
    const label = String(a.label ?? id);
    if (label.length > 28) fail(w0, 'labels are at most 28 characters');
    const { w, h } = cardSize(
      label,
      a.detail,
      optNumber(a.w, w0, 'w'),
      optNumber(a.h, w0, 'h'),
    );
    const appear = cueOr(build, a.say ?? a.at, 0.2 + i * 0.15);
    const actor = actorEntry(a, {
      id,
      label,
      icon: a.icon ?? icon,
      color: statusColor(a.status),
      x,
      y,
      w,
      h,
      appear,
    });
    build.actors.set(id, actor);
    build.out.actors.push(actor.group);
  });
}
