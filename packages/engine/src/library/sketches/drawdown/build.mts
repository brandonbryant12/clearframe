import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import type { BuildOptions } from './common.mjs';
import { drawdownDates } from './dates.mjs';
import { drawdownType } from './type.mjs';
import { drawdownLayout } from './layout.mjs';
import { drawdownAxis } from './axis.mjs';
import { drawdownLines } from './lines.mjs';
import { drawdownStart } from './start.mjs';
import { drawdownRecovery } from './recovery.mjs';
import { drawdownFinish } from './finish.mjs';

export function buildDrawdown(
  w: number,
  h: number,
  options: BuildOptions = {},
): SketchDrawing {
  const step0 = drawdownDates(w, h, options);
  const step1 = drawdownType(step0);
  const step2 = drawdownLayout(step1);
  const step3 = drawdownAxis(step2);
  const step4 = drawdownLines(step3);
  const step5 = drawdownStart(step4);
  const step6 = drawdownRecovery(step5);
  return drawdownFinish(step6);
}
