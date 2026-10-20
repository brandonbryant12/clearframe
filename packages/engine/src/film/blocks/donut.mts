import { b } from './definition.mjs';

export const donutBlock = b(
  'donut',
  'charts',
  'Part-to-whole: segments sweep in order; the legend states each value and share.',
  {
    segments: '[{label,value}] (2–6)',
    format: '{prefix,suffix,decimals} or unit string',
    center: 'Short caption under the total',
  },
  {
    title: 'Where a week of support goes',
    segments: [
      { label: 'Answering', value: 18 },
      { label: 'Routing', value: 12 },
      { label: 'Waiting on others', value: 7 },
      { label: 'Follow-up', value: 3 },
    ],
    format: ' h',
    center: 'hours per week',
  },
);
