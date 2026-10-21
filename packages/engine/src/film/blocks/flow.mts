import { b } from './definition.mjs';

export const flowBlock = b(
  'flow',
  'diagrams',
  'Draw connections as a process unfolds; each node can follow a spoken cue.',
  {
    nodes: '[{icon?,label,detail?,say?}] (2–6)',
    orientation: 'auto|horizontal|vertical; portrait stays vertical',
    stagger: 'Delay between arrivals, 0–2 seconds',
  },
  {
    title: 'From observation to explanation',
    nodes: [
      { icon: 'leaf', label: 'Notice', detail: 'Start with a question' },
      { icon: 'microscope', label: 'Test', detail: 'Change one thing' },
      { icon: 'lightbulb', label: 'Explain', detail: 'Compare the evidence' },
    ],
  },
);
