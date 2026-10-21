import { b } from './definition.mjs';

export const imageBlock = b(
  'image',
  'media',
  'A real or generated plate at its own aspect ratio, in a rounded mask.',
  {
    asset: 'Declared image asset id',
    file: 'Local image path',
    caption: 'Visible caption',
    label: 'Provenance label',
    fit: 'contain (default) or cover',
    drift: 'Slow push-in (true/false)',
  },
  {
    file: 'assets/demo.png',
    caption: 'A consistent palette connects the scenes.',
    label: 'Illustrative artwork',
  },
);
