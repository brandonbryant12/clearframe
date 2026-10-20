import { b, emphasis } from './definition.mjs';

export const calloutBlock = b(
  'callout',
  'text',
  'A framed correction, caveat or key insight with an optional icon badge.',
  { text: 'Insight', label: 'Label', icon: 'Optional badge icon', ...emphasis },
  {
    label: 'The caveat',
    icon: 'alert',
    text: 'An average can hide a long tail.',
    emphasis: ['long tail'],
    support: 'Look at the distribution before choosing a target.',
  },
);
