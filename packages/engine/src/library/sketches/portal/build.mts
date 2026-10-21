import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import type { BuildOptions } from './common.mjs';
import { portalFrame } from './frame.mjs';
import { portalFields } from './fields.mjs';
import { portalMotion } from './motion.mjs';
import { portalDrawing } from './drawing.mjs';
export function buildPortal(
  w: number,
  h: number,
  options: BuildOptions = {},
): SketchDrawing {
  const step0 = portalFrame(w, h, options);
  const step1 = portalFields(step0);
  const step2 = portalMotion(step1);
  return portalDrawing(step2);
}
