import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import type { BuildOptions } from './common.mjs';
import { searchlightRoom } from './room.mjs';
import { searchlightMotion } from './motion.mjs';
import { searchlightDrawing } from './drawing.mjs';
export function buildSearchlight(
  w: number,
  h: number,
  options: BuildOptions = {},
): SketchDrawing {
  const step0 = searchlightRoom(w, h, options);
  const step1 = searchlightMotion(step0);
  return searchlightDrawing(step1);
}
