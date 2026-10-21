import { b, align } from './definition.mjs';

export const highlightBlock = b(
  'highlight',
  'text',
  'A sentence whose key phrases get a marker sweep, each on its own cue.',
  {
    text: 'Sentence (≤ 200 characters)',
    phrases: '[string or {text,say}] (1–4 whole-word parts of text)',
    ...align,
  },
  {
    text: 'An average can hide a long tail of slow requests.',
    phrases: ['long tail'],
    support: 'Look at the distribution, not just the middle.',
  },
);
