import type { DiagramLayout, RoutePlan, Port } from './contracts.mjs';

interface PortUse {
  end: Port;
  i: number;
  k: number;
}
export function assignPorts(
  plans: RoutePlan[],
  { nw, nh }: DiagramLayout,
): void {
  // Ports: connectors on one side of a component spread along it, ordered by where they go;
  // connectors never on screen together can share a port.
  const sides = new Map<string, PortUse[]>();
  plans.forEach((p, i) =>
    p.ends.forEach((end, k) => {
      const key = `${end.slot}:${end.side}`;
      const entries = sides.get(key) ?? [];
      entries.push({ end, i, k });
      sides.set(key, entries);
    }),
  );
  const together = (m: PortUse, n: PortUse) => {
    const [x, y] = [plans[m.i].e, plans[n.i].e];
    return (
      x.at < (y.exitAt ?? Infinity) - 0.05 &&
      y.at < (x.exitAt ?? Infinity) - 0.05
    );
  };
  for (const [key, ports] of sides) {
    const upright = /[lr]$/.test(key),
      len = upright ? nh : nw;
    ports.sort(
      (m, n) =>
        (upright
          ? m.end.other.y - n.end.other.y
          : m.end.other.x - n.end.other.x) ||
        m.i - n.i ||
        n.k - m.k,
    );
    for (const m of ports) {
      const live = ports.filter((n) => n === m || together(m, n)),
        c = live.length,
        j = live.indexOf(m);
      const span = Math.min(len * 0.6, (c - 1) * len * 0.25);
      m.end.offset = c === 1 ? 0 : -span / 2 + (j * span) / (c - 1);
      m.end.alone = c === 1;
    }
  }
  alignLevelPorts(plans);
}

function alignLevelPorts(plans: RoutePlan[]): void {
  // Components level with each other join with a straight line wherever one end is free to move.
  for (const p of plans) {
    const [s0, t0] = p.ends,
      level = Math.abs(p.horizontal ? p.a.y - p.b.y : p.a.x - p.b.x) < 1;
    if (level && t0.alone) t0.offset = s0.offset;
    else if (level && s0.alone) s0.offset = t0.offset;
  }
}
