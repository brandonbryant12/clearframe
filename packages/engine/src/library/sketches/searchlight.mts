import { buildSearchlight } from './searchlight/build.mjs';
export default {
  name: 'searchlight',

  order: 69,

  summary:
    'A dark storeroom searched by one torch: the light finds three things on the shelves in turn, each labelled as it is found, then the lamps come on and a thread joins them.',

  use: 'Discovery and investigation: what nobody had looked at, finding the cause, an audit, "three things were hiding". Feels like a quiet detective story; works on any palette (the dark is near-black, and the torch shows the palette colours). Replace FIRST, SECOND and THIRD with sketchText; land the light with sketchSay cues SEARCH (an optional sweep of the room first), FIRST, SECOND, THIRD and ALL (the lights come up).',
  build: buildSearchlight,
};
