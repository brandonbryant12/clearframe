import { show } from './breakdown-common.mjs';
import type { Timed, ElementFields } from './types.mjs';
import type {
  BreakdownRow,
  BreakdownWhen,
  BreakdownArrival,
} from './breakdown-contracts.mjs';
export const spoken = (x: Timed): boolean =>
  x.say != null || x.cue != null || x.at != null;
export const arrival =
  (still: boolean, when: BreakdownWhen): BreakdownArrival =>
  (x, fallback, extra = {}) =>
    still ? show : { at: when(x, fallback), ...extra };
export const frameOf = (r: BreakdownRow): { grow: ElementFields } => ({
  grow: { enter: 'grow-x', origin: [r.bar.x, r.cy], dur: 0.6 },
});
