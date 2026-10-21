import { crisp } from '../../../film/sketch-kit.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import type { weekBase } from './base.mjs';
import { weekColumnsLayout } from './columns-layout.mjs';
import { weekColumnsGrid } from './columns-grid.mjs';
import { weekColumnsToday } from './columns-today.mjs';
import { weekColumnsTasks } from './columns-tasks.mjs';
import { weekColumnsDue } from './columns-due.mjs';
import { weekColumnsAfter } from './columns-after.mjs';
export function weekColumns(
  context: ReturnType<typeof weekBase>,
): SketchDrawing {
  const step0 = weekColumnsLayout(context);
  const step1 = weekColumnsGrid(step0);
  const step2 = weekColumnsToday(step1);
  const step3 = weekColumnsTasks(step2);
  const step4 = weekColumnsDue(step3);
  const step5 = weekColumnsAfter(step4);
  return { elements: [...crisp(step5.els), ...step5.marks] };
}
