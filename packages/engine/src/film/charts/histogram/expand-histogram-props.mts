import type { BlockProps as AuthoredProps } from '../../../engine/domain.mjs';

import { plotLayout } from '../../plots.mjs';

import type { HelperFrame } from '../../types.mjs';
import { check } from './check.mjs';
import { histogramSpec } from './histogram-spec.mjs';
import { histogramElements } from './histogram-elements.mjs';
import { missingNote } from './missing-note.mjs';

export function expandHistogramProps(
  input: AuthoredProps,
  frame: HelperFrame,
): AuthoredProps {
  if (input?.distribution == null) return input;
  const { distribution: spec, ...rest } = structuredClone(input);
  for (const key of [
    'plot',
    'bars',
    'stat',
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
    check(rest[key] == null, `cannot combine distribution with ${key}`);
  const p = histogramSpec(spec, rest.source);
  const end = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration + 0.5;
  if (frame.duration != null)
    check(
      frame.duration >= end + 2,
      'beat needs two seconds after the threshold and marker land',
    );
  const elements = histogramElements(p, frame);
  if (frame.beatId)
    for (const el of elements) el.id = `${frame.beatId}-${el.id}`;
  const missing = missingNote(p.model.missing);
  return {
    ...rest,
    sourceSize: Math.max(32, plotLayout(frame).type * 0.95),
    source: `${p.source}${missing} · ${p.asOf}`,
    view: [0, 0, frame.width, frame.height],
    elements: [...elements, ...(rest.elements ?? [])],
  };
}
