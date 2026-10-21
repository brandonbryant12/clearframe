import { b } from './definition.mjs';

export const kpisBlock = b(
  'kpis',
  'numbers',
  'Two to four comparable metrics with staggered entrances.',
  { items: '[{value,label,prefix,suffix,decimals,from,say}]' },
  {
    title: 'The quarter in three numbers',
    items: [
      { value: 12400, label: 'Requests' },
      { value: 4.2, suffix: ' days', label: 'First response' },
      { value: 91, suffix: '%', label: 'Satisfaction' },
    ],
  },
);
