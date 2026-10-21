import type { Point } from '../types.mjs';
import type {
  DiagramState,
  DiagramLayout,
  ResolvedEdge,
  Box,
  Route,
  RoutePlan,
  Port,
} from './contracts.mjs';
import { required, r2 } from './shared.mjs';
import { crosses } from './crosses.mjs';
import { detour } from './detour.mjs';
import { rounded } from './rounded.mjs';

export function routePlans({ E, pairs }: DiagramState, layout: DiagramLayout) {
  const {
    slots,
    slotOf,
    life,
    rectOf,
    at,
    across,
    hw,
    hh,
    nw,
    nh,
    gap,
    area,
    u,
    size,
    centre,
  } = layout;
  const center = (id: string) => required(centre.get(id), id);
  // ---- routing: orthogonal connectors with rounded corners. Connectors on one side of a
  // component spread into their own ports, elbows sharing a gap take separate channels (no
  // two lines share a run), self-transitions loop, and a connector detours around any
  // component on screen in its way.
  const routes = new Map<string, Route>(),
    plans: RoutePlan[] = [];
  // Only components on screen while a connector is are in its way.
  const obstacles = (e: ResolvedEdge) =>
    slots
      .filter((s) => s !== slotOf(e.from) && s !== slotOf(e.to))
      .filter((s) => {
        const [s0, s1] = life(s);
        return s0 < (e.exitAt ?? Infinity) - 0.05 && e.at < s1 - 0.05;
      })
      .map((s) => rectOf(center(s), gap * 2));
  const blocked = (pts: Point[], others: Box[]) =>
    pts.some((q, i) => i > 0 && others.some((o) => crosses(pts[i - 1], q, o)));
  for (const e of E.values()) {
    const a = at(e.from),
      b = at(e.to);
    if (slotOf(e.from) === slotOf(e.to)) {
      const lift = nh * 0.75,
        x0 = a.x - nw * 0.18,
        x1 = a.x + nw * 0.18,
        top = a.y - hh - gap;
      routes.set(e.id, {
        d: `M ${r2(x0)} ${r2(top)} C ${r2(x0)} ${r2(top - lift)} ${r2(x1)} ${r2(top - lift)} ${r2(x1)} ${r2(top)}`,
        pts: [
          [x0, top],
          [a.x, top - lift * 0.75],
          [x1, top],
        ],
        label: {
          x: a.x,
          y: top - lift * 0.8 - size * 0.4,
          anchor: 'middle',
          fit: nw,
        },
      });
      continue;
    }
    const horizontal = across
      ? Math.abs(b.x - a.x) > hw
      : !(Math.abs(b.y - a.y) > hh);
    const sx = Math.sign(b.x - a.x) || 1,
      sy = Math.sign(b.y - a.y) || 1;
    const side = (out: boolean): Port['side'] => {
      if (horizontal) return sx > 0 === out ? 'r' : 'l';
      return sy > 0 === out ? 'b' : 't';
    };
    const p: RoutePlan = {
      e,
      a,
      b,
      horizontal,
      sx,
      sy,
      twoWay: pairs.has(`${e.to}>${e.from}`),
      others: obstacles(e),
      ends: [
        { slot: slotOf(e.from), side: side(true), other: b, offset: 0 },
        { slot: slotOf(e.to), side: side(false), other: a, offset: 0 },
      ],
      ports: [
        [a.x, a.y],
        [b.x, b.y],
      ],
    };
    // A connector that would run through a component leaves over (or beside) it instead.
    const straight: Point[] = horizontal
      ? [
          [a.x + sx * hw, a.y],
          [(a.x + b.x) / 2, a.y],
          [(a.x + b.x) / 2, b.y],
          [b.x - sx * hw, b.y],
        ]
      : [
          [a.x, a.y + sy * hh],
          [a.x, (a.y + b.y) / 2],
          [b.x, (a.y + b.y) / 2],
          [b.x, b.y - sy * hh],
        ];
    if (blocked(straight, p.others)) {
      const pts = detour(a, b, horizontal, p.others, {
        hw,
        hh,
        gap,
        area,
        lane: 0,
      });
      routes.set(e.id, { d: rounded(pts, u * 0.014), pts });
      continue;
    }
    plans.push(p);
  }
  return { routes, plans };
}
