import type { ValuationScale } from '../../valuation-data.mjs';

import { check } from './check.mjs';
import { colorFraction } from './color-fraction.mjs';

export function valuationColor(
  value: number | null,
  scale: Pick<ValuationScale, 'min' | 'max'>,
) {
  if (value === null) return '#e7e7e2';
  check(
    Number.isFinite(value) && value >= scale.min && value <= scale.max,
    'color value outside scale',
  );
  const base = [247, 247, 242],
    target = value < 0 ? [231, 170, 119] : [135, 176, 213],
    t = colorFraction(value, scale);
  return (
    '#' +
    base
      .map((v, i) =>
        Math.round(v + (target[i] - v) * t)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
