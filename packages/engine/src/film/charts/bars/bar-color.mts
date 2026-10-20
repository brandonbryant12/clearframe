import type { BarValue } from './contracts.mjs';

export function barColor(value: BarValue, colors: string): string {
  if (value.highlight) return 'accent2';
  return colors === 'single' || value.value >= 0 ? 'accent' : 'negative';
}
