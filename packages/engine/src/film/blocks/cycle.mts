import { b } from './definition.mjs';

export const cycleBlock = b(
  'cycle',
  'diagrams',
  'A repeating process with a moving marker on a continuous loop.',
  {
    nodes: '[{icon?,label}] (3–6)',
    period: 'Seconds per loop, 2–60',
    clockwise: 'true or false',
  },
  {
    title: 'A creative practice',
    nodes: [
      { icon: 'lightbulb', label: 'Imagine' },
      { icon: 'pencil', label: 'Make' },
      { icon: 'camera', label: 'Observe' },
      { icon: 'brush', label: 'Refine' },
    ],
    period: 8,
  },
);
