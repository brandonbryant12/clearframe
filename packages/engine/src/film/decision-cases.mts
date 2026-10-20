import {
  check,
  HOP,
  answerAt,
  outcomeAt,
  outcomeOf,
} from './decision-common.mjs';
import { fill, lines } from './decision-labels.mjs';
import type { DecisionScene, DecisionCase } from './decision-contracts.mjs';
export function drawDecisionCases({
  p,
  G,
  askLabel,
  starts,
  back,
  timed,
  out,
}: DecisionScene): void {
  // The case line: what this case is, every answer it gives; a changed answer is marked.
  const caseText = (c: DecisionCase): string =>
    `${c.label}: ${p.ask
      .filter((q) => c.answers[q.id] != null)
      .map(
        (q) => `${q.label} ${q[answerAt(c.answers[q.id], `answers.${q.id}`)]}`,
      )
      .join(' · ')}`;
  const caseY = G.caseTop,
    width = G.W - 2 * G.L.margin;
  for (const c of p.cases)
    check(
      lines(caseText(c), width, G.caseSize) <= 2,
      `the case line "${caseText(c)}" needs more than two lines; shorten the case label or the questions`,
    );
  p.cases.forEach((c, ci) => {
    const t0 = starts[ci],
      next = ci + 1 < p.cases.length ? starts[ci + 1] : null;
    const text = caseText(c);
    // Only answers this case's line actually shows can be marked as changed (a counterfactual that
    // ends sooner no longer answers a later question, so that answer is not on its line at all).
    const changed = (c.changed ?? [])
      .filter((k) => c.answers[k] != null)
      .map(
        (k) =>
          `${askLabel(k).label} ${askLabel(k)[answerAt(c.answers[k], `answers.${k}`)]}`,
      );
    // Each case's line is on screen while it is the case being shown (the first returns with it);
    // the next line's fade-in starts as this one leaves, so two lines never share the frame.
    const lead = 0.3;
    const spans = caseSpans(ci, t0, lead, next, back);
    // The outcome it reaches, under the case line in its tone, once the walk arrives (never before).
    const outcome = outcomeAt(p, outcomeOf(c)),
      arrive = t0 + (c.path.length - 1) * HOP;
    const outY = caseY + G.caseSize * 1.18 * lines(text, width, G.caseSize) + 6;
    spans.forEach(([a, b], si) =>
      out.push(
        {
          id: timed('case', ci, si),
          type: 'text',
          text,
          x: G.L.margin,
          y: caseY,
          size: G.caseSize,
          font: 'semibold',
          fill: 'ink',
          width,
          leading: 1.18,
          at: Math.max(0, a),
          enter: 'fade',
          dur: 0.3,
          ...(b != null ? { exit: 'none', exitAt: b } : {}),
          ...(changed.length && si === 0
            ? {
                marks: changed.map((w) => ({
                  words: w,
                  style: 'highlight',
                  at: t0,
                })),
              }
            : {}),
        },
        {
          id: timed('case', ci, si, 'outcome'),
          type: 'text',
          text: `→ ${outcome.label}`,
          x: G.L.margin,
          y: outY,
          size: G.caseSize,
          font: 'strong',
          fill: outcome.tone ? fill(outcome.tone) : 'ink',
          at: si === 0 ? arrive : Math.max(0, a),
          enter: si === 0 ? 'rise' : 'fade',
          dur: 0.3,
          ...(b != null ? { exit: 'none', exitAt: b } : {}),
        },
      ),
    );
  });
}

function caseSpans(
  ci: number,
  t0: number,
  lead: number,
  next: number | null,
  back: number | null,
): Array<[number, number | null]> {
  if (ci !== 0) return [[t0 - lead, back]];
  const spans: Array<[number, number | null]> = [
    [t0 - lead, next != null ? next - lead : null],
  ];
  if (back != null) spans.push([back, null]);
  return spans;
}
