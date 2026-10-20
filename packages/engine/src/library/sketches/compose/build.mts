import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import type { BuildOptions } from './common.mjs';
import { composeFrame } from './frame.mjs';
import { composeRows } from './rows.mjs';
import { composeIcons } from './icons.mjs';
import { composeWindow } from './window.mjs';
import { composeFields } from './fields.mjs';
import { composeButtons } from './buttons.mjs';
import { composeAttachment } from './attachment.mjs';
import { composeLink } from './link.mjs';
import { composeFinish } from './finish.mjs';
export function buildCompose(
  w: number,
  h: number,
  options: BuildOptions = {},
): SketchDrawing {
  const step0 = composeFrame(w, h, options);
  const step1 = composeRows(step0);
  const step2 = composeIcons(step1);
  const step3 = composeWindow(step2);
  const step4 = composeFields(step3);
  const step5 = composeButtons(step4);
  const step6 = composeAttachment(step5);
  const step7 = composeLink(step6);
  return composeFinish(step7);
}
