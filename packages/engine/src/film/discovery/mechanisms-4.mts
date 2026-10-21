import type { MechanismEntry } from './contracts.mjs';

import { MOVES } from './cast-examples.mjs';
export const mechanisms4: MechanismEntry[] = [
  [
    'tone-handoff',
    'An object fills the frame with its colour and the next scene (any block) plays on that colour; emerge brings it back.',
    'zooming into a detail, a chart becoming its number, a report becoming its code',
    'cast fill / emerge',
    'docs/cast.md',
    MOVES.fill,
  ],
  [
    'art-layer',
    'Drawn art under or over any block: an arrow onto a bar, a circle round a word, soft shapes behind a quote.',
    'pointing at the part that matters on a chart or card',
    'beat art.under / art.over',
    'docs/canvas.md',
    null,
  ],
  [
    'depth-plates',
    'Painted depth plates (generated stills split into layers) put the camera inside a place; never carry text or numbers.',
    'places, moods, establishing shots',
    'canvas plates, layered assets',
    'docs/image-direction.md',
    null,
  ],
  [
    'kinetic',
    'Type that follows the voice word by word, with emphasis words larger in an accent face.',
    'quotes, hooks, podcast clips, a line that must land',
    'block kinetic',
    'docs/speech.md',
    null,
  ],
];
