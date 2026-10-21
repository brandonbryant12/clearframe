export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: {
    limit?: number;
    used?: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    tone?: string;
  };
}

// How much of a yearly limit is used, and how much room is left: a track drawn to scale from
// zero to the limit; the used share fills it on its word while its amount counts up; the limit
// lands at the end; the room left is bracketed and named. A deductible met so far, an
// out-of-pocket maximum, a contribution limit, an allowance. The amounts come from
// sketchParams and are drawn to scale, never estimated from the picture. Moments: FILL, LIMIT, LEFT.
export const AT = { FILL: 1.0, LIMIT: 2.6, LEFT: 4.0 };
