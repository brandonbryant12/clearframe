import type {
  Status,
  NodeState,
  EdgeState,
  ResolvedLifetime,
  Lifetime,
} from './contracts.mjs';
import { check, TIME, required } from './shared.mjs';
export function resolveLifetimes(
  N: Map<string, NodeState>,
  E: Map<string, EdgeState>,
  exact: boolean,
) {
  // ---- lifetimes: untimed nodes cascade in; connectors wait for both ends and leave with them
  let cascade = 0;
  for (const n of N.values()) {
    n.at ??= Math.min(1.2, cascade++ * 0.15);
    n.status[0][1] ??= 'neutral';
    if (exact && n.exitAt != null)
      check(n.exitAt >= n.at, `${n.id} exits before it appears`);
  }
  for (const e of E.values()) {
    const a = required(N.get(e.from), e.from),
      b = required(N.get(e.to), e.to),
      ready = Math.max(a.at ?? 0, b.at ?? 0) + TIME.node;
    e.at ??= ready;
    if (exact)
      check(
        e.at >= ready - 0.05,
        `${e.id} draws at ${e.at.toFixed(2)}s, before both ${e.from} and ${e.to} have appeared (${ready.toFixed(2)}s)`,
      );
    inheritExit(e, a, b, exact);
    // New wiring to a component added during the shot reads as added.
    e.status[0][1] ??=
      e.stepped ||
      (!e.timed && [a, b].some((n) => n.stepped && n.status[0][1] === 'added'))
        ? 'added'
        : 'neutral';
  }

  return {
    N: new Map(
      [...N].map(([id, node]) => [id, { ...node, ...resolvedLifetime(node) }]),
    ),
    E: new Map(
      [...E].map(([id, edge]) => [id, { ...edge, ...resolvedLifetime(edge) }]),
    ),
  };
}
function resolvedLifetime(value: Lifetime): ResolvedLifetime {
  check(value.at !== null, 'missing entrance time');
  const status: [number, Status][] = value.status.map(([at, status]) => {
    check(status !== undefined, 'missing status');
    return [at ?? 0, status];
  });
  return {
    at: value.at,
    exitAt: value.exitAt,
    timed: value.timed,
    stepped: value.stepped,
    status,
  };
}

function inheritExit(
  e: EdgeState,
  a: NodeState,
  b: NodeState,
  exact: boolean,
): void {
  const ends = [a.exitAt, b.exitAt].filter((v) => v != null);
  if (ends.length) {
    const gone = Math.min(...ends);
    // A connector to a removed component is marked and leaves with it.
    if (e.exitAt == null) {
      e.exitAt = gone;
      const marked = [a, b]
        .map(
          (n) => n.status.find(([t, s]) => t != null && s === 'removed')?.[0],
        )
        .filter((v) => v != null);
      if (marked.length) e.status.push([Math.min(...marked), 'removed']);
    } else if (exact)
      check(
        e.exitAt <= gone + 0.05,
        `${e.id} outlives ${a.exitAt === gone ? e.from : e.to}; a connector cannot dangle`,
      );
  }
}
