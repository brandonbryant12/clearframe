import { b } from './definition.mjs';

export const timelineBlock = b(
  'timeline',
  'diagrams',
  'Events on an ordered rail with time labels.',
  { items: '[{label,title,detail,say}] (2–5)' },
  {
    title: 'How the response unfolded',
    items: [
      { label: '09:10', title: 'Detected', detail: 'Alert received' },
      { label: '09:18', title: 'Contained', detail: 'Traffic rerouted' },
      { label: '09:42', title: 'Recovered', detail: 'Service verified' },
    ],
  },
);
