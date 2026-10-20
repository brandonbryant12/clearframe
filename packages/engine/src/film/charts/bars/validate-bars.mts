import type { BarsSpec } from './contracts.mjs';
import { own } from './own.mjs';
import { words, finite } from './primitives.mjs';
import { check } from './check.mjs';

export function validateBars(p: BarsSpec, labels: Set<string>) {
  for (const [i, v] of p.values.entries()) {
    own(v, ['label', 'value', 'highlight'], `values[${i}]`);
    words(v.label, `values[${i}].label`, 28);
    check(!labels.has(v.label), 'bar labels must be unique');
    labels.add(v.label);
    check(
      finite(v.value) && v.value >= p.domain[0] && v.value <= p.domain[1],
      `values[${i}].value lies outside the domain`,
    );
    check(
      v.highlight == null || typeof v.highlight === 'boolean',
      'highlight is true or false',
    );
  }
}
