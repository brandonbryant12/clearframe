import type { Axis } from './contracts.mjs';
import { own } from './own.mjs';
import { check } from './check.mjs';
import { text } from './primitives.mjs';
import { axisValue } from './axis-value.mjs';
import { axisPosition } from './axis-position.mjs';
import { axisLabel } from './axis-label.mjs';

export function axisSpec(input: unknown, name: 'x' | 'y'): Axis {
  // Its fields are checked below.
  own<Axis>(
    input,
    [
      'type',
      'label',
      'domain',
      'ticks',
      'decimals',
      'prefix',
      'suffix',
      'dateFormat',
    ],
    name,
  );
  const a = structuredClone(input);
  check(
    (name === 'x' ? ['linear', 'date'] : ['linear', 'log']).includes(a.type),
    `${name}.type is unsupported`,
  );
  text(a.label, `${name}.label (including units)`, 45);
  check(
    Array.isArray(a.domain) && a.domain.length === 2,
    `${name}.domain needs [min,max]`,
  );
  const domain = a.domain.map((v) => axisValue(v, a.type));
  check(domain[0] < domain[1], `${name}.domain must increase`);
  check(
    Array.isArray(a.ticks) && a.ticks.length >= 2 && a.ticks.length <= 6,
    `${name}.ticks needs 2–6 explicit values`,
  );
  if (a.type === 'date') {
    check(
      a.decimals == null && a.prefix == null && a.suffix == null,
      'date axes cannot format numeric amounts',
    );
    a.dateFormat ??= 'date';
    check(
      ['date', 'month', 'year'].includes(a.dateFormat),
      'dateFormat must be date, month or year',
    );
  } else {
    check(a.dateFormat == null, 'numeric axes cannot use dateFormat');
    a.decimals ??= 0;
    check(
      Number.isInteger(a.decimals) && a.decimals >= 0 && a.decimals <= 6,
      'decimals must be 0–6',
    );
    for (const k of ['prefix', 'suffix'] as const) {
      const v = (a[k] ??= '');
      check(
        typeof v === 'string' && v.length <= 8,
        `${k} must be text up to 8 characters`,
      );
    }
  }
  let prev = -Infinity;
  const labels = new Set<string>();
  for (const tick of a.ticks) {
    const v = axisValue(tick, a.type);
    axisPosition(tick, a);
    check(v > prev, `${name}.ticks must strictly increase`);
    prev = v;
    if (a.type !== 'date')
      check(
        Math.abs(Number(v.toFixed(a.decimals)) - v) <=
          Number.EPSILON * Math.max(1, Math.abs(v)) * 8,
        `${name}.decimals would mislabel a tick value`,
      );
    const label = axisLabel(tick, a);
    check(!labels.has(label), `${name}.tick labels must remain distinct`);
    labels.add(label);
  }
  check(
    axisValue(a.ticks[0], a.type) === domain[0] &&
      axisValue(a.ticks.at(-1), a.type) === domain[1],
    `${name}.ticks must include both domain endpoints`,
  );
  return a;
}
