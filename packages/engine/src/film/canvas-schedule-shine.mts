import type { ElementSchedule } from './canvas-schedule-contracts.mjs';
export function scheduleShine(state: ElementSchedule): void {
  const { el, resolve, at, dur } = state;

  if (typeof el.shine === 'object') {
    if (el.shine.say != null) {
      el.shine.at = resolve(el.shine.say);
      delete el.shine.say;
    }
    el.shine.at ??= at + dur;
  }
}
