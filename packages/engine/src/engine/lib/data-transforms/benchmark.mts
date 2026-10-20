import { DATA_MODEL_VERSION } from './contracts.mjs';
import type { BenchmarkDifferences, BenchmarkItem } from './contracts.mjs';
import { object, number, check, id, label } from './inputs.mjs';

/** Signed difference in the original metric's units, never a ratio or return index.
 * A missing observation has no relative endpoint. Optional size stays nonnegative.
 */
export function benchmarkDifferences(input: unknown): BenchmarkDifferences {
  object(input, ['benchmark', 'items'], 'benchmark comparison');
  const benchmark = number(input.benchmark, 'benchmark');
  const rows = input.items;
  check(
    Array.isArray(rows) && rows.length >= 1 && rows.length <= 12,
    'items needs 1–12 records',
  );
  const seen = new Set<string>(),
    items = rows.map((p: unknown, i: number): BenchmarkItem => {
      object(p, ['id', 'label', 'value', 'size'], `items[${i}]`);
      const pid = id(p.id, `items[${i}].id`);
      check(!seen.has(pid), 'item identifiers must be unique');
      seen.add(pid);
      const name = label(p.label, `items[${i}].label`);
      const value =
        p.value === null ? null : number(p.value, `items[${i}].value`);
      const size =
        p.size === undefined ? null : number(p.size, `items[${i}].size`);
      check(size === null || size >= 0, 'size must be nonnegative');
      return {
        id: pid,
        label: name,
        value,
        size,
        difference:
          value === null ? null : number(value - benchmark, 'difference'),
      };
    });
  return {
    modelVersion: DATA_MODEL_VERSION,
    method: 'signed-metric-difference',
    benchmark,
    items,
  };
}
