import type { Point } from '../types.mjs';
import type {
  DiagramState,
  DiagramSpec,
  DiagramLayout,
  Box,
  Route,
  GroupFrame,
} from './contracts.mjs';
import {
  check,
  required,
  object,
  GROUP_KEYS,
  idRE,
  DIAGRAM_LIMITS,
} from './shared.mjs';
import { crosses } from './crosses.mjs';

import { labelSpot } from './labels.mjs';

export function routeLabels(
  input: DiagramSpec,
  { N, E }: DiagramState,
  layout: DiagramLayout,
  routes: Map<string, Route>,
): GroupFrame[] {
  const { slotOf, rectOf, slots, centre, u, size, gap, edgeSize, fits } =
    layout;
  const groups = input.groups ?? [];
  const L = DIAGRAM_LIMITS;
  const center = (id: string) => required(centre.get(id), id);
  const route = (id: string) => required(routes.get(id), id);
  const meets = (p: Box, q: Box) =>
    p.l < q.r && q.l < p.r && p.t < q.b && q.t < p.b;
  // Group frames, then labels placed where they collide least with lines, components,
  // frames and each other.
  const frames = groups.map((g, i): GroupFrame => {
    object(g, GROUP_KEYS, `groups[${i}]`);
    check(
      typeof g.id === 'string' &&
        idRE.test(g.id) &&
        !N.has(g.id) &&
        !E.has(g.id),
      `groups[${i}]: id must be a unique slug`,
    );
    check(
      typeof g.label === 'string' &&
        g.label.trim() &&
        g.label.length <= L.label,
      `${g.id} needs a label up to ${L.label} characters`,
    );
    check(
      Array.isArray(g.nodes) &&
        g.nodes.length &&
        g.nodes.every((id) => N.has(id)),
      `${g.id}.nodes must list existing node ids`,
    );
    const members = new Set(g.nodes.map(slotOf)),
      pad = u * 0.03,
      rs = [...members].map((m) => rectOf(center(m), pad));
    const box = {
      l: Math.min(...rs.map((q) => q.l)),
      r: Math.max(...rs.map((q) => q.r)),
      t: Math.min(...rs.map((q) => q.t)) - size * 1.1,
      b: Math.max(...rs.map((q) => q.b)),
    };
    for (const m of slots)
      if (!members.has(m))
        check(
          !meets(box, rectOf(center(m))),
          `${g.id} would enclose ${m}; place the group's nodes together (x, y) or split the shot`,
        );
    return { g, box, pad };
  });
  const segments = [...routes.entries()].flatMap(([id, r]) =>
    r.pts.slice(1).map((q, i) => ({ id, p: r.pts[i], q })),
  );
  const boxes = slots.map((m) => rectOf(center(m), gap));
  const rims = frames.flatMap(({ box: b }): [Point, Point][] => [
    [
      [b.l, b.t],
      [b.r, b.t],
    ],
    [
      [b.l, b.b],
      [b.r, b.b],
    ],
    [
      [b.l, b.t],
      [b.l, b.b],
    ],
    [
      [b.r, b.t],
      [b.r, b.b],
    ],
  ]);
  const placed: Box[] = [];
  for (const e of E.values()) {
    const r = route(e.id);
    if (r.label || !e.label) continue;
    // Edge labels sit a step below the components they connect, never under the phone floor.
    const font = edgeSize,
      width = e.label.length * 0.6 * font;
    const others = segments.filter((x) => x.id !== e.id);
    r.label = labelSpot(
      r.pts,
      { font, width, prefer: r.twoWay ? r.sign : 0 },
      (spot) =>
        10 * others.filter((x) => crosses(x.p, x.q, spot)).length +
        10 * boxes.filter((b) => meets(b, spot)).length +
        3 * rims.filter(([p, q]) => crosses(p, q, spot)).length +
        6 * placed.filter((b) => meets(b, spot)).length,
    );
    placed.push(required(r.label.box, 'label bounds'));
    delete r.label.box;
  }
  for (const e of E.values())
    if (e.label)
      check(
        fits(e.label, required(route(e.id).label, 'label').fit, 'mono'),
        `${e.id}: label "${e.label}" does not fit beside its ${Math.round(required(route(e.id).label, 'label').fit)} px connector at a readable size; shorten or drop it`,
      );

  return frames;
}
