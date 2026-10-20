import { b, align } from './definition.mjs';

export const statBlock = b(
  'stat',
  'numbers',
  'A hero number with units, counted from a truthful starting value.',
  {
    value: 'Finite number',
    from: 'Starting value',
    prefix: 'Prefix',
    suffix: 'Units',
    decimals: '0–8',
    label: 'Meaning',
    context: 'Context',
    ...align,
  },
  {
    value: 4.2,
    suffix: ' days',
    label: 'Median first response',
    context: 'From request to first answer.',
  },
);
