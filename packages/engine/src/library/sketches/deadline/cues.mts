import type { ElementKey } from '../../../film/contracts/canvas-effects.mjs';
import { round } from '../../../film/sketch-kit.mjs';
import { AT } from './constants.mjs';
export type CalendarCue = keyof typeof AT;
export interface CalendarCueTiming {
  cue: string;
  at: number;
  after: number;
}
export function calendarCue(cue: CalendarCue, delay: number): CalendarCueTiming;
export function calendarCue<Extra extends ElementKey>(
  cue: CalendarCue,
  delay: number,
  extra: Extra,
): CalendarCueTiming & Extra;
export function calendarCue(
  cue: CalendarCue,
  delay: number,
  extra: ElementKey = {},
): CalendarCueTiming & ElementKey {
  return { cue, at: round(AT[cue] + delay), after: delay, ...extra };
}
