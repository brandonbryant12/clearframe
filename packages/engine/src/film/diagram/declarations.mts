import type {
  DiagramSpec,
  DiagramOptions,
  NodeState,
  EdgeState,
} from './contracts.mjs';
import {
  check,
  object,
  KINDS,
  NODE_KEYS,
  EDGE_KEYS,
  DIAGRAM_LIMITS,
  idRE,
} from './shared.mjs';
import { diagramClock, statusOk } from './cues.mjs';
export function declareDiagram(
  input: DiagramSpec,
  resolve: DiagramOptions['resolve'],
) {
  const L = DIAGRAM_LIMITS;
  const { nodes, edges = [] } = input;
  const { cueOf } = diagramClock(resolve);
  // ---- the cast: nodes and edges with identities, lifetimes and status timelines
  const N = new Map<string, NodeState>();
  nodes.forEach((n, i) => {
    const where = `nodes[${i}]`;
    object(n, NODE_KEYS, where);
    check(
      typeof n.id === 'string' && idRE.test(n.id) && !N.has(n.id),
      `${where}: node ids must be unique lowercase slugs`,
    );
    check(
      typeof n.label === 'string' &&
        n.label.trim() &&
        n.label.length <= L.label,
      `${n.id} needs a label up to ${L.label} characters`,
    );
    check(
      KINDS.includes(n.kind ?? 'service'),
      `${n.id}: kind must be ${KINDS.join(', ')}`,
    );
    statusOk(n.status, n.id);
    check((n.x == null) === (n.y == null), `${n.id}: set both x and y`);
    for (const k of ['x', 'y'] as const)
      if (n[k] != null)
        check(
          Number.isFinite(n[k]) && n[k] >= 0 && n[k] <= 1,
          `${n.id}.${k} must be 0–1`,
        );
    N.set(n.id, {
      ...n,
      order: i,
      kind: n.kind ?? 'service',
      ...cueOf(n, n.id),
      timed: n.at != null || n.say != null,
      status: [[null, n.status]],
    });
  });
  const E = new Map<string, EdgeState>(),
    pairs = new Set<string>();
  edges.forEach((e, i) => {
    const where = `edges[${i}]`;
    object(e, EDGE_KEYS, where);
    const id = e.id ?? `${e.from}-${e.to}`;
    check(
      N.has(e.from) && N.has(e.to),
      `${id}: edges need existing node ids (from, to)`,
    );
    check(
      typeof id === 'string' && idRE.test(id) && !E.has(id) && !N.has(id),
      `${where}: edge ids must be unique slugs, distinct from node ids`,
    );
    check(
      e.label == null ||
        (typeof e.label === 'string' && e.label.length <= L.label),
      `${id}: label must be up to ${L.label} characters`,
    );
    check(
      ['solid', 'dashed'].includes(e.style ?? 'solid'),
      `${id}: style must be solid or dashed`,
    );
    check(
      e.flow == null || typeof e.flow === 'boolean',
      `${id}: flow must be true or false`,
    );
    statusOk(e.status, id);
    E.set(id, {
      ...e,
      id,
      ...cueOf(e, id),
      timed: e.at != null || e.say != null,
      status: [[null, e.status]],
    });
    pairs.add(`${e.from}>${e.to}`);
  });

  return { N, E, pairs };
}
