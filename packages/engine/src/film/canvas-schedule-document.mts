import type { ElementSchedule } from './canvas-schedule-contracts.mjs';
export function scheduleDocument(state: ElementSchedule): void {
  const { el, resolve, at } = state;

  // A document scrolls to a section on its word.
  for (const k of el.type === 'document' ? (el.scroll ?? []) : []) {
    if (k.say != null) {
      k.at = resolve(k.say) + (k.after ?? 0);
      delete k.say;
    }
    delete k.after;
    k.at = Math.max(k.at ?? at, at);
    k.dur ??= 0.9;
    state.settle = Math.max(state.settle, k.at + k.dur);
  }
}
