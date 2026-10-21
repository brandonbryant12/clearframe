import type { BlockProps as AuthoredProps } from '../../../engine/domain.mjs';
import { plotLayout } from '../../plots.mjs';

import type { HelperFrame } from '../../types.mjs';
import { check } from './check.mjs';
import { barsSpec } from './bars-spec.mjs';
import { barsElements } from './bars-elements.mjs';

export function expandBarsProps(
  input: AuthoredProps,
  frame: HelperFrame,
): AuthoredProps {
  if (input?.bars == null) return input;
  const { bars, ...rest } = structuredClone(input);
  for (const key of [
    'plot',
    'kpi',
    'teaching',
    'chart',
    'sketch',
    'plates',
    'world',
    'dolly',
    'focus',
    'view',
    'viewFrom',
    'viewTall',
    'viewDrift',
    'title',
  ] as const)
    check(rest[key] == null, `cannot combine bars with ${key}`);
  const p = barsSpec(bars, rest.source);
  const end = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration;
  if (frame.duration != null)
    check(
      frame.duration >= end + 2,
      'beat needs two seconds after the bars settle',
    );
  const elements = barsElements(p, frame);
  if (frame.beatId)
    for (const el of elements) el.id = `${frame.beatId}-${el.id}`;
  return {
    ...rest,
    sourceSize: Math.max(32, plotLayout(frame).type * 0.95),
    source: `${p.source} · ${p.asOf}`,
    view: [0, 0, frame.width, frame.height],
    elements: [...elements, ...(rest.elements ?? [])],
  };
}
