import { b } from './definition.mjs';

export const checklistBlock = b(
  'checklist',
  'text',
  'Items appear unchecked, then each box fills and ticks on its cue.',
  { items: '[string or {text,detail,say}] (2–6)' },
  {
    title: 'Before you publish',
    items: [
      { text: 'Replace every sample figure' },
      { text: 'Add a visible source' },
      { text: 'Listen with the sound on' },
    ],
  },
);
