import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import type { BuildOptions } from './common.mjs';
import { lookbackPrices } from './prices.mjs';
import { lookbackLayout } from './layout.mjs';
import { lookbackPositions } from './positions.mjs';
import { lookbackAxis } from './axis.mjs';
import { lookbackLine } from './line.mjs';
import { lookbackTags } from './tags.mjs';
import { lookbackPurchase } from './purchase.mjs';
import { lookbackFinish } from './finish.mjs';
export function buildLookback(
  w: number,
  h: number,
  options: BuildOptions = {},
): SketchDrawing {
  const step0 = lookbackPrices(w, h, options);
  const step1 = lookbackLayout(step0);
  const step2 = lookbackPositions(step1);
  const step3 = lookbackAxis(step2);
  const step4 = lookbackLine(step3);
  const step5 = lookbackTags(step4);
  const step6 = lookbackPurchase(step5);
  return lookbackFinish(step6);
}
