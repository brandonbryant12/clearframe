import { b } from './definition.mjs';

export const matrixBlock = b(
  'matrix',
  'decisions',
  'A compact comparison grid for two to four criteria; one column can be highlighted.',
  {
    columns: '[string] (2–3)',
    rows: '[{label,values:[string]}] (2–4)',
    highlight: 'Column index to highlight',
  },
  {
    title: 'Evaluate the whole workflow',
    columns: ['Option A', 'Option B'],
    rows: [
      { label: 'Setup', values: ['Low', 'Medium'] },
      { label: 'Iteration', values: ['Medium', 'Low'] },
      { label: 'Control', values: ['Limited', 'High'] },
    ],
  },
);
