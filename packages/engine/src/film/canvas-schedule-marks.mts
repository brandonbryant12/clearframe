import type { ElementSchedule } from './canvas-schedule-contracts.mjs';
export function scheduleMarks(state: ElementSchedule): void {
  const { el, resolve, at, dur } = state;

  // A mark lands on its word (or `after` seconds after it), once its text is there.
  for (const m of el.marks ?? []) {
    if (Array.isArray(m)) continue;
    if (m.say != null) {
      m.at = resolve(m.say) + (m.after ?? 0);
      delete m.say;
    }
    delete m.after;
    m.at = Math.max(m.at ?? at + dur, at);
    m.dur ??= markDuration(m.style);
    state.settle = Math.max(state.settle, m.at + m.dur);
  }
}
function markDuration(style: string | undefined): number {
  if (style === 'highlight') return 0.5;
  if (style === 'cross') return 0.6;
  return 0.55;
}
