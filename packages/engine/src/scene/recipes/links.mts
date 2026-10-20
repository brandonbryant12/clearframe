import { fail, fieldsOf, optString } from '../fields.mjs';

import { actorOf, cueOr, edgeGap } from '../stage-kit.mjs';
import type { StageBuild } from '../stage-kit.mjs';

import type { LeavingElement } from '../types.mjs';

/** Connectors between actors that follow them as they move. */
export function compileLinks(
  build: StageBuild,
  links: readonly unknown[],
): void {
  links.forEach((raw, i) => {
    const w0 = `${build.where}.links[${i}]`;
    const l = fieldsOf(raw);
    const [a, b] = [actorOf(build, l.from, w0), actorOf(build, l.to, w0)];
    const id = optString(l.id, w0, 'id') ?? `${a.id}-${b.id}`;
    if (build.links.has(id)) fail(w0, `duplicate link ${id}`);
    const [dx, dy] = [b.x - a.x, b.y - a.y];
    const appear = cueOr(
      build,
      l.say ?? l.at,
      Math.max(a.appear, b.appear) + 0.35,
    );
    const el: LeavingElement = {
      type: 'connector',
      id,
      from: a.id,
      to: b.id,
      route: l.route ?? 'curve',
      bend: l.bend ?? (l.route === 'straight' ? 0 : 0.12),
      gapFrom: edgeGap(a.w, a.h, dx, dy),
      gapTo: edgeGap(b.w, b.h, -dx, -dy),
      stroke: l.color ?? 'muted',
      width: l.width ?? 4,
      arrow: l.arrow ?? 'end',
      at: appear,
      enter: 'draw',
      dur: 0.7,
      keys: [],
      ...(l.dashed
        ? { dash: [10, 12], loop: { type: 'dash', period: 1.6 } }
        : {}),
    };
    // A label rides above a level link and beside a steep one, so it never sits on the line.
    const steep = Math.abs(dy) > Math.abs(dx) * 1.2;
    const label: LeavingElement | null = l.label
      ? {
          type: 'text',
          id: `${id}.label`,
          text: String(l.label).slice(0, 32),
          attach: { to: id, dx: steep ? 34 : 0, dy: steep ? 8 : -24 },
          anchor: steep ? 'start' : 'middle',
          size: 24,
          font: 'mono',
          fill: 'muted',
          at: appear + 0.3,
          enter: 'fade',
        }
      : null;
    build.links.set(id, { el, label, appear, from: a.id, to: b.id });
    build.out.links.push(el);
    if (label) build.out.links.push(label);
  });
}
