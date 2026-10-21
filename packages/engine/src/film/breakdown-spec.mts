import { utcDay } from './plot-data.mjs';
import {
  check,
  own,
  words,
  timing,
  finite,
  slug,
  RESIDUAL_ID,
  normalizePart,
} from './breakdown-common.mjs';
import { decodeBreakdown } from './breakdown-schema.mjs';
import type {
  BreakdownSpec,
  BreakdownTotal,
  BreakdownPart,
} from './breakdown-contracts.mjs';
/** Validate a breakdown, reconcile every parent and return it with ids and explicit remainders. */
export function breakdownSpec(input: unknown, source?: string): BreakdownSpec {
  own(
    input,
    [
      'id',
      'title',
      'unit',
      'asOf',
      'source',
      'decimals',
      'prefix',
      'suffix',
      'total',
      'parts',
      'residual',
      'focus',
      'open',
      'gather',
      'motion',
    ],
    'breakdown',
  );
  const decoded = decodeBreakdown(input);
  const p = {
    ...decoded,
    id: decoded.id ?? 'breakdown',
    decimals: decoded.decimals ?? 0,
    prefix: decoded.prefix ?? '',
    suffix: decoded.suffix ?? '',
    parts: decoded.parts.map(normalizePart),
  };
  check(
    typeof p.id === 'string' && /^[a-z][a-z0-9-]{0,23}$/.test(p.id),
    'id is a short lowercase name (letters, digits, -) shared by every beat of this breakdown',
  );
  words(p.title, 'title', 70);
  words(p.unit, 'unit (what the values are, with units)', 45);
  utcDay(p.asOf);
  check(
    p.source == null || source == null || p.source === source,
    'source conflicts with props.source',
  );
  p.source = words(p.source ?? source, 'source', 110);
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
    p.motion == null || p.motion === 'none',
    'motion is "none" to hold the finished picture',
  );
  // One rounding path for everything printed and everything checked: the formatter's own digits.
  const digits = (v: number): string =>
    v.toLocaleString('en-US', {
      minimumFractionDigits: p.decimals,
      maximumFractionDigits: p.decimals,
    });
  const fmt = (v: number): string => `${p.prefix}${digits(v)}${p.suffix}`;

  // Raw values reconcile exactly (floating-point noise aside); what is printed is checked separately.
  const exact = (v: number): number => 1e-9 * Math.max(1, Math.abs(v));
  // A printed value in units of its last decimal, read back from exactly what is printed.
  const units = (v: number): number =>
    Math.round(Number(digits(v).replace(/,/g, '')) * 10 ** p.decimals);
  const printed = (
    parent: BreakdownTotal,
    parts: BreakdownPart[],
    _name: string,
  ): void => {
    for (const x of parts)
      check(
        units(x.value) > 0,
        `${x.label} (${x.value}) prints as ${fmt(0)} at ${p.decimals} decimal${p.decimals === 1 ? '' : 's'}; show more decimals so every part, remainder included, is seen`,
      );
    const sum = parts.reduce((a, x) => a + units(x.value), 0);
    check(
      sum === units(parent.value),
      `at ${p.decimals} decimal${p.decimals === 1 ? '' : 's'} the parts of ${parent.label} print as ${parts.map((x) => fmt(x.value)).join(' + ')} = ${fmt(sum / 10 ** p.decimals)}, next to ${fmt(parent.value)}; ` +
        `show more decimals${p.decimals < 3 ? ` (decimals: ${p.decimals + 1})` : ''} so what is printed adds up`,
    );
  };
  own(p.total, ['label', 'value'], 'total');
  words(p.total.label, 'total.label', 40);
  check(
    finite(p.total.value) && p.total.value > 0,
    'total.value must be a positive number (a breakdown divides a whole)',
  );
  const reconcile = (
    parent: BreakdownTotal,
    parts: BreakdownPart[],
    residual: true | string | undefined,
    name: string,
  ): BreakdownPart[] => {
    check(
      Array.isArray(parts) && parts.length >= 2 && parts.length <= 8,
      `${name}.parts needs 2–8 parts`,
    );
    const ids = new Set<string>();
    parts.forEach((part, i) => {
      const where = `${name}.parts[${i}]`;
      own(
        part,
        [
          'id',
          'label',
          'value',
          'say',
          'cue',
          'at',
          'after',
          'highlight',
          'parts',
          'residual',
        ],
        where,
      );
      words(part.label, `${where}.label`, 40);
      check(finite(part.value), `${where}.value must be a number`);
      check(
        part.value > 0,
        `${where} (${part.label}) is ${invalidValue(part.value)}`,
      );
      timing(part, where);
      part.id = part.id ?? slug(part.label);
      check(
        typeof part.id === 'string' &&
          /^[a-z0-9][a-z0-9-]{0,23}$/.test(part.id),
        `${where}.id is a short lowercase name`,
      );
      check(
        part.id !== RESIDUAL_ID && !ids.has(part.id),
        `${where}: part ids must be unique (two parts are called ${part.id}); give one an id`,
      );
      ids.add(part.id);
      check(
        part.highlight == null || typeof part.highlight === 'boolean',
        `${where}.highlight is true or false`,
      );
    });
    check(
      residual == null ||
        residual === true ||
        (typeof residual === 'string' &&
          residual.trim() &&
          residual.length <= 40),
      `${name}.residual is true or the remainder's label (up to 40 characters)`,
    );
    const sum = parts.reduce((a, x) => a + x.value, 0),
      gap = parent.value - sum;
    if (Math.abs(gap) <= exact(parent.value)) {
      printed(parent, parts, name);
      return parts;
    }
    check(
      gap > 0 || residual == null,
      `the parts of ${parent.label} add up to ${fmt(sum)}, more than ${parent.label} (${fmt(parent.value)}) by ${fmt(-gap)}. ` +
        'A negative remainder is not a share of the whole: show this reconciliation as a bridge (docs/bridge.md), or correct the figures',
    );
    check(
      residual != null,
      `the parts of ${parent.label} add up to ${fmt(sum)}, but ${parent.label} is ${fmt(parent.value)}. ` +
        `Add the difference (${fmt(Math.abs(gap))}) as a part, or set residual: true on ${name === 'breakdown' ? 'the breakdown' : name} to show it as an explicit "Not explained" share`,
    );
    const all = [
      ...parts,
      {
        id: RESIDUAL_ID,
        label: residual === true ? 'Not explained' : residual,
        value: gap,
        remainder: true,
      },
    ];
    printed(parent, all, name);
    return all;
  };
  p.parts = reconcile(p.total, p.parts, p.residual, 'breakdown');
  for (const [i, part] of p.parts.entries()) {
    if (part.remainder || part.parts == null) continue;
    part.parts = reconcile(part, part.parts, part.residual, `parts[${i}]`);
    for (const [j, child] of part.parts.entries())
      check(
        child.remainder || child.parts == null,
        `parts[${i}].parts[${j}]: a breakdown opens one level per beat; open ${child.label} in a breakdown of its own`,
      );
    delete part.residual;
  }
  const opens = (['focus', 'open', 'gather'] as const).filter(
    (k) => p[k] != null,
  );
  check(
    opens.length <= 1,
    'a beat shows the whole, opens one part (open), stays opened on one (focus) or gathers one back (gather)',
  );
  const partOf = (v: string, name: string): BreakdownPart => {
    const part = p.parts.find((x) => x.id === v && !x.remainder);
    check(
      part,
      `${name} names a part (${p.parts
        .filter((x) => !x.remainder)
        .map((x) => x.id)
        .join(', ')})`,
    );
    check(part.parts, `${name}: ${part.label} has no parts of its own to show`);
    return part;
  };
  if (p.focus != null) partOf(p.focus, 'focus');
  if (p.gather != null) partOf(p.gather, 'gather');
  if (p.open != null) {
    own(p.open, ['part', 'say', 'cue', 'at', 'after'], 'open');
    partOf(p.open.part, 'open.part');
    timing(p.open, 'open');
    check(
      p.open.say != null || p.open.cue != null || p.open.at != null,
      'open needs say, cue or at: the word the part opens on',
    );
  }
  return { ...p, source: p.source, format: fmt };
}

function invalidValue(value: number): string {
  if (value > 0) return '';
  if (value === 0)
    return 'zero: a part of nothing draws nothing, so leave it out';
  return 'negative: a share of a whole cannot be negative; show signed changes as a bridge (docs/bridge.md)';
}
