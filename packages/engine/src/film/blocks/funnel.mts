import { b } from './definition.mjs';

export const funnelBlock = b(
  'funnel',
  'charts',
  'Decreasing stages on one comparable scale with derived step-to-step rates.',
  {
    items: '[{label,value,say}] (2–5)',
    format: '{prefix,suffix,decimals} or units',
    rates: 'Show conversion between stages (default true)',
  },
  {
    title: 'Find the drop-off',
    items: [
      { label: 'Visited', value: 1000 },
      { label: 'Started', value: 620 },
      { label: 'Finished', value: 440 },
    ],
  },
);
