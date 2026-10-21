import type { Point } from '../../../film/contracts/primitives.mjs';

export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: {
    start?: string;
    low?: string;
    drop?: number;
    act?: string;
    back?: string;
    from?: string;
    to?: string;
    decimals?: number;
  };
}

// A sharp fall, what was done, and the recovery, drawn from the stated points only: a time axis
// in real days (months from the calendar, no values invented), the start on a 0% line with its day
// in a small ink tag, a dashed straight line down to the low (the source gives two points, not the
// path between them), the stated fall in a filled chip that slides out of the low, an optional pin
// raised from the line on the day something was done (a rebalance, a purchase) and an optional
// dashed climb back to 0%. No fills under the line, no gridline values: the only figure is the
// fall, printed from sketchParams, and every day on screen is printed from its param. A dot and a
// pale disc ride the head of each line, so each move reads on a phone (and as motion to draft).
// Moments: OPEN, FALL, LOW, then ACT (with act) and RECOVER (with back) in their dates' order.
export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export const DAY = 86400000;

export interface DashOptions {
  on: number;
  off: number;
  cue: string;
  dur: number;
  delay?: number;
  at?: (fraction: number) => number;
  stroke?: string;
  width?: number;
}

export interface ChipSpot {
  x: number;
  lead?: Point;
}

export interface LabelSpot {
  x: number;
  anchor: string;
  a: number;
  b: number;
  under?: boolean;
}

/** A "YYYY-MM-DD" param as a day number (UTC), refused by name when it is not a real date. */
export function day(name: string, s: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m)
    throw new Error(
      `sketchParams.${name} for drawdown must be a date written YYYY-MM-DD, like "2027-08-19" (got ${JSON.stringify(s)})`,
    );
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const t = Date.UTC(y, mo - 1, d),
    back = new Date(t);
  if (
    back.getUTCFullYear() !== y ||
    back.getUTCMonth() !== mo - 1 ||
    back.getUTCDate() !== d
  )
    throw new Error(
      `sketchParams.${name} for drawdown is not a date on the calendar (got "${s}")`,
    );
  return t / DAY;
}

export const ymd = (n: number) => {
  const d = new Date(n * DAY);
  return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()];
};

export const short = (n: number) => `${MONTHS[ymd(n)[1]]} ${ymd(n)[2]}`;

export const quarterStart = (n: number) =>
  Date.UTC(ymd(n)[0], ymd(n)[1] - (ymd(n)[1] % 3), 1) / DAY;

export const quarterEnd = (n: number) =>
  Date.UTC(ymd(n)[0], ymd(n)[1] - (ymd(n)[1] % 3) + 3, 0) / DAY;
