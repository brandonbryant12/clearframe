export type {
  PictureFit,
  SpokenFigure,
  Spoken,
  ChartSuggestion,
  CastObject,
  CastFormation,
  CastSuggestion,
} from './pictures/contracts.mjs';
export { figuresIn, chartFor } from './pictures/numbers.mjs';
export { castFor } from './pictures/cast.mjs';
import type { PictureFit } from './pictures/contracts.mjs';
import { matchesPicture } from './pictures/matchers.mjs';
import { RULES_1 } from './pictures/rules-1.mjs';
import { RULES_2 } from './pictures/rules-2.mjs';
import { RULES_3 } from './pictures/rules-3.mjs';
const PICTURES = [...RULES_1, ...RULES_2, ...RULES_3];
export function pictureFor(vo: string): PictureFit | null {
  for (const [match, sketch, why, use] of PICTURES)
    if (matchesPicture(match, vo)) return { sketch, why, use };
  return null;
}
