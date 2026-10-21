import { titleText } from './plots.mjs';
import { check } from './decision-common.mjs';
import { layout } from './decision-layout.mjs';
import { decisionEdges } from './decision-edges.mjs';
import { decisionSchedule } from './decision-schedule.mjs';
import { drawDecisionBase } from './decision-base.mjs';
import { drawDecisionCases } from './decision-cases.mjs';
import { drawDecisionWalks } from './decision-walks.mjs';
import type {
  DecisionSpec,
  DecisionWhen,
  DecisionId,
  DecisionAsk,
  DecisionScene,
} from './decision-contracts.mjs';
import type { HelperFrame, CanvasElement } from './types.mjs';
/** Canvas elements for one beat; `when(item, fallback)` resolves say/cue/at. */
export function decisionElements(
  p: DecisionSpec,
  frame: HelperFrame,
  when: DecisionWhen = (item, fallback) => item.at ?? fallback,
) {
  const G = layout(p, frame);
  const id: DecisionId = (...k) => `dc-${p.id}-${k.join('-')}`;
  // The rule's cards and connectors are the same objects in every beat (they may morph across a
  // cut); the timed case lines and walks belong to this beat, so their ids carry the beat's.
  const timed: DecisionId = (...k) =>
    frame.beatId ? `${frame.beatId}-${id(...k)}` : id(...k);
  const title = titleText(p.title, G.L, G.W - 2 * G.L.margin);
  title.id = id('title');
  const out: CanvasElement[] = [title];
  const byAsk = new Map(G.nodes.map((n) => [n.key, n]));
  const askLabel = (k: string): DecisionAsk => {
    const q = p.ask.find((q) => q.id === k);
    check(q, `missing question ${k}`);
    return q;
  };
  const edge = decisionEdges(G);
  const { starts, clock, back } = decisionSchedule(p, when);
  const scene: DecisionScene = {
    p,
    frame,
    G,
    id,
    timed,
    out,
    byAsk,
    askLabel,
    edge,
    starts,
    clock,
    back,
  };
  drawDecisionBase(scene);
  drawDecisionCases(scene);
  drawDecisionWalks(scene);
  return { elements: out, end: back != null ? back + 0.6 : clock };
}
