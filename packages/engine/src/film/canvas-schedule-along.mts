import { CANVAS_TIMING as T } from './constants.mjs';

import type { ElementSchedule } from './canvas-schedule-contracts.mjs';
export function scheduleAlong(state: ElementSchedule): void {
  const { el, resolve, at } = state;

  if (el.along) {
    const along = el.along;
    if (along.say != null) {
      along.at = resolve(along.say) + (along.after ?? 0);
      delete along.say;
    }
    delete along.after;
    along.at ??= at;
    along.dur ??= T.along;
    state.settle = Math.max(state.settle, along.at + along.dur);
  }
}
