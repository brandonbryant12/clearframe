import { EXPECTATIONS_VERSION } from './contracts.mjs';
import type { MaturityCurves, Tenor, CurveSnapshot } from './contracts.mjs';
import {
  object,
  check,
  isCurveKind,
  list,
  num,
  label,
  dated,
  nullable,
} from './inputs.mjs';

/** Quotes at one observation date across nonuniform remaining maturities.
 * No interpolation, discount-factor model or implied future-rate forecast is created.
 */
export function maturityCurves(input: unknown): MaturityCurves {
  object(input, ['tenors', 'snapshots', 'kind', 'unit'], 'maturity curves');
  const { kind, unit } = input;
  check(isCurveKind(kind), 'kind must be par, spot or quoted');
  check(unit === 'percent-per-year', 'unit must be percent-per-year');
  const tenorRows = input.tenors,
    snapshotRows = input.snapshots;
  list(tenorRows, 2, 120, 'tenors');
  list(snapshotRows, 1, 100, 'snapshots');
  let previous = 0,
    previousYears = 0;
  const tenors = tenorRows.map((t): Tenor => {
    object(t, ['months', 'label'], 'tenor');
    const months = num(t.months, 'tenor months');
    check(
      months > previous && months <= 1200,
      'maturities must strictly increase in (0,1200] months',
    );
    const years = months / 12;
    check(
      years > previousYears,
      'maturity normalization underflow or collapse',
    );
    previous = months;
    previousYears = years;
    return { months, years, label: label(t.label, 'tenor label') };
  });
  let last = -Infinity;
  const snapshots = snapshotRows.map((s): CurveSnapshot => {
    object(s, ['date', 'values'], 'curve snapshot');
    const { date, day } = dated(s.date);
    check(day > last, 'snapshot dates must strictly increase');
    last = day;
    const quotes = s.values;
    check(
      Array.isArray(quotes) && quotes.length === tenors.length,
      'each snapshot needs every tenor, with null for missing',
    );
    return {
      date,
      values: tenors.map((t, i) => ({
        ...t,
        value: nullable(quotes[i], 'quoted yield'),
      })),
    };
  });
  return {
    modelVersion: EXPECTATIONS_VERSION,
    kind,
    unit,
    xMeaning: 'remaining maturity in years, not a future observation date',
    interpolation: 'none',
    tenors,
    snapshots,
  };
}
