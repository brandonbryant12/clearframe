import type { DiagramState } from './contracts.mjs';
import { check, required } from './shared.mjs';
import { layerRanks } from './ranks.mjs';
export function diagramRanks({
  N,
  E,
  exact,
}: Pick<DiagramState, 'N' | 'E' | 'exact'>) {
  const node = (id: string) => required(N.get(id), id);
  // ---- layout: slots (a replacement takes the replaced node's place), ranked along the edges
  const slotOf = (id: string): string => {
    const seen = new Set<string>();
    let n = node(id);
    while (n.replaces != null) {
      check(
        N.has(n.replaces) && !seen.has(n.id),
        `${n.id}.replaces must name another node`,
      );
      seen.add(n.id);
      n = node(n.replaces);
    }
    return n.id;
  };
  for (const n of N.values()) {
    if (n.replaces == null) continue;
    check(
      n.replaces !== n.id && N.has(n.replaces),
      `${n.id}.replaces must name another node`,
    );
    const old = node(n.replaces);
    check(
      n.x == null,
      `${n.id}: a replacement takes ${old.id}'s place; drop x and y`,
    );
    if (exact)
      check(
        old.exitAt != null && n.at >= old.exitAt - 0.45,
        `${n.id} replaces ${old.id}, which must leave first (remove or replace it in a step)`,
      );
  }
  const slots = [...new Set([...N.keys()].map(slotOf))];
  const links = [...E.values()]
    .map((e): [string, string] => [slotOf(e.from), slotOf(e.to)])
    .filter(([a, b]) => a !== b);
  const rank = layerRanks(slots, links);
  const rankOf = (id: string) => required(rank.get(id), id);
  const ranks = Math.max(...rank.values()) + 1;
  const byRank: string[][] = Array.from({ length: ranks }, () => []);
  for (const s of slots) byRank[rankOf(s)].push(s);
  // One barycentre pass keeps connected nodes level with each other.
  const pos = new Map<string, number>();
  byRank.forEach((row, r) => {
    if (r > 0) {
      const bary = (s: string) => {
        const preds = links
          .filter(([a, b]) => b === s && rankOf(a) < r)
          .map(([a]) => pos.get(a) ?? 0);
        return preds.length
          ? preds.reduce((x, y) => x + y, 0) / preds.length
          : null;
      };
      const keyed = row.map((s, j) => ({ s, k: bary(s) ?? j }));
      keyed.sort((a, b) => a.k - b.k || node(a.s).order - node(b.s).order);
      row.splice(0, row.length, ...keyed.map((x) => x.s));
    }
    row.forEach((s, j) => pos.set(s, j));
  });
  return { slotOf, slots, rankOf, ranks, byRank, pos };
}
