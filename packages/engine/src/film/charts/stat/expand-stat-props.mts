import type { BlockProps as AuthoredProps } from '../../../engine/domain.mjs';
import { plotLayout } from '../../plots.mjs';

import type { HelperFrame } from '../../types.mjs';
import { check } from './check.mjs';
import { statSpec } from './stat-spec.mjs';
import { statElements } from './stat-elements.mjs';

export function expandStatProps(
  input: AuthoredProps,
  frame: HelperFrame,
): AuthoredProps {
  if (input?.stat == null) return input;
  const { stat, ...rest } = structuredClone(input);
  for (const key of [
    'plot',
    'bars',
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
    check(rest[key] == null, `cannot combine stat with ${key}`);
  const p = statSpec(stat, rest.source);
  const end = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration + 0.65;
  if (frame.duration != null)
    check(
      frame.duration >= end + 2,
      'beat needs two seconds after the figure settles',
    );
  const elements = statElements(p, frame);
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
