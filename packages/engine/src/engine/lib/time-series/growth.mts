import type {
  Growth,
  GrowthObservation,
  ValueObservation,
  GrowthGap,
} from './contracts.mjs';
import {
  own,
  values,
  frequencyOf,
  cadence,
  integer,
  check,
  num,
  basis,
} from './inputs.mjs';

/** Relative endpoint change across lag periods; change-in-growth uses consecutive results.
 * Annualization compounds the observed lag ratio. It is not a forecast.
 */
export function growthSeries(input: unknown): Growth {
  own(input, ['observations', 'frequency', 'lag', 'annualize'], 'growth');
  const observations = values(input.observations),
    frequency = frequencyOf(input.frequency),
    periodsPerYear = cadence(observations, frequency);
  const lag = integer(input.lag, 1, 1199, 'lag');
  const annualize = input.annualize;
  check(typeof annualize === 'boolean', 'annualize must be explicit');
  const out = observations.map((p, i) => {
    const previous = i >= lag ? observations[i - lag] : null;
    const missing = growthMissing(p, previous);
    let change: number | null = null,
      annualized: number | null = null;
    if (!missing && previous && p.value !== null && previous.value !== null) {
      const ratio = num(p.value / previous.value, 'level ratio');
      check(p.value === 0 || ratio > 0, 'positive level ratio underflow');
      change = num(ratio - 1, 'relative change');
      if (annualize)
        annualized = num(
          Math.expm1((Math.log(ratio) * periodsPerYear) / lag),
          'annualized change',
        );
    }
    return {
      ...p,
      baseDate: previous?.date ?? null,
      change,
      annualized,
      missing,
    };
  });
  const withGrowth = out.map((o, i): GrowthObservation => {
    const now = annualize ? o.annualized : o.change,
      previous = growthValue(out[i - 1], annualize);
    return {
      ...o,
      changeInGrowth:
        now === null || previous === null
          ? null
          : num(now - previous, 'change in growth'),
    };
  });
  return {
    ...basis(frequency),
    method: 'lagged-relative-endpoints',
    lag,
    annualize,
    periodsPerYear,
    changeInGrowthUnit: 'fraction points between consecutive observations',
    observations: withGrowth,
  };
}

export function growthMissing(
  current: ValueObservation,
  previous: ValueObservation | null,
): GrowthGap | null {
  if (previous === null) return 'warmup';
  if (current.value === null || previous.value === null)
    return 'missing-endpoint';
  if (previous.value <= 0) return 'nonpositive-base';
  return current.value < 0 ? 'negative-ending-level' : null;
}

export function growthValue(
  value: Pick<GrowthObservation, 'change' | 'annualized'> | undefined,
  annualize: boolean,
): number | null {
  if (!value) return null;
  return annualize ? value.annualized : value.change;
}
