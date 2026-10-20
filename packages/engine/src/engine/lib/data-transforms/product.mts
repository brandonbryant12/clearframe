import { DATA_MODEL_VERSION } from './contracts.mjs';
import type {
  ProductDecomposition,
  ProductFactor,
  Component,
  ProductPart,
} from './contracts.mjs';
import {
  object,
  number,
  check,
  id,
  label,
  components,
  sum,
} from './inputs.mjs';

/** Exact two-factor change plus separately named additive amounts.
 * (a1*b1-a0*b0) = (a1-a0)*b0 + (b1-b0)*a0 + (a1-a0)*(b1-b0).
 * The interaction is kept, never assigned silently to either factor.
 */
export function decomposeProduct(input: unknown): ProductDecomposition {
  object(input, ['first', 'second', 'additions'], 'product');
  const factors = ['first', 'second'].map((name): ProductFactor => {
    const f = input[name];
    object(f, ['id', 'label', 'start', 'end'], name);
    const start = number(f.start, `${name}.start`),
      end = number(f.end, `${name}.end`);
    check(
      start > 0 && end >= 0,
      'product factors need positive starts and nonnegative ends',
    );
    return {
      id: id(f.id, `${name}.id`),
      label: label(f.label, `${name}.label`),
      start,
      end,
    };
  });
  const [a, b] = factors,
    opening = number(a.start * b.start, 'opening product'),
    endingProduct = number(a.end * b.end, 'ending product');
  check(opening > 0, 'opening product must remain positive');
  const additions = components(input.additions ?? [], 'additions');
  const ids = [a.id, b.id, ...additions.map((p) => p.id)];
  check(
    new Set(ids).size === ids.length &&
      !ids.includes('interaction') &&
      !ids.includes('residual'),
    'factor/addition identifiers must be unique and not reserved',
  );
  const da = a.end - a.start,
    db = b.end - b.start;
  const parts: (Component & { kind: ProductPart['kind'] })[] = [
    {
      id: a.id,
      label: a.label,
      amount: number(da * b.start, 'first effect'),
      kind: 'factor',
    },
    {
      id: b.id,
      label: b.label,
      amount: number(db * a.start, 'second effect'),
      kind: 'factor',
    },
    {
      id: 'interaction',
      label: 'Interaction',
      amount: number(da * db, 'interaction'),
      kind: 'interaction',
    },
    ...additions.map((p) => ({ ...p, kind: 'additive' as const })),
  ];
  const additiveTotal = sum(additions.map((p) => p.amount)),
    combinedValue = number(endingProduct + additiveTotal, 'combined value');
  const change = number(combinedValue - opening, 'change');
  return {
    modelVersion: DATA_MODEL_VERSION,
    method: 'two-factor-with-explicit-interaction',
    factors,
    opening,
    endingProduct,
    additiveTotal,
    combinedValue,
    change,
    changeFraction: number(change / opening, 'change fraction'),
    parts: parts.map((p) => ({
      ...p,
      fraction: number(p.amount / opening, 'contribution fraction'),
    })),
    arithmeticDifference: number(
      change - sum(parts.map((p) => p.amount)),
      'arithmetic difference',
    ),
  };
}
