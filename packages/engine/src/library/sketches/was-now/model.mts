export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: {
    was?: number;
    now?: number;
    prefix?: string;
    suffix?: string;
    decimals?: number;
    note?: boolean;
    start?: string;
  };
}

// A rule's number changes: the old window drawn to scale from zero, then, on its word, the part
// that no longer counts falls away (or the new part grows on), the old end is struck and the new
// one lands. A claim deadline cut from 60 days to 30, a waiting period, a limit raised. Both
// numbers come from sketchParams and are drawn to scale. Moments: CHANGE (and NOTE when set);
// with start "empty", WAS first: the old window grows from zero as the voice names it.
export const AT = { WAS: 0.4, CHANGE: 1.4, NOTE: 3.0 };
