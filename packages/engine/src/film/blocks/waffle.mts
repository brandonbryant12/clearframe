import { b } from './definition.mjs';

export const waffleBlock = b(
  'waffle',
  'charts',
  'Countable units for a share or probability; tiles fill one by one, optionally as icons.',
  {
    value: 'Highlighted units',
    total: 'Total units (1–100)',
    cols: 'Columns',
    label: 'Meaning',
    icon: 'Optional icon per unit (pictogram), see icons',
  },
  {
    title: 'Seven in ten',
    value: 70,
    total: 100,
    cols: 10,
    label: 'A forecast, not a guarantee',
  },
);
