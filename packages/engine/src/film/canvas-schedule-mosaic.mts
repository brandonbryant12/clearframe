import type { ElementSchedule } from './canvas-schedule-contracts.mjs';
export function scheduleMosaic(state: ElementSchedule): void {
  const { el, resolve } = state;

  // Mosaic recolour fronts resolve their spoken cues like keys.
  for (const r of typeof el.mosaic === 'object'
    ? (el.mosaic.recolor ?? [])
    : []) {
    if (r.say != null) {
      r.at = resolve(r.say);
      delete r.say;
    }
    r.dur ??= 1.2;
    // A front without a word has its own seconds (mosaicSpec needs one or the other).
    state.settle = Math.max(state.settle, (r.at ?? 0) + r.dur);
  }
}
