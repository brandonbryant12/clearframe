import type { ElementSchedule } from './canvas-schedule-contracts.mjs';
export function scheduleExit(state: ElementSchedule): void {
  const { el, resolve, at, dur, entrance, limit, enterWord } = state;

  if (el.exitSay != null) {
    const word = el.exitSay;
    // `exitAfter` leaves that many seconds after the word, as `after` does for an entrance.
    let exitAt = resolve(word) + (el.exitAfter ?? 0);
    delete el.exitSay;
    delete el.exitAfter;
    // An exit on a word said before an entrance timed in seconds (a sketch's whole bar that
    // splits on the first word) waits for the entrance to finish. Two words in the wrong
    // order are a mistake to fix, so they still refuse, quoting both.
    if (exitAt < at && enterWord == null) exitAt = at + dur;
    else if (exitAt < at)
      throw new Error(
        `an element that enters on "${enterWord}" (${at.toFixed(2)}s) exits on "${word}" (${exitAt.toFixed(2)}s), which is said first: swap the words, or in a sketch give its moments words in the order sketch NAME lists them`,
      );
    el.exitAt = exitAt;
  }

  if (el.exitAt != null) {
    const exitAt = el.exitAt;
    el.exitDur ??= entrance;
    if (exitAt < at)
      throw new Error(
        `an element exits (${exitAt.toFixed(2)}s) before it enters (${at.toFixed(2)}s)`,
      );
    // An exit timed after the beat (tidying a world while the camera is away) does not hold it.
    if (exitAt < limit)
      state.settle = Math.max(state.settle, exitAt + el.exitDur);
  }
}
