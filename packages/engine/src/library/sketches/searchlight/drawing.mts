import type { SketchDrawing } from '../../../film/contracts/library.mjs';

import type { SearchlightContext } from './contracts.mjs';
import { searchlightFloor } from './floor.mjs';
import { searchlightFinds } from './finds.mjs';
import { searchlightLamps } from './lamps.mjs';
import { searchlightLight } from './light.mjs';
import { searchlightLabels } from './labels.mjs';
export function searchlightDrawing(context: SearchlightContext): SketchDrawing {
  return {
    elements: [
      ...searchlightFloor(context),
      ...searchlightFinds(context),
      ...searchlightLamps(context),
      ...searchlightLight(context),
      ...searchlightLabels(context),
    ],
  };
}
