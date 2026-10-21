export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: { rows?: string[]; pick?: string };
}

// Two options compared row by row: two cards stand side by side (stacked in tall frames), the
// rows arrive one at a time and each row ticks the option that wins it; at the end one card is
// chosen and lifts forward while the other recedes. Who wins each row and which card is chosen
// are params, so the picture says exactly what the narration does. Moments: ONE, TWO, THREE,
// FOUR (one per row) and PICK.
export const NAMES = ['ONE', 'TWO', 'THREE', 'FOUR'];

export const LABELS = ['ROWONE', 'ROWTWO', 'ROWTHREE', 'ROWFOUR'];

export const WINS = ['a', 'b', 'both', 'neither'];

export const ROW0 = 1.3,
  STEP = 1.2;
