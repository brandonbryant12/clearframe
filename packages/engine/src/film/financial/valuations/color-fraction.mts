import type { ValuationScale } from '../../valuation-data.mjs';

export function colorFraction(
  value: number,
  scale: Pick<ValuationScale, 'min' | 'max'>,
): number {
  if (value === 0) return 0;
  return value < 0
    ? value / Math.min(0, scale.min)
    : value / Math.max(0, scale.max);
}
