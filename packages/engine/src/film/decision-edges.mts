import { positionAt } from './decision-common.mjs';
import type {
  DecisionLayout,
  DecisionEntry,
  DecisionPoint,
  DecisionBranch,
  Answer,
  DecisionEdge,
} from './decision-contracts.mjs';
export function decisionEdges(G: DecisionLayout) {
  const { wide, card } = G;
  // Connector geometry from a question to a child (question or outcome): an elbow, out of the
  // card's far side, along the gap, into the child's near side.
  const childPos = (kid: DecisionEntry): DecisionPoint =>
    kid.outcome ? positionAt(G.outPos, kid.outcome) : kid.pos;
  const edge = (n: DecisionBranch, branch: Answer): DecisionEdge => {
    const a = n.pos,
      b = childPos(n.kids[branch]);
    if (wide) {
      // The branch bends near its child, so the Yes/No labels sit on the clear stretch by the question.
      const x1 = a.x + card.w / 2,
        x2 = b.x - card.w / 2,
        xm = Math.max((x1 + x2) / 2, x2 - 34);
      return {
        d: `M ${x1} ${a.y} H ${xm} V ${b.y} H ${x2}`,
        label: {
          x: x1 + 14,
          y: a.y + (b.y > a.y ? 34 : -14),
        },
      };
    }
    const y1 = a.y + card.h / 2,
      y2 = b.y - card.h / 2,
      ym = (y1 + y2) / 2;
    return {
      d: `M ${a.x} ${y1} V ${ym} H ${b.x} V ${y2}`,
      label: {
        x: a.x + (b.x < a.x ? -16 : 16),
        y: y1 + 34,
        anchor: b.x < a.x ? 'end' : 'start',
      },
    };
  };
  return edge;
}
