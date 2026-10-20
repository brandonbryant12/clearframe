import type { Point } from '../types.mjs';
import type { DiagramLayout, Route, RoutePlan } from './contracts.mjs';
import { required } from './shared.mjs';

import { rounded } from './rounded.mjs';
import { permutations } from './permutations.mjs';
import { tangles } from './tangles.mjs';

export function assignChannels(
  plans: RoutePlan[],
  routes: Map<string, Route>,
  { u, hw, hh, gap }: DiagramLayout,
): void {
  const channels = new Map<string, RoutePlan[]>();
  for (const p of plans) {
    const {
      a,
      b,
      sx,
      sy,
      horizontal,
      ends: [s, t],
    } = p;
    p.ports = horizontal
      ? [
          [a.x + sx * (hw + gap), a.y + s.offset],
          [b.x - sx * (hw + gap), b.y + t.offset],
        ]
      : [
          [a.x + s.offset, a.y + sy * (hh + gap)],
          [b.x + t.offset, b.y - sy * (hh + gap)],
        ];
    const [p0, p1] = p.ports,
      main = horizontal ? 0 : 1,
      cross = 1 - main;
    if (Math.abs(p0[cross] - p1[cross]) < 1) continue;
    p.mid = (p0[main] + p1[main]) / 2;
    const key = `${horizontal}:${Math.round(p.mid / (u * 0.03))}`;
    const entries = channels.get(key) ?? [];
    entries.push(p);
    channels.set(key, entries);
  }
  // Elbows sharing a gap each get their own run; try the orders and keep the fewest crossings.
  for (const list of channels.values()) optimizeChannel(list, u);
  for (const p of plans) {
    const pts = channelPath(p);
    routes.set(p.e.id, {
      d: rounded(pts, u * 0.014),
      pts,
      twoWay: p.twoWay,
      sign: Math.sign(p.ends[0].offset),
    });
  }
}

function channelPath(p: RoutePlan): Point[] {
  if (p.mid == null) return p.ports;
  if (p.horizontal)
    return [
      p.ports[0],
      [p.mid, p.ports[0][1]],
      [p.mid, p.ports[1][1]],
      p.ports[1],
    ];
  return [
    p.ports[0],
    [p.ports[0][0], p.mid],
    [p.ports[1][0], p.mid],
    p.ports[1],
  ];
}

function optimizeChannel(list: RoutePlan[], u: number): void {
  if (list.length < 2) return;
  const main = list[0].horizontal ? 0 : 1,
    centre0 = list.reduce((x, p) => x + (p.mid ?? 0), 0) / list.length;
  const room = Math.min(
    ...list.map((p) => Math.abs(p.ports[1][main] - p.ports[0][main])),
  );
  const step = Math.min(u * 0.024, (room * 0.6) / (list.length - 1));
  let best: { cost: number; mids: (number | undefined)[] } | null = null;
  for (const order of list.length > 5
    ? [[...list.keys()]]
    : permutations([...list.keys()])) {
    order.forEach((idx, j) => {
      list[idx].mid = centre0 + (j - (list.length - 1) / 2) * step;
    });
    const cost = tangles(list.map(channelPath));
    if (!best || cost < best.cost)
      best = { cost, mids: list.map((p) => p.mid) };
  }
  list.forEach((p, j) => {
    p.mid = required(best ?? undefined, 'channel order').mids[j];
  });
}
