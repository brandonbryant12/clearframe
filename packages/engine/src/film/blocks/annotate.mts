import { b } from './definition.mjs';

export const annotateBlock = b(
  'annotate',
  'media',
  'A screenshot or photo with numbered pins, a matching legend and an optional focus region.',
  {
    asset: 'Declared image asset id',
    file: 'Local image path',
    pins: '[{x,y,label,detail,say}] (1–6; x/y 0–1 across the image)',
    focus: '{x,y,w,h,say} region to spotlight (0–1)',
    caption: 'Visible caption',
    label: 'Provenance label',
  },
  {
    title: 'Read the dashboard in order',
    file: 'assets/demo.png',
    pins: [
      {
        x: 0.29,
        y: 0.21,
        label: 'Start with the total',
        detail: 'The number everything adds up to',
      },
      {
        x: 0.51,
        y: 0.52,
        label: 'Then the outlier',
        detail: 'The week that needs a decision',
      },
    ],
    focus: { x: 0.19, y: 0.36, w: 0.51, h: 0.56 },
    caption: 'Illustrative wireframe · replace with an approved screenshot',
  },
);
