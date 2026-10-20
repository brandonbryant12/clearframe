export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: {
    you?: number;
    match?: number;
    suffix?: string;
    fromYou?: number;
    fromMatch?: number;
    again?: number;
    start?: string;
  };
}

// Two contributions that become one: your coins drop into a stack, the company's drop in beside
// them, then the two stacks come together into one with its total on top. One coin is one unit
// (a percent of pay, a dollar, a share), so the picture agrees with the figures: the counts come
// from sketchParams, not from the drawing. Moments: YOU, MATCH, TOTAL.
export const AT = {
  NOWYOU: 0.6,
  NOWMATCH: 1.4,
  YOU: 0.5,
  MATCH: 2.4,
  TOTAL: 4.6,
  AGAIN: 7.2,
};
