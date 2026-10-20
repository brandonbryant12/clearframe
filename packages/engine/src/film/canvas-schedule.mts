import { CANVAS_TIMING as T } from './constants.mjs';
import type { CanvasElement } from './types.mjs';
import type {
  ScheduleOptions,
  ElementSchedule,
} from './canvas-schedule-contracts.mjs';
export type { ScheduleOptions } from './canvas-schedule-contracts.mjs';
import { scheduleExit } from './canvas-schedule-exit.mjs';
import { scheduleMosaic } from './canvas-schedule-mosaic.mjs';
import { scheduleDocument } from './canvas-schedule-document.mjs';
import { scheduleMarks } from './canvas-schedule-marks.mjs';
import { scheduleShine } from './canvas-schedule-shine.mjs';
import { scheduleKeys } from './canvas-schedule-keys.mjs';
import { scheduleAlong } from './canvas-schedule-along.mjs';
export function defaultEnter(el: CanvasElement): string {
  if (el.enter != null) return el.enter;
  if (
    el.type === 'solid' ||
    (['line', 'path', 'poly'].includes(el.type) &&
      (el.fill == null || el.fill === 'none'))
  )
    return 'draw';
  if (el.type === 'text') return 'rise';
  if (['icon', 'circle'].includes(el.type)) return 'pop';
  return 'fade';
}
function entranceDuration(
  enter: string,
  chars: number,
  entrance: number,
): number {
  if (enter === 'draw') return T.draw;
  if (enter === 'type')
    return Math.min(T.typeMax, Math.max(T.typeMin, chars * T.typePerChar));
  if (['grow', 'grow-x', 'grow-y', 'wipe', 'wipe-up'].includes(enter))
    return T.grow;
  return enter === 'none' ? 0 : entrance;
}
export function scheduleElements(
  list: CanvasElement[],
  {
    start,
    stagger = 0,
    entrance,
    resolve,
    limit = Infinity,
    still = false,
    ground = false,
  }: ScheduleOptions,
): number {
  let settle = start;
  list.forEach((el, i) => {
    // `enter: "none"` with no time is the scene's ground: on screen from the cut. It used to wait
    // for the scene's cue, so every cut flashed an empty frame first (no sheet shows it; a round-18
    // film found it by decoding frame 0). Inside a group, contents still start with their group.
    if (ground && el.enter === 'none' && el.at == null && el.say == null)
      el.at = 0;

    // A group placed with no entrance places its contents with none: children that do not
    // ask for one would otherwise draw or fade in on the cut frame.
    if (still && el.enter == null) el.enter = 'none';

    const enterWord = el.say;

    if (el.say != null) {
      // Type cued to a word is legible as the word is said: its entrance starts a moment early.
      // `after` places it that many seconds after the word (choreography relative to the voice).
      el.at = Math.max(
        0,
        resolve(el.say) -
          (el.type === 'text' && !el.after ? 0.2 : 0) +
          (el.after ?? 0),
      );
      delete el.say;
    }

    delete el.after;

    if (
      el.exitAfter != null &&
      (el.exitSay == null || !Number.isFinite(el.exitAfter) || el.exitAfter < 0)
    )
      throw new Error(
        'exitAfter is the seconds (0 or more) an exit waits after its exitSay word: give the element an exitSay and a number',
      );

    el.at ??= start + i * stagger;

    const enter = defaultEnter(el);

    const chars = String(el.text ?? '').length;
    el.dur ??= entranceDuration(enter, chars, entrance);

    const at = el.at,
      dur = el.dur;
    const state: ElementSchedule = {
      el,
      resolve,
      at,
      dur,
      entrance,
      limit,
      enterWord,
      settle: at + dur,
    };
    if (el.type === 'text' && typeof el.count === 'object')
      state.settle = Math.max(state.settle, at + (el.count.dur ?? 0));
    scheduleExit(state);
    scheduleMosaic(state);
    scheduleDocument(state);
    scheduleMarks(state);
    scheduleShine(state);
    scheduleKeys(state);
    scheduleAlong(state);

    if (el.type === 'group')
      state.settle = Math.max(
        state.settle,
        scheduleElements(el.children ?? [], {
          start: at,
          stagger: el.stagger ?? 0,
          entrance,
          resolve,
          limit,
          still: el.enter === 'none',
        }),
      );
    settle = Math.max(settle, state.settle);
  });
  return settle;
}
