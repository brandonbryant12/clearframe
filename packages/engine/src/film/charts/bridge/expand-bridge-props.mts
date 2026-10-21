import type { BlockProps as AuthoredProps } from '../../../engine/domain.mjs';
import { plotLayout } from '../../plots.mjs';

import type { HelperFrame } from '../../types.mjs';
import { check } from './check.mjs';
import { bridgeSpec } from './bridge-spec.mjs';
import { bridgeElements } from './bridge-elements.mjs';

export function expandBridgeProps(
  input: AuthoredProps,
  frame: HelperFrame,
): AuthoredProps {
  if (input?.bridge == null) return input;
  const { bridge, ...rest } = structuredClone(input);
  for (const key of [
    'plot',
    'bars',
    'stat',
    'distribution',
    'multiples',
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
    check(rest[key] == null, `cannot combine bridge with ${key}`);
  const p = bridgeSpec(bridge, rest.source);
  // Spoken cues are checked against the narration when the job is built; timed reveals need a reading hold here.
  const cued = p.end.say != null || p.steps.some((s) => s.say != null),
    end = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration + 0.5;
  if (frame.duration != null && !cued)
    check(
      frame.duration >= end + 2,
      'beat needs two seconds after the bridge settles',
    );
  const elements = bridgeElements(p, frame);
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
