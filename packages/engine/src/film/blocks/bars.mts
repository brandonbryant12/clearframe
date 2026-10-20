import { b } from './definition.mjs';

export const barsBlock = b(
  'bars',
  'charts',
  'Accurate zero-based comparison with a tunable focus.',
  {
    data: '[{label,value}] (2–8)',
    max: 'Positive scale maximum',
    format: '{prefix,suffix,decimals} or unit string',
    orientation: 'auto|horizontal|vertical',
    sort: 'none|desc',
    growSay: 'Growth cue',
    focus: '{label|index,say,dim,dur,note}',
  },
  {
    title: 'Where the hours went',
    data: [
      { label: 'Triage', value: 12 },
      { label: 'Routing', value: 24 },
      { label: 'Review', value: 8 },
    ],
    format: ' h',
    focus: { label: 'Routing', dim: 0.55, note: 'Start here' },
  },
);
