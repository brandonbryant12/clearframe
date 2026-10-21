export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: {
    years?: number;
    perYear?: number;
    rate?: number;
    prefix?: string;
    startYear?: number;
  };
}

// Saving over the years: one column per year (or every few years) stacks what you put in and,
// on top of it, what it grew. The columns rise as a straight ramp of contributions first, then
// the growth climbs onto each one, small at first and larger than the contributions by the end:
// compounding, seen. The last column is named in parts (what you put in, what it grew) and the
// total counts up beside it. Every height and figure is computed from the stated assumption in
// sketchParams (the same amount put in at the start of each year, growing at one annual rate,
// compounded yearly), never drawn by eye. Moments: START, GROW, TOTAL.
export const AT = { START: 0.6, GROW: 2.8, TOTAL: 5.2 };
