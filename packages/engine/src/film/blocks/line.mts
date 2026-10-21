import { b } from './definition.mjs';

export const lineBlock = b(
  'line',
  'charts',
  'A progressive time-series reveal on an explicit scale.',
  {
    series: '[number] or [{x,y}]',
    labels: '[string]',
    min: 'Scale minimum',
    max: 'Scale maximum',
    format: '{prefix,suffix,decimals} or units',
    drawSay: 'Reveal cue',
  },
  {
    title: 'A trend worth watching',
    series: [12, 15, 14, 18, 23, 27],
    labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
    min: 0,
    max: 30,
    format: ' k',
  },
);
