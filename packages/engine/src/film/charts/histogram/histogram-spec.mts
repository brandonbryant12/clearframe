import { distribution } from '../../distribution-data.mjs';

import type { HistogramSpec, HistogramSpecInput } from './contracts.mjs';
import { own } from './own.mjs';
import { check } from './check.mjs';

export function histogramSpec(
  input: unknown,
  source?: string | null,
): HistogramSpec {
  // Its fields are checked below (the counting by distribution-data.mjs).
  own<HistogramSpecInput>(
    input,
    [
      'title',
      'unit',
      'observations',
      'edges',
      'threshold',
      'marker',
      'prefix',
      'suffix',
      'decimals',
      'tone',
      'asOf',
      'source',
      'motion',
    ],
    'distribution',
  );
  const p: HistogramSpec = {
    prefix: '',
    suffix: '',
    decimals: 0,
    tone: 'negative',
    ...structuredClone(input),
  };
  check(
    p.source == null || source == null || p.source === source,
    'source conflicts with props.source',
  );
  p.source ??= source ?? undefined;
  check(
    typeof p.title === 'string' && p.title.length <= 70,
    'title needs text up to 70 characters',
  );
  check(
    ['negative', 'highlight'].includes(p.tone),
    'tone is negative or highlight',
  );
  for (const k of ['prefix', 'suffix'] as const)
    check(
      typeof p[k] === 'string' && p[k].length <= 8,
      `${k} must be text up to 8 characters`,
    );
  check(
    Number.isInteger(p.decimals) && p.decimals >= 0 && p.decimals <= 2,
    'decimals must be 0–2',
  );
  own(p.threshold, ['value', 'relation', 'label'], 'threshold');
  check(
    typeof p.threshold.label === 'string' &&
      p.threshold.label.trim() &&
      p.threshold.label.length <= 32,
    'threshold.label names the qualifying outcomes, up to 32 characters',
  );
  const { label: _label, ...threshold } = p.threshold;
  // Counting needs a y scale; the editorial layout labels counts on the bars instead of drawing an axis.
  const probe = distribution({
    title: p.title,
    source: p.source,
    asOf: p.asOf,
    unit: p.unit,
    observations: p.observations,
    edges: p.edges,
    mode: 'count',
    threshold,
    y: { max: 1e6, ticks: [0, 1e6] },
  });
  const max = Math.max(...probe.bins.map((b) => b.count));
  p.model = distribution({
    title: p.title,
    source: p.source,
    asOf: p.asOf,
    unit: p.unit,
    observations: p.observations,
    edges: p.edges,
    mode: 'count',
    threshold,
    y: { max, ticks: [0, max] },
  });
  if (p.marker != null) {
    const marker = p.marker;
    own(marker, ['value', 'label'], 'marker');
    check(
      typeof marker.value === 'number' &&
        marker.value >= p.edges[0] &&
        marker.value <= p.edges[p.edges.length - 1],
      'marker.value must lie inside the bins',
    );
    check(
      typeof marker.label === 'string' &&
        marker.label.trim() &&
        marker.label.length <= 24,
      'marker.label needs text up to 24 characters',
    );
  }
  if (p.motion === undefined) p.motion = { at: 0.5, duration: 1.6 };
  if (p.motion !== 'none') {
    own(p.motion, ['at', 'duration'], 'motion');
    check(
      p.motion.at >= 0 &&
        p.motion.at <= 10 &&
        p.motion.duration >= 0.2 &&
        p.motion.duration <= 10,
      'motion needs at 0–10 and duration 0.2–10 seconds',
    );
  }
  return p;
}
