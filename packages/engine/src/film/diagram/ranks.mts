export function layerRanks(slots: string[], links: [string, string][]) {
  const state = new Map<string, number>(),
    post: string[] = [],
    kept: [string, string][] = [];
  const incoming = new Set(links.map(([, b]) => b));
  const visit = (s: string) => {
    state.set(s, 1);
    for (const [a, b] of links)
      if (a === s) {
        if (state.get(b) === 1) continue;
        kept.push([a, b]);
        if (!state.has(b)) visit(b);
      }
    state.set(s, 2);
    post.push(s);
  };
  for (const s of [...slots.filter((s) => !incoming.has(s)), ...slots])
    if (!state.has(s)) visit(s);
  const rank = new Map(slots.map((s) => [s, 0]));
  for (const s of post.reverse())
    for (const [a, b] of kept)
      if (a === s)
        rank.set(b, Math.max(rank.get(b) ?? 0, (rank.get(a) ?? 0) + 1));
  return rank;
}
