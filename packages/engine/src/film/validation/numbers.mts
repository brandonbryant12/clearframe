import type { BlockProps, PropHelpers } from '../types.mjs';

import type { BlockValidator } from './contracts.mjs';

export const validateStat: BlockValidator = (p: BlockProps, h: PropHelpers) => {
  h.numeric(p, 'stat');
  h.required(p.label, 'label');
};

export const validateKpis: BlockValidator = (p: BlockProps, h: PropHelpers) => {
  h.list(p.items, 'items', 2, 4);
  p.items.forEach((it, i) => {
    h.keys(
      it,
      ['value', 'label', 'prefix', 'suffix', 'decimals', 'from', 'say'],
      `items[${i}]`,
    );
    h.numeric(it, `items[${i}]`);
    h.text(it.label, 'label', 40);
    h.required(it.label, 'items.label');
  });
};

export const validateDelta: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
) => {
  if (!p.from || !p.to) h.fail('from and to are required');
  h.keys(p.from, ['value', 'label'], 'from');
  h.keys(p.to, ['value', 'label'], 'to');
  h.text(p.from.label, 'from.label', 40);
  h.text(p.to.label, 'to.label', 40);
  h.text(p.prefix, 'prefix', 12);
  h.text(p.suffix, 'suffix', 16);
  h.text(p.change, 'change', 100);
  h.num(p.from.value, 'from.value');
  h.num(p.to.value, 'to.value');
  p.decimals ??= Math.max(h.precision(p.from.value), h.precision(p.to.value));
  const d = p.to.value - p.from.value;
  if (p.change == null) {
    if (d === 0) p.change = 'No change';
    else if (p.from.value === 0) p.change = 'From zero';
    else
      p.change = `${d > 0 ? '+' : '−'}${Math.abs((100 * d) / Math.abs(p.from.value)).toFixed(1)}%`;
  }
  if (p.better != null && !['up', 'down'].includes(p.better))
    h.fail('better must be up or down');
};

export const validateMagnitude: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
) => {
  h.list(p.items, 'items', 2, 4);
  const values = p.items.map((it, i) => {
    h.keys(it, ['label', 'value', 'say'], `items[${i}]`);
    h.text(it.label, 'label', 40);
    h.num(it.value, 'value');
    if (!(it.value > 0))
      h.fail(
        'magnitude values must be positive; area cannot show zero or negative amounts',
      );
    h.required(it.label, 'items.label');
    return it.value;
  });
  h.format(values);
};
