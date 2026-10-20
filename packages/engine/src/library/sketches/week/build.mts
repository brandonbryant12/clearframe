import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import type { BuildOptions } from './common.mjs';
import { weekBase } from './base.mjs';
import { weekColumns } from './columns.mjs';
import { weekAgenda } from './agenda.mjs';
export function buildWeek(
  w: number,
  h: number,
  options: BuildOptions = {},
): SketchDrawing {
  const context = weekBase(w, h, options);
  return w > h * 1.25 ? weekColumns(context) : weekAgenda(context);
}
