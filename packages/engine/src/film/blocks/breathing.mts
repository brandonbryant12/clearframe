import { b } from './definition.mjs';

export const breathingBlock = b(
  'breathing',
  'motion',
  'An expanding and contracting ring with explicit, editable phase durations.',
  {
    phases: '[{label,seconds,scale:expand|hold|contract}] (2–6)',
    minScale: 'Minimum relative radius, 0.2–1',
    maxScale: 'Maximum relative radius, 0.2–1, greater than minScale',
    ring: 'Show outer guide ring',
  },
  {
    title: 'Take a quiet moment',
    phases: [
      { label: 'Breathe in', seconds: 3, scale: 'expand' },
      { label: 'Breathe out', seconds: 4, scale: 'contract' },
    ],
    minScale: 0.55,
    maxScale: 1,
    ring: true,
    source: 'Illustrative pacing · adjust to your comfort',
  },
);
