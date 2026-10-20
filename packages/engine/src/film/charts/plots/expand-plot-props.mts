import type { BlockProps as AuthoredProps } from '../../../engine/domain.mjs';
import { plotSpec, type AxisValue, type PlotSeries } from '../../plot-data.mjs';
import type { HelperFrame } from '../../types.mjs';
import { check } from './check.mjs';
import { plotElements } from './plot-elements.mjs';
import { gapNote } from './gap-note.mjs';
import { plotLayout } from './plot-layout.mjs';

export function expandPlotProps(
  input: AuthoredProps,
  frame: HelperFrame,
): AuthoredProps {
  if (input?.plot == null) return input;
  const { plot, ...rest } = structuredClone(input);
  for (const key of [
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
    check(rest[key] == null, `cannot combine plot with ${key}`);
  const p = plotSpec(plot, rest.source);
  const end = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration;
  if (frame.duration != null)
    check(
      frame.duration >= end + 2.15,
      'beat needs two seconds after the final plot labels settle',
    );
  const elements = plotElements(p, frame);
  if (frame.beatId)
    for (const el of elements) if (el.id) el.id = `${frame.beatId}-${el.id}`;
  // Disclose gaps inside a series; a series that simply starts or ends elsewhere is visible as such.
  const interior = (s: PlotSeries): AxisValue[] => {
    const i = s.values.findIndex((v) => v.y !== null),
      j = s.values.findLastIndex((v) => v.y !== null);
    return s.values
      .slice(i, j + 1)
      .filter((v) => v.y === null)
      .map((v) => v.x);
  };
  const missing = [...new Set(p.series.flatMap(interior))];
  const note = gapNote(missing);
  const L = plotLayout(frame);
  return {
    ...rest,
    sourceSize: Math.max(32, L.type * 0.95),
    source: `${p.source}${note ? ` ${note}` : ''} · ${p.asOf}`,
    view: [0, 0, frame.width, frame.height],
    elements: [...elements, ...(rest.elements ?? [])],
  };
}
