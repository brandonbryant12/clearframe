import { b } from './definition.mjs';

export const magnitudeBlock = b(
  'magnitude',
  'charts',
  'Area-true squares for quantities that differ by orders of magnitude.',
  {
    items: '[{label,value,say}] (2–4, positive)',
    format: '{prefix,suffix,decimals} or unit string',
  },
  {
    title: 'The same question, three scales',
    items: [
      { label: 'A team', value: 12 },
      { label: 'A company', value: 1200 },
      { label: 'A city', value: 90000 },
    ],
    format: ' people',
  },
);
