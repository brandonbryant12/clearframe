import type { BlockProps as AuthoredProps } from '../engine/domain.mjs';
import type { HelperFrame } from './types.mjs';
import type { ProcessWhen } from './process-contracts.mjs';
import { check } from './process-common.mjs';
import { processSpec } from './process-spec.mjs';
import { processElements } from './process-elements.mjs';
export { processSpec, processElements };
export { processModel } from './process-model.mjs';
export function expandProcessProps(
  input: AuthoredProps,
  frame: HelperFrame,
): AuthoredProps {
  if (input?.process == null) return input;
  const { process, ...rest } = structuredClone(input);
  for (const key of [
    'plot',
    'bars',
    'bridge',
    'breakdown',
    'decision',
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
    check(rest[key] == null, `cannot combine process with ${key}`);
  const p = processSpec(process);
  check(
    rest.source == null || rest.source === p.source,
    'the process names its source (or says it is an illustrative model) in process.source',
  );
  const resolve = frame.when;
  const when: ProcessWhen = resolve
    ? (r, fallback) =>
        r.say != null || r.cue != null || r.at != null
          ? resolve(r, fallback, 'process run')
          : fallback
    : (r, fallback) => r.at ?? fallback;
  const { elements, end } = processElements(p, frame, when);
  if (frame.duration != null)
    check(
      end <= frame.duration,
      `the model runs until ${end.toFixed(2)} s, after the beat ends at ${frame.duration.toFixed(2)} s; shorten the runs or lengthen the beat`,
    );
  return {
    ...rest,
    source: `${p.source}${p.asOf ? ` · ${p.asOf}` : ''}`,
    view: rest.view ?? [0, 0, frame.width, frame.height],
    elements: [...elements, ...(rest.elements ?? [])],
  };
}
