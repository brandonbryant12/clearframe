// Persistent cast authoring, geometry and motion compilation.
import { OBJECTS } from './cast/objects.mjs';
import { LOOK } from './cast/looks.mjs';
export { FORMS, LOOKS, FILL_TONES } from './cast/common.mjs';
export { castSpec } from './cast/spec.mjs';
export { formationTargets } from './cast/formations.mjs';
export { labelBelow, objectExtent } from './cast/draw.mjs';
export { castElements } from './cast/elements.mjs';
export { castOverlaps, expandCastProps } from './cast/expand.mjs';
export type { CastCarry, CastPose, CastObject } from './cast/contracts.mjs';
export const CAST_CATALOG = {
  shapes: Object.entries(OBJECTS).map(([id, value]) => ({
    id,
    about: value.about,
  })),
  looks: Object.entries(LOOK).map(([id, value]) => ({
    id,
    about: value.about,
  })),
};
