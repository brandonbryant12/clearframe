import { type AxisValue } from '../../plot-data.mjs';

export const show = { at: 0, enter: 'none' };

/** Whether a numeric axis value has the sign `k` (-1 below zero, 1 above); a date has none. */
export const hasSign = (v: AxisValue, k: number): boolean =>
  typeof v === 'number' && v * k > 0;
