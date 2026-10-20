import { b } from './definition.mjs';

export const stepsBlock = b(
  'steps',
  'diagrams',
  'A connected process revealed in sequence.',
  { items: '[{title,detail,say}] (2–5)' },
  {
    title: 'From request to resolution',
    items: [
      { title: 'Capture', detail: 'State the need' },
      { title: 'Route', detail: 'Find the owner' },
      { title: 'Resolve', detail: 'Confirm the outcome' },
    ],
  },
);
