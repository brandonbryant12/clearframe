import { CANVAS_TIMING as T } from './constants.mjs';

import type { ElementSchedule } from './canvas-schedule-contracts.mjs';
export function scheduleKeys(state: ElementSchedule): void {
  const { el, resolve } = state;

  for (const k of el.keys ?? []) {
    if (k.say != null) {
      k.at = resolve(k.say) + (k.after ?? 0);
      delete k.say;
    }
    delete k.after;
    k.dur ??= T.key;
    // A key without a word has its own seconds (or a moment's, applied before scheduling).
    // `hold: false`: ambient motion (traffic, drifting cloud) runs on past the cut.
    if (k.hold !== false)
      state.settle = Math.max(state.settle, (k.at ?? 0) + k.dur);
    delete k.hold;
  }

  if (el.keys) el.keys.sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
}
