import { check, HOP, outcomeOf, positionAt } from './decision-common.mjs';
import type {
  DecisionScene,
  DecisionCase,
  DecisionSegment,
  DecisionEntry,
  DecisionDim,
} from './decision-contracts.mjs';
export function drawDecisionWalks({
  p,
  G,
  byAsk,
  edge,
  starts,
  back,
  timed,
  out,
}: DecisionScene): void {
  const { card } = G;
  // A walk: the path draws over the chosen connectors, hop by hop, and lights the cards it passes.
  const walkPath = (c: DecisionCase): DecisionSegment[] => {
    let node: DecisionEntry | undefined = byAsk.get('q');
    const segs: DecisionSegment[] = [];
    for (const step of c.path.slice(0, -1)) {
      check(
        node && 'kids' in node && step.answer,
        'case path must visit a question',
      );
      const e = edge(node, step.answer);
      segs.push({ node, step, d: e.d });
      node = node.kids[step.answer];
    }
    return segs;
  };
  const factual = walkPath(p.cases[0]);
  p.cases.forEach((c, ci) => {
    const t0 = starts[ci],
      segs = walkPath(c),
      outcome = outcomeOf(c);
    const ghostAt = ghostTime(ci, p.cases.length, starts, back);
    const restoreAt = ci === 0 && back != null ? back : null;
    // When the first case returns, the counterfactual's hops it shares with it step aside entirely
    // (they would sit over the restored path); where it diverged it stays as a ghost to compare.
    const dim: DecisionDim = (shared = false) =>
      ghostAt != null
        ? {
            keys: [
              { at: ghostAt, dur: 0.4, opacity: ci === 1 && shared ? 0 : 0.3 },
              ...(restoreAt != null
                ? [{ at: restoreAt, dur: 0.4, opacity: 1 }]
                : []),
            ],
          }
        : {};
    segs.forEach(({ node, d }, k) => {
      const at = t0 + k * HOP;
      const shared = ci === 1 && factual[k]?.d === d;
      out.push(
        {
          id: timed('walk', ci, k),
          type: 'path',
          d,
          fill: 'none',
          stroke: ci ? 'accent2' : 'accent',
          width: 7,
          cap: 'round',
          join: 'round',
          ...(ci ? { dash: [18, 10] } : {}),
          at,
          enter: 'draw',
          dur: HOP * 0.9,
          ...dim(shared),
        },
        {
          id: timed('walk', ci, k, 'card'),
          type: 'rect',
          x: node.pos.x - card.w / 2 - 5,
          y: node.pos.y - card.h / 2 - 5,
          w: card.w + 10,
          h: card.h + 10,
          r: 18,
          fill: 'none',
          stroke: ci ? 'accent2' : 'accent',
          width: 4,
          at,
          enter: 'fade',
          dur: 0.25,
          ...dim(shared || (ci === 1 && factual.some((f) => f.node === node))),
        },
      );
    });
    const pos = positionAt(G.outPos, outcome),
      arrive = t0 + segs.length * HOP;
    out.push({
      id: timed('walk', ci, 'out'),
      type: 'rect',
      x: pos.x - card.w / 2 - 6,
      y: pos.y - card.h / 2 - 6,
      w: card.w + 12,
      h: card.h + 12,
      r: card.h / 2 + 6,
      fill: 'none',
      stroke: ci ? 'accent2' : 'accent',
      width: 5,
      at: arrive,
      enter: 'draw',
      dur: 0.5,
      ...dim(),
    });
  });
}

function ghostTime(
  index: number,
  count: number,
  starts: number[],
  back: number | null,
): number | null {
  if (index === 0 && count === 2) return starts[1];
  if (index === 1) return back;
  return null;
}
