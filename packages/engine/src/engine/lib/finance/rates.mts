import { number, check, money, computed } from './inputs.mjs';

export function periodicRate(
  annualEffectiveRate: unknown,
  periodsPerYear: unknown,
): number {
  const annual = number(annualEffectiveRate, 'annualEffectiveRate', -1);
  check(
    typeof periodsPerYear === 'number' &&
      Number.isInteger(periodsPerYear) &&
      periodsPerYear >= 1 &&
      periodsPerYear <= 366,
    'periodsPerYear must be an integer from 1 to 366',
  );
  return annual === -1 ? -1 : Math.expm1(Math.log1p(annual) / periodsPerYear);
}

export function purchasingPower(
  nominalAmount: unknown,
  priceIndex: unknown,
  baseIndex: unknown,
): number {
  const nominal = money(nominalAmount, 'nominalAmount');
  const price = number(priceIndex, 'priceIndex', Number.MIN_VALUE);
  const base = number(baseIndex, 'baseIndex', Number.MIN_VALUE);
  return computed(nominal * (base / price), 'purchasingPower');
}
