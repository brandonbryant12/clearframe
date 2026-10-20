import { TIME_SERIES_VERSION } from './contracts.mjs';
import type {
  Deflation,
  PriceObservation,
  DeflatedObservation,
} from './contracts.mjs';
import { own, records, dated, check, num } from './inputs.mjs';

/** A supplied same-date price index deflates nominal values into base-date units. */
export function deflateSeries(input: unknown): Deflation {
  own(input, ['observations', 'baseDate'], 'deflation');
  const observations = records(
    input.observations,
    ['nominal', 'priceIndex'],
    (date, f): PriceObservation => ({
      date,
      nominal: f('nominal'),
      priceIndex: f('priceIndex'),
    }),
  );
  const baseDate = dated(input.baseDate).date;
  for (const p of observations)
    check(
      p.priceIndex === null || p.priceIndex > 0,
      'observed price indexes must be positive',
    );
  const base = observations.find((p) => p.date === baseDate);
  check(
    base && base.priceIndex !== null,
    'baseDate needs an observed positive price index',
  );
  const basePriceIndex = base.priceIndex;
  return {
    modelVersion: TIME_SERIES_VERSION,
    method: 'matched-date-price-ratio',
    baseDate,
    basePriceIndex,
    observations: observations.map((p): DeflatedObservation => {
      const ratio =
        p.priceIndex === null
          ? null
          : num(p.priceIndex / basePriceIndex, 'price ratio');
      if (ratio !== null) check(ratio > 0, 'price ratio underflow');
      const real =
        p.nominal === null || ratio === null
          ? null
          : num(p.nominal / ratio, 'real value');
      if (real !== null && p.nominal !== 0)
        check(real !== 0, 'real value underflow');
      return {
        ...p,
        priceRatio: ratio,
        real,
        gap:
          real === null || p.nominal === null
            ? null
            : num(p.nominal - real, 'nominal minus real'),
        missing: deflationMissing(p, ratio),
      };
    }),
  };
}

export function deflationMissing(
  p: PriceObservation,
  ratio: number | null,
): DeflatedObservation['missing'] {
  if (p.nominal === null) return 'nominal';
  return ratio === null ? 'price-index' : null;
}
