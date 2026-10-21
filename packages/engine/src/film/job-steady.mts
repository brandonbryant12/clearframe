import type { ResolvedStoryboard as Storyboard } from '../engine/domain.mjs';

/** A film whose default camera is still: business films and any storyboard with camera none. */
// Business and workplace films keep a steady frame while people read: their pictures move, not the camera.
export const steadyFilm = (sb: Storyboard) =>
  ['business', 'workplace'].includes(sb.treatment ?? '') ||
  (typeof sb.camera === 'string' ? sb.camera : sb.camera?.move) === 'none';
