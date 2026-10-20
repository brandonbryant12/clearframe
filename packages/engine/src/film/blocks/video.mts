import { b } from './definition.mjs';

export const videoBlock = b(
  'video',
  'media',
  'A short footage insert with native titles and a shared soundtrack.',
  {
    asset: 'Declared clip asset id',
    file: 'Local video path',
    caption: 'Visible caption',
    label: 'Provenance label',
    offset: 'Source in point in seconds',
    fit: 'contain (default) or cover',
    drift: 'Slow push-in (true/false)',
  },
  {
    file: 'assets/demo.mp4',
    caption: 'One continuous visual language',
    label: 'Illustrative footage',
    offset: 0,
  },
);
