import { b, emphasis, emphasisStyle, align } from './definition.mjs';

export const statementBlock = b(
  'statement',
  'story',
  'A single editorial statement with optional accent phrases and a supporting line.',
  { text: 'Statement', ...emphasis, ...emphasisStyle, ...align },
  {
    text: 'Busy is not the same as effective.',
    emphasis: ['effective'],
    support: 'Measure the wait, not just the workload.',
  },
);
