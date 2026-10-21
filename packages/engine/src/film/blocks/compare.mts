import { b } from './definition.mjs';

export const compareBlock = b(
  'compare',
  'decisions',
  'Two approaches with matched criteria and a verdict.',
  {
    left: '{title,items:[string]}',
    right: '{title,items:[string]}',
    verdict: 'Decision',
  },
  {
    title: 'Choose the right trade-off',
    left: {
      title: 'One large release',
      items: ['More coordination', 'Long feedback loop'],
    },
    right: {
      title: 'Smaller releases',
      items: ['Frequent feedback', 'Lower change risk'],
    },
    verdict: 'Prefer smaller, reversible steps.',
  },
);
