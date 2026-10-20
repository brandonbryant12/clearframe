import { fmt } from './process-common.mjs';
import type { ProcessDrawing } from './process-contracts.mjs';
export function processTrend({
  p,
  states,
}: ProcessDrawing): (i: number) => string[] {
  const trend = (i: number): string[] =>
    states.map((s, k) => {
      const q = s.queues[i];
      if (k === 0) return q ? `${fmt(q)} waiting` : 'none waiting';
      const d = q - states[k - 1].queues[i];
      return `${fmt(q)} waiting${change(d, p.period)}`;
    });
  return trend;
}

function change(d: number, period: string): string {
  if (d > 0) return ` · +${fmt(d)} a ${period}`;
  if (d < 0) return ` · −${fmt(-d)} a ${period}`;
  return '';
}
