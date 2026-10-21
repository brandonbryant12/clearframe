import type { BlockProps as AuthoredProps } from '../engine/domain.mjs';
import type { HelperFrame } from './types.mjs';
import type { TableShow } from './table-contracts.mjs';
import { check } from './table-common.mjs';
import { tableSpec } from './table-spec.mjs';
import { tableElements } from './table-elements.mjs';
export { tableSpec, tableElements };
export function expandTableProps(
  input: AuthoredProps,
  frame: HelperFrame,
): AuthoredProps {
  if (input?.table == null) return input;
  const { table, ...rest } = structuredClone(input);
  for (const key of [
    'plot',
    'bars',
    'bridge',
    'breakdown',
    'process',
    'decision',
    'stat',
    'distribution',
    'multiples',
    'kpi',
    'teaching',
    'chart',
    'sketch',
    'plates',
    'world',
    'title',
    'diagram',
  ] as const)
    check(rest[key] == null, `cannot combine table with ${key}`);
  const p = tableSpec(table);
  check(
    rest.source == null || rest.source === p.source,
    'source conflicts with table.source',
  );
  const resolve = frame.when;
  const when = resolve
    ? (s: TableShow) => resolve(s, 0, 'table audience')
    : (s: TableShow) => s.at;
  const { elements } = tableElements(p, frame, when);
  return {
    ...rest,
    source: p.source + (p.asOf ? ` · ${p.asOf}` : ''),
    view: rest.view ?? [0, 0, frame.width, frame.height],
    elements: [...elements, ...(rest.elements ?? [])],
  };
}
