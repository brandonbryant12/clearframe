import type { CarryoverOn, DrawTick } from './contracts.mjs';

import { round } from '../../../film/sketch-kit.mjs';

// What carries into next year and what does not: this year's elections in one column, next
// year's empty slots in the other, a dashed line between. On its word each card that carries over
// crosses the line and is ticked; a card that does not (an FSA election that resets) runs to the
// line, hits it (the line turns red there) and comes back, and what it becomes ("$0") lands in
// its empty slot. With `bookend` the board opens where that left it, and on FIX the card that
// stayed crosses too and is ticked: the close of a film that opened on the board.
// Moments: CARD1 … CARDn (each card's word) and RESET; with bookend, FIX (the reset clears) and
// CROSS (the card that stayed crosses).
export const AT = {
  CARD1: 1.0,
  CARD2: 1.7,
  CARD3: 2.4,
  CARD4: 3.1,
  CARD5: 3.8,
  RESET: 4.6,
  FIX: 1.0,
  CROSS: 1.25,
};

export function cardTick(
  stay: boolean,
  bookend: boolean,
  tick: DrawTick,
  y: number,
  on: CarryoverOn,
  cue: keyof typeof AT,
) {
  if (stay) {
    if (bookend) {
      return tick(y, (dt: number) => on('CROSS', dt));
    }
    return [];
  }
  return tick(y, bookend ? null : (dt: number) => on(cue, dt));
}

export function crossingKeys(
  bookend: boolean,
  stay: boolean,
  on: CarryoverOn,
  across: number,
  cue: keyof typeof AT,
  mid: number,
  left: number,
  colW: number,
) {
  if (bookend) {
    if (stay) {
      return [
        {
          ...on('CROSS', 0),
          dur: 0.8,
          ease: 'inOut',
          x: across,
          sound: 'chime',
        },
      ];
    }
    return [];
  }
  if (stay) {
    return [
      {
        ...on(cue, 0),
        dur: 0.4,
        ease: 'in',
        x: round(mid - left - colW - 6),
      },
      { ...on(cue, 0.4), dur: 0.55, ease: 'out', x: 0 },
    ];
  }
  return [{ ...on(cue, 0), dur: 0.8, ease: 'inOut', x: across }];
}
