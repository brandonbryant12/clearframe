import { utcDay } from './utc-day.mjs';
import { check } from './check.mjs';
import { finite } from './primitives.mjs';

export function axisValue(value: unknown, type: string): number {
  if (type === 'date') return utcDay(value);
  check(finite(value), 'axis values must be finite numbers within ±10^12');
  if (type === 'log') check(value > 0, 'log values must be positive');
  return value;
}
