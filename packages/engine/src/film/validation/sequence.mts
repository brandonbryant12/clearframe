import type { BlockProps, PropHelpers } from '../types.mjs';

import type { BlockValidator } from './contracts.mjs';
import { sequence } from './helpers.mjs';

export const validateSteps: BlockValidator = sequence(
  ['title', 'detail', 'label', 'say'],
  'title',
);

export const validateTimeline: BlockValidator = sequence(
  ['title', 'detail', 'label', 'say'],
  'title',
);

export const validateFunnel: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
) => {
  const items = sequence(['label', 'value', 'say'], 'label')(p, h);
  const values = items.map((it) => {
    h.num(it.value, 'value');
    return it.value;
  });
  values.forEach((value, i) => {
    if (value < 0 || (i && value > values[i - 1]))
      h.fail('funnel values must be nonnegative and decrease');
  });
  if (!values[0]) h.fail('first funnel value must be positive');
  h.format(values);
  p.rates ??= true;
  if (typeof p.rates !== 'boolean') h.fail('rates must be true or false');
};

export const validateMatrix: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
) => {
  h.list(p.columns, 'columns', 2, 3);
  h.list(p.rows, 'rows', 2, 4);
  p.columns.forEach((x) => h.text(x, 'column', 24));
  const columnCount = p.columns.length;
  p.rows.forEach((r) => {
    h.keys(r, ['label', 'values'], 'rows');
    h.text(r.label, 'row label', 32);
    h.list(r.values, 'row values', columnCount, columnCount);
    r.values.forEach((x) => h.text(x, 'cell', 30));
  });
  if (
    p.highlight != null &&
    (!Number.isInteger(p.highlight) ||
      p.highlight < 0 ||
      p.highlight >= p.columns.length)
  )
    h.fail('highlight must be a column index');
};

export const validateChecklist: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
) => {
  h.list(p.items, 'items', 2, 6);
  p.items = p.items.map((it) => (typeof it === 'string' ? { text: it } : it));
  p.items.forEach((it, i) => {
    h.keys(it, ['text', 'detail', 'say'], `items[${i}]`);
    h.text(it.text, 'text', 65);
    h.text(it.detail, 'detail', 85);
    h.required(it.text, 'items.text');
  });
};
