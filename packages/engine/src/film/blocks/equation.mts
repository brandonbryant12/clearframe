import { b } from './definition.mjs';

export const equationBlock = b(
  'equation',
  'diagrams',
  'Build a simple relationship, then show its implication.',
  { expression: 'Formula', result: 'Result', explanation: 'Meaning' },
  {
    title: 'Leave room for variation',
    expression: 'Capacity − demand',
    result: '= headroom',
    explanation: 'Headroom absorbs the unexpected.',
  },
);
