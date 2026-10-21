import { b } from './definition.mjs';

export const deltaBlock = b(
  'delta',
  'numbers',
  'Before and after: the new value counts from the old one; the change chip can carry meaning.',
  {
    from: '{value,label}',
    to: '{value,label}',
    prefix: '',
    suffix: '',
    decimals: '0–8',
    change: 'Optional explicit change label',
    better: 'up|down: colors the change positive or negative',
  },
  {
    title: 'A faster first response',
    from: { value: 4.2, label: 'Before' },
    to: { value: 1.8, label: 'After' },
    suffix: ' days',
    better: 'down',
  },
);
