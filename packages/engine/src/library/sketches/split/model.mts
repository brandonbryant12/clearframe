export interface CueTimes {
  [cue: string]: number;
}

export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: {
    parts?: number[];
    prefix?: string;
    suffix?: string;
    total?: boolean;
  };
}

// A whole splits into its parts: one full bar (a paycheck, a premium, a budget) opens into
// segments sized by the real values, and each segment drops into its own labelled lane at the
// same place it held in the whole, so the lanes still tile the whole's width and the parts are
// seen to add up. Every value (and the total beside the whole) is printed from sketchParams,
// never drawn by eye; the last part, the remainder, is highlighted at the end.
// Moments: SPLIT, then ONE…FIVE (each part landing) and REST (the remainder highlighted).
export const NAMES = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];

export const LABELS = [
  'PARTONE',
  'PARTTWO',
  'PARTTHREE',
  'PARTFOUR',
  'PARTFIVE',
];
