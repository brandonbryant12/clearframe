import { utcDay } from '../../plot-data.mjs';

import type { BarsSpec, BarsSpecInput } from './contracts.mjs';
import { own } from './own.mjs';
import { words, finite } from './primitives.mjs';
import { check } from './check.mjs';
import { validateBars } from './validate-bars.mjs';

export function barsSpec(input: unknown, source?: string | null): BarsSpec {
  // Its fields are checked below.
  own<BarsSpecInput>(
    input,
    [
      'title',
      'unit',
      'values',
      'domain',
      'ticks',
      'decimals',
      'prefix',
      'suffix',
      'orientation',
      'reference',
      'colors',
      'asOf',
      'source',
      'motion',
    ],
    'bars',
  );
  const p: BarsSpec = {
    orientation: 'vertical',
    colors: 'sign',
    decimals: 0,
    prefix: '',
    suffix: '',
    ...structuredClone(input),
  };
  words(p.title, 'title', 70);
  words(p.unit, 'unit (the value label, with units)', 45);
  utcDay(p.asOf);
  check(
    p.source == null || source == null || p.source === source,
    'source conflicts with props.source',
  );
  p.source = words(p.source ?? source, 'source', 110);
  check(
    ['vertical', 'horizontal'].includes(p.orientation),
    'orientation is vertical or horizontal',
  );
  check(['sign', 'single'].includes(p.colors), 'colors is sign or single');
  check(
    Number.isInteger(p.decimals) && p.decimals >= 0 && p.decimals <= 3,
    'decimals must be 0–3',
  );
  for (const k of ['prefix', 'suffix'] as const)
    check(
      typeof p[k] === 'string' && p[k].length <= 8,
      `${k} must be text up to 8 characters`,
    );
  check(
    Array.isArray(p.domain) &&
      p.domain.length === 2 &&
      p.domain.every(finite) &&
      p.domain[0] <= 0 &&
      p.domain[1] >= 0 &&
      p.domain[0] < p.domain[1],
    'domain needs [min, max] that includes zero, so bar length is honest',
  );
  check(
    Array.isArray(p.ticks) &&
      p.ticks.length >= 2 &&
      p.ticks.length <= 6 &&
      p.ticks.every(finite),
    'ticks needs 2–6 values',
  );
  check(
    p.ticks[0] === p.domain[0] &&
      p.ticks[p.ticks.length - 1] === p.domain[1] &&
      p.ticks.every((t, i) => !i || t > p.ticks[i - 1]),
    'ticks must increase and include both domain ends',
  );
  check(
    Array.isArray(p.values) &&
      p.values.length >= 2 &&
      p.values.length <= (p.orientation === 'vertical' ? 24 : 12),
    `values needs 2–${p.orientation === 'vertical' ? 24 : 12} bars`,
  );
  const labels = new Set<string>();
  validateBars(p, labels);
  if (p.reference != null) {
    const reference = p.reference;
    own(reference, ['value', 'label'], 'reference');
    check(
      finite(reference.value) &&
        reference.value >= p.domain[0] &&
        reference.value <= p.domain[1],
      'reference.value lies outside the domain',
    );
    words(reference.label, 'reference.label', 24);
  }
  if (p.motion === undefined) p.motion = { at: 0.5, duration: 1.6 };
  if (p.motion !== 'none') {
    own(p.motion, ['at', 'duration'], 'motion');
    check(
      finite(p.motion.at) && p.motion.at >= 0 && p.motion.at <= 10,
      'motion.at must be 0–10 seconds',
    );
    check(
      finite(p.motion.duration) &&
        p.motion.duration >= 0.2 &&
        p.motion.duration <= 10,
      'motion.duration must be 0.2–10 seconds',
    );
  }
  return p;
}
