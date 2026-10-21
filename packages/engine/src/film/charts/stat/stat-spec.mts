import { utcDay } from '../../plot-data.mjs';

import type { StatSpec, StatSpecInput } from './contracts.mjs';
import { own } from './own.mjs';
import { words, finite, affix } from './primitives.mjs';
import { check } from './check.mjs';

export function statSpec(input: unknown, source?: string | null): StatSpec {
  // Its fields are checked below.
  own<StatSpecInput>(
    input,
    [
      'kicker',
      'value',
      'decimals',
      'prefix',
      'suffix',
      'label',
      'change',
      'asOf',
      'source',
      'motion',
      'count',
    ],
    'stat',
  );
  const p: StatSpec = { decimals: 0, count: true, ...structuredClone(input) };
  if (p.kicker != null) words(p.kicker, 'kicker', 40);
  words(p.label, 'label (what the number measures, with its period)', 60);
  check(finite(p.value), 'value must be a finite number');
  check(
    Number.isInteger(p.decimals) && p.decimals >= 0 && p.decimals <= 2,
    'decimals must be 0–2',
  );
  p.prefix = affix(p.prefix, 'prefix');
  p.suffix = affix(p.suffix, 'suffix');
  check(typeof p.count === 'boolean', 'count is true or false');
  utcDay(p.asOf);
  check(
    p.source == null || source == null || p.source === source,
    'source conflicts with props.source',
  );
  p.source = words(p.source ?? source, 'source', 110);
  if (p.change != null) {
    const change = p.change;
    own(change, ['value', 'decimals', 'suffix', 'context', 'good'], 'change');
    check(finite(change.value), 'change.value must be a finite number');
    change.decimals ??= p.decimals;
    check(
      Number.isInteger(change.decimals) &&
        change.decimals >= 0 &&
        change.decimals <= 2,
      'change.decimals must be 0–2',
    );
    change.suffix = affix(change.suffix, 'change.suffix');
    words(
      change.context,
      'change.context (for example "vs a year earlier")',
      40,
    );
    // Whether a rise is good news depends on the measure (returns: up; inflation or fees: down).
    check(
      ['up', 'down', 'neutral'].includes(change.good ?? 'up'),
      'change.good is up, down or neutral',
    );
    change.good ??= 'up';
  }
  if (p.motion === undefined) p.motion = { at: 0.4, duration: 1.4 };
  if (p.motion !== 'none') {
    own(p.motion, ['at', 'duration'], 'motion');
    check(
      finite(p.motion.at) && p.motion.at >= 0 && p.motion.at <= 10,
      'motion.at must be 0–10 seconds',
    );
    check(
      finite(p.motion.duration) &&
        p.motion.duration >= 0.2 &&
        p.motion.duration <= 6,
      'motion.duration must be 0.2–6 seconds',
    );
  }
  return p;
}
