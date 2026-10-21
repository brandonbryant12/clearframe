import { plotLayout, titleShift } from './plots.mjs';
import { check, positionAt } from './decision-common.mjs';
import { lines } from './decision-labels.mjs';
import type { HelperFrame } from './types.mjs';
import type {
  DecisionSpec,
  DecisionLayout,
  DecisionBranch,
  DecisionNode,
  DecisionEntry,
  DecisionPoint,
} from './decision-contracts.mjs';
/** Positions: questions in columns by depth, outcomes in a final column, rows by first reach. */
export function layout(p: DecisionSpec, frame: HelperFrame): DecisionLayout {
  const { width: W, height: H } = frame,
    L = { ...plotLayout(frame) };
  const wide = W >= H;
  if (!wide) L.margin = Math.max(L.margin, Math.round(W * 0.115) + 4);
  const shift = titleShift(p.title, L, W - 2 * L.margin);
  const nodes: DecisionBranch[] = [],
    order: string[] = [];
  const depthOf = (node: DecisionNode, d: number): number =>
    node.ask ? Math.max(depthOf(node.yes, d + 1), depthOf(node.no, d + 1)) : d;
  const depth = depthOf(p.root, 0);
  const visit = (node: DecisionNode, d: number, key: string): DecisionEntry => {
    if (node.ask === undefined) {
      if (!order.includes(node.outcome)) order.push(node.outcome);
      return { outcome: node.outcome, pos: { x: 0, y: 0 } };
    }
    const kids = {
      yes: visit(node.yes, d + 1, `${key}-y`),
      no: visit(node.no, d + 1, `${key}-n`),
    };
    const entry: DecisionBranch = {
      key,
      ask: node.ask,
      d,
      kids,
      pos: { x: 0, y: 0 },
    };
    nodes.push(entry);
    return entry;
  };
  const tree = visit(p.root, 0, 'q');
  // Read on a phone: card type is 40 px in a wide frame (36 in a tall one), each card holds two
  // lines, and the case and its outcome sit above the rule in large type. A rule too broad or too
  // deep to keep that size is refused rather than shrunk.
  const font = wide ? 40 : 36,
    caseSize = wide ? 40 : 38;
  const left = L.margin,
    right = W - L.margin;
  const caseTop = L.keyY + shift;
  const top = caseTop + caseSize * 1.18 * 3 + (wide ? 30 : 50),
    bottom = L.bottom + (wide ? H * 0.03 : 0);
  // Wide: depth runs left to right. Tall: depth runs down the frame and outcomes sit along the foot.
  const cols = depth + 1,
    rows = order.length;
  check(
    depth <= 3,
    `the rule is ${depth} questions deep; at most 3 stay readable in one picture, so split it into two beats`,
  );
  check(
    rows <= 3,
    `the rule has ${rows} outcomes; at most 3 stay readable side by side on a phone, so split the rule into two beats`,
  );
  const across = wide ? (right - left) / cols : (bottom - top) / cols;
  const along = wide ? (bottom - top) / rows : (right - left) / rows;
  const card = wide
    ? { w: Math.min(across * 0.76, 480), h: 120 }
    : { w: Math.min(along * 0.92, 460), h: 120 };
  check(
    wide ? along >= card.h * 1.12 : across >= card.h * 1.6,
    'the rule does not fit this frame at a readable size; split it into two beats',
  );
  const room = card.w - 36,
    perLine = Math.floor(room / (font * 0.56));
  for (const label of [
    ...p.ask.map((q) => q.label),
    ...p.outcomes.map((o) => o.label),
  ])
    check(
      lines(label, room, font) <= 2,
      `"${label}" needs more than two lines in a card this size; keep it to about ${perLine * 2 - 4} characters`,
    );
  const outPos = new Map(
    order.map((o, i) => [
      o,
      wide
        ? { x: left + across * (cols - 0.5), y: top + along * (i + 0.5) }
        : { x: left + along * (i + 0.5), y: top + across * (cols - 0.5) },
    ]),
  );
  const place = (entry: DecisionEntry): DecisionPoint => {
    if (entry.outcome !== undefined) return positionAt(outPos, entry.outcome);
    const a = place(entry.kids.yes),
      b = place(entry.kids.no);
    entry.pos = wide
      ? { x: left + across * (entry.d + 0.5), y: (a.y + b.y) / 2 }
      : { x: (a.x + b.x) / 2, y: top + across * (entry.d + 0.5) };
    return entry.pos;
  };
  place(tree);
  return {
    L,
    W,
    H,
    wide,
    shift,
    nodes,
    order,
    outPos,
    card,
    font,
    caseSize,
    caseTop,
    top,
    left,
    right,
  };
}
