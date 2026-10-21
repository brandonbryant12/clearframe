export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: {
    total?: number;
    keep?: number;
    each?: number;
    prefix?: string;
    suffix?: string;
  };
}

// Use it or lose it: a glass jar fills with this year's coins, one per unit. At year end a
// carry-over line cuts across the jar; the coins above it turn and lift away, leaving a dashed
// outline of what was lost, and the coins below it stay with you. Brackets beside the jar name
// both parts with their amounts. Every count comes from sketchParams, never from the drawing.
// Moments: FILL, YEAREND, KEEP.
export const AT = { FILL: 0.6, YEAREND: 3.0, KEEP: 5.0 };
