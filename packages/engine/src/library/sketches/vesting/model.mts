export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: { steps?: number[] };
}

// Ownership that unlocks over time: a timeline of steps (years, quarters), each with a padlock
// and a column. As time reaches a step, the timeline fills to it, the padlock springs open and
// the column grows to the share owned by then; the big figure beside it counts up to the same
// share. A step that adds nothing (a cliff year) keeps its lock shut and gives it a shake. The
// shares come from sketchParams, never from the drawing. Moments: ONE, TWO, THREE … SIX, one per step.
export const NAMES = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];

export const FIRST = 1.0,
  GAP = 1.8;
