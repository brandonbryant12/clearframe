import { utcDay } from '../../plot-data.mjs';

import type { BridgeSpec, BridgeSpecInput } from './contracts.mjs';
import { own } from './own.mjs';
import { words, finite, spoken } from './primitives.mjs';
import { check } from './check.mjs';
import { validateBridgeSteps } from './validate-bridge-steps.mjs';

export function bridgeSpec(input: unknown, source?: string | null): BridgeSpec {
  // Its fields are checked below.
  own<BridgeSpecInput>(
    input,
    [
      'title',
      'unit',
      'start',
      'steps',
      'end',
      'domain',
      'ticks',
      'decimals',
      'prefix',
      'suffix',
      'good',
      'orientation',
      'asOf',
      'source',
      'motion',
    ],
    'bridge',
  );
  const p: BridgeSpec = {
    orientation: 'auto',
    good: 'up',
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
    ['auto', 'vertical', 'horizontal'].includes(p.orientation),
    'orientation is auto, vertical or horizontal',
  );
  check(
    ['up', 'down'].includes(p.good),
    'good is up (an increase is good news) or down (a decrease is, as with costs)',
  );
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
    'domain needs [min, max] that includes zero, so the totals stand on an honest baseline',
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
  const inside = (v: number, name: string): void =>
    check(
      v >= p.domain[0] && v <= p.domain[1],
      `${name} lies outside the domain`,
    );
  for (const k of ['start', 'end'] as const) {
    const total = p[k];
    own(total, ['label', 'value', 'say'], k);
    words(total.label, `${k}.label`, 28);
    check(finite(total.value), `${k}.value must be a number`);
    spoken(total.say, k);
    inside(total.value, `${k}.value`);
  }
  check(
    p.start.say == null,
    'start appears with the chart; cue the drivers and the end instead',
  );
  check(
    Array.isArray(p.steps) && p.steps.length >= 1 && p.steps.length <= 10,
    'steps needs 1–10 drivers (subtotals included)',
  );
  // Display rounding is the only tolerance: what the viewer can add up must add up.
  const tolerance = 0.5 * 10 ** -p.decimals + 1e-9;
  const fmt = (v: number): string =>
    `${v < 0 ? '−' : ''}${p.prefix}${Math.abs(v).toFixed(p.decimals)}${p.suffix}`;
  const labels = new Set([p.start.label, p.end.label]);
  check(labels.size === 2, 'start and end need different labels');
  let level = p.start.value;
  level = validateBridgeSteps({ p, labels, level, tolerance, fmt, inside });
  check(
    Math.abs(level - p.end.value) <= tolerance,
    `the drivers take ${fmt(p.start.value)} to ${fmt(level)}, but end is ${fmt(p.end.value)}. ` +
      `Add the difference (${fmt(p.end.value - level)}) as an explicit step, for example {"label": "Other", "value": ${+(p.end.value - level).toFixed(p.decimals + 2)}}, rather than hiding it`,
  );
  if (p.motion === undefined)
    p.motion = { at: 0.5, duration: Math.min(1 + 0.6 * p.steps.length, 7) };
  if (p.motion !== 'none') {
    own(p.motion, ['at', 'duration'], 'motion');
    check(
      finite(p.motion.at) && p.motion.at >= 0 && p.motion.at <= 10,
      'motion.at must be 0–10 seconds',
    );
    check(
      finite(p.motion.duration) &&
        p.motion.duration >= 0.2 &&
        p.motion.duration <= 12,
      'motion.duration must be 0.2–12 seconds',
    );
  }
  return p;
}
