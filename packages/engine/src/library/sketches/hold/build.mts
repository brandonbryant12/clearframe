import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import type { BuildOptions } from './common.mjs';
import { holdValues } from './values.mjs';
import { holdLayout } from './layout.mjs';
import { holdTiming } from './timing.mjs';
import { holdAxis } from './axis.mjs';
import { holdLock } from './lock.mjs';
import { holdMarket } from './market.mjs';
import { holdExtremes } from './extremes.mjs';
import { holdTags } from './tags.mjs';
import { holdFinish } from './finish.mjs';

export function buildHold(
  w: number,
  h: number,
  options: BuildOptions = {},
): SketchDrawing {
  const step0 = holdValues(w, h, options);
  const step1 = holdLayout(step0);
  const step2 = holdTiming(step1);
  const step3 = holdAxis(step2);
  const step4 = holdLock(step3);
  const step5 = holdMarket(step4);
  const step6 = holdExtremes(step5);
  const step7 = holdTags(step6);
  return holdFinish(step7);
}
