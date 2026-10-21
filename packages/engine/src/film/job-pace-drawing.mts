import type { TimedBeat as TimingBeat } from '../engine/domain.mjs';
import type { JobReport, CanvasElement } from './types.mjs';

import { timedByMoment } from './moments.mjs';

export function pullDrawing(
  b: TimingBeat,
  own: CanvasElement[],
  content: number,
  voice: number,
  earliest: number,
  gap: number,
  report: JobReport,
): void {
  const shift = content - Math.max(0, voice - 0.1);
  const pulled = own.filter((el) => (el.at ?? 0) <= earliest + 1e-6);
  // A drawing on a named moment keeps its time: moving one reaction would split an event the
  // author shared (and carry its sound away). The empty opening is reported instead.
  if (pulled.some(timedByMoment)) {
    report.warnings.push(
      `${b.id}: the voice talks for ${gap.toFixed(1)} s over an empty scene before the first drawing, which lands on a named moment and keeps its time. Draw the ground or picture from the cut (at: 0, enter: "none"), cue something to the opening words, or set pace: "hold" for a deliberate wait.`,
    );
    return;
  }
  const move = (el: CanvasElement): void => {
    el.at = Math.max(0, (el.at ?? 0) - shift);
    if (el.type === 'group') el.children?.forEach(move);
  };
  pulled.forEach(move);
  report.warnings.push(
    `${b.id}: the voice would talk for ${gap.toFixed(1)} s over an empty scene; pulled the first drawing (${pulled[0].id ?? pulled[0].type}) forward to the first word. Cue something to the opening words, or set pace: "hold" for a deliberate wait.`,
  );
  return;
}
