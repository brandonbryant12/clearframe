import type { BlockProps as AuthoredProps } from '../engine/domain.mjs';
import type { HelperFrame } from './types.mjs';
import { check } from './teaching-common.mjs';
import { teachingSpec } from './teaching-spec.mjs';
import { teachingElements } from './teaching-elements.mjs';
export { teachingSpec, teachingElements };
export function expandTeachingProps(
  input: AuthoredProps,
  frame: HelperFrame,
): AuthoredProps {
  if (input?.teaching == null) return input;
  const { teaching, ...rest } = structuredClone(input);
  check(rest.plot == null, 'cannot combine teaching with plot');
  check(
    rest.kpi == null &&
      rest.chart == null &&
      rest.sketch == null &&
      rest.plates == null,
    'cannot combine teaching with kpi, chart, sketch or plates shorthand',
  );
  const p = teachingSpec(teaching, rest.source),
    drawn = teachingElements(p, frame);
  if (frame.beatId)
    for (const el of drawn) if (el.id) el.id = `${frame.beatId}-${el.id}`;
  return {
    ...rest,
    source: p.source,
    view: [0, 0, frame.width, frame.height],
    elements: [...drawn, ...(rest.elements ?? [])],
  };
}
