import type { BlockProps as AuthoredProps } from '../engine/domain.mjs';
import type { HelperFrame } from './types.mjs';
import type { DecisionWhen } from './decision-contracts.mjs';
import { check } from './decision-common.mjs';
import { decisionSpec } from './decision-spec.mjs';
import { decisionElements } from './decision-elements.mjs';
export { decisionSpec, decisionElements };
export { HOP } from './decision-common.mjs';
export function expandDecisionProps(
  input: AuthoredProps,
  frame: HelperFrame,
): AuthoredProps {
  if (input?.decision == null) return input;
  const { decision, ...rest } = structuredClone(input);
  for (const key of [
    'plot',
    'bars',
    'bridge',
    'breakdown',
    'process',
    'stat',
    'distribution',
    'multiples',
    'kpi',
    'teaching',
    'chart',
    'sketch',
    'plates',
    'world',
    'title',
    'diagram',
  ] as const)
    check(rest[key] == null, `cannot combine decision with ${key}`);
  const p = decisionSpec(decision);
  check(
    rest.source == null || rest.source === p.source,
    'the decision names its rule source in decision.source',
  );
  const resolve = frame.when;
  const when: DecisionWhen = resolve
    ? (item, fallback) =>
        item.say != null || item.cue != null || item.at != null
          ? resolve(item, fallback, 'decision')
          : fallback
    : (item, fallback) => item.at ?? fallback;
  const { elements, end } = decisionElements(p, frame, when);
  if (frame.duration != null)
    check(
      end <= frame.duration,
      `the cases finish at ${end.toFixed(2)} s, after the beat ends at ${frame.duration.toFixed(2)} s; cue them earlier or lengthen the beat`,
    );
  return {
    ...rest,
    source: `${p.source}${p.asOf ? ` · ${p.asOf}` : ''}`,
    view: rest.view ?? [0, 0, frame.width, frame.height],
    elements: [...elements, ...(rest.elements ?? [])],
  };
}
