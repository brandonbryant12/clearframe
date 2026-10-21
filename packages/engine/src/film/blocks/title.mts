import { b, emphasis, emphasisStyle, align } from './definition.mjs';

export const titleBlock = b(
  'title',
  'story',
  'Open with a clear promise: display type rises line by line under an accent bar.',
  { text: 'Main promise', ...emphasis, ...emphasisStyle, ...align },
  {
    kicker: 'Field notes',
    text: 'Make the next step clear',
    support: 'One idea, supported by evidence.',
  },
);
