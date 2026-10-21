import { crisp } from '../../../film/sketch-kit.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import type { weekBase } from './base.mjs';
import { weekAgendaLayout } from './agenda-layout.mjs';
import { weekAgendaGrid } from './agenda-grid.mjs';
import { weekAgendaToday } from './agenda-today.mjs';
import { weekAgendaTasks } from './agenda-tasks.mjs';
import { weekAgendaDue } from './agenda-due.mjs';
import { weekAgendaAfter } from './agenda-after.mjs';
export function weekAgenda(
  context: ReturnType<typeof weekBase>,
): SketchDrawing {
  const step0 = weekAgendaLayout(context);
  const step1 = weekAgendaGrid(step0);
  const step2 = weekAgendaToday(step1);
  const step3 = weekAgendaTasks(step2);
  const step4 = weekAgendaDue(step3);
  const step5 = weekAgendaAfter(step4);
  return { elements: [...crisp(step5.els), ...step5.marks] };
}
