import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import type { BuildOptions } from './common.mjs';
import { inspectValidate } from './validate.mjs';
import { inspectLayout } from './layout.mjs';
import { inspectComponents } from './components.mjs';
import { inspectButton } from './button.mjs';
import { inspectToolbar } from './toolbar.mjs';
import { inspectMessage } from './message.mjs';
import { inspectMarks } from './marks.mjs';
import { inspectView } from './view.mjs';
import { inspectReport } from './report.mjs';
import { inspectPointer } from './pointer.mjs';
import { inspectChoices } from './choices.mjs';
import { inspectFinish } from './finish.mjs';
import { inspectUnreported } from './unreported.mjs';
export function buildInspect(
  w: number,
  h: number,
  options: BuildOptions = {},
): SketchDrawing {
  const step0 = inspectValidate(w, h, options);
  const step1 = inspectLayout(step0);
  const step2 = inspectComponents(step1);
  const step3 = inspectButton(step2);
  const step4 = inspectToolbar(step3);
  const step5 = inspectMessage(step4);
  const step6 = inspectMarks(step5);
  const step7 = inspectView(step6);
  if (!step7.report) return inspectUnreported(step7);
  const step8 = inspectReport(step7);
  const step9 = inspectPointer(step8);
  const step10 = inspectChoices(step9);
  return inspectFinish(step10);
}
