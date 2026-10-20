import { round } from '../../../film/sketch-kit.mjs';

export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: {
    start?: number;
    end?: number;
    discount?: number;
    prefix?: string;
    decimals?: number;
    gain?: boolean;
  };
}

// The lower of two prices, then a discount (an employee share purchase plan's lookback, a price
// protection offer): a price line draws across one offering period with its area tinted in, the
// first-day and last-day prices are marked as dots with a tag each (the day over the price), the
// lower one is circled by hand and carried by a dashed level line to the purchase just past the
// period's end, where a bar drops from it by the discount to the price you pay. Optionally the
// gap between what you pay and the last-day price shades in, bracketed and labelled. The line's
// path is seeded and smooth: it starts and ends exactly on the two prices and never dips below
// the lower one, so the space under it holds the purchase. Every printed value comes from
// sketchParams (what you pay is worked out from them). The empty period (panel, axis, its two
// days) is there from the first frame. Moments: PERIOD, START, END, LOWER, DISCOUNT, PAY, GAIN
// (with gain), each a change a phone can see.
export const SAMPLES = 120;

/** A loop of marker round a label, drawn a little past a full turn and a little tilted, as a hand would. */
export function ring(cx: number, cy: number, rx: number, ry: number) {
  const pts = [];
  for (let a = 0; a <= 1.12; a += 0.03) {
    const t = (-0.3 + a) * 2 * Math.PI,
      g = 1 + 0.07 * a;
    const [px, py] = [rx * g * Math.cos(t), ry * g * Math.sin(t)];
    pts.push([
      round(cx + px * 0.998 + py * 0.05),
      round(cy + py * 0.998 - px * 0.05),
    ]);
  }
  return pts;
}
