import { show, outcomeAt } from './decision-common.mjs';
import { fill, cardLabel } from './decision-labels.mjs';
import type { DecisionScene } from './decision-contracts.mjs';
export function drawDecisionBase({
  p,
  G,
  id,
  out,
  askLabel,
  edge,
}: DecisionScene): void {
  const { card, font } = G;
  // The rule: every question, connector, answer and outcome is there from the start, quietly.
  for (const n of G.nodes) {
    const q = askLabel(n.ask);
    out.push(
      {
        id: id('node', n.key),
        type: 'rect',
        x: n.pos.x - card.w / 2,
        y: n.pos.y - card.h / 2,
        w: card.w,
        h: card.h,
        r: 14,
        fill: 'surface',
        stroke: 'line',
        width: 2,
        ...show,
      },
      {
        id: id('node', n.key, 'label'),
        ...cardLabel(q.label, n.pos.x, n.pos.y, card.w, font, 'semibold'),
        ...show,
      },
    );
    for (const branch of ['yes', 'no'] as const) {
      const e = edge(n, branch);
      out.push(
        {
          id: id('edge', n.key, branch),
          type: 'path',
          d: e.d,
          fill: 'none',
          stroke: 'line',
          width: 3,
          ...show,
        },
        {
          id: id('edge', n.key, branch, 'label'),
          type: 'text',
          text: q[branch],
          x: e.label.x,
          y: e.label.y,
          size: font * 0.75,
          anchor: e.label.anchor ?? 'start',
          font: 'semibold',
          fill: 'muted',
          ...show,
        },
      );
    }
  }
  for (const [o, pos] of G.outPos) {
    const oc = outcomeAt(p, o);
    out.push(
      {
        id: id('out', o),
        type: 'rect',
        x: pos.x - card.w / 2,
        y: pos.y - card.h / 2,
        w: card.w,
        h: card.h,
        r: card.h / 2,
        fill: 'wash',
        stroke: fill(oc.tone),
        width: 2,
        ...show,
      },
      {
        id: id('out', o, 'label'),
        ...cardLabel(oc.label, pos.x, pos.y, card.w, font, 'strong'),
        ...show,
      },
    );
  }
}
