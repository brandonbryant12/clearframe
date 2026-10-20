import { isRecord } from '../errors.mjs';
import { FINANCE_MODEL_VERSION } from './contracts.mjs';
import type { FeeComparisonResult, LedgerResult } from './contracts.mjs';
import { object, fraction, entries, check } from './inputs.mjs';
import { accountLedger } from './ledger.mjs';

/** `{account, baselineFeeRate, comparisonFeeRate}`: the same account under two fee rates. */
export function feeComparison(input: unknown): FeeComparisonResult {
  object(
    input,
    ['account', 'baselineFeeRate', 'comparisonFeeRate'],
    'feeComparison',
  );
  const baselineFeeRate = fraction(input.baselineFeeRate, 'baselineFeeRate');
  const comparisonFeeRate = fraction(
    input.comparisonFeeRate,
    'comparisonFeeRate',
  );
  // Validate before replacing rates so a malformed source period cannot be hidden.
  accountLedger(input.account);
  // accountLedger accepted it: an object whose periods are objects.
  const account = input.account;
  object(account, ['openingBalance', 'cashflowTiming', 'periods'], 'account');
  const periods = entries(
    account.periods,
    1200,
    'periods must contain 1–1200 explicit return observations or assumptions',
  ).filter(isRecord);
  check(
    periods.every((p) => p.feeRate == null && p.feeAmount == null),
    'feeComparison requires periods without pre-existing fee fields',
  );
  const run = (feeRate: number): LedgerResult =>
    accountLedger({
      ...account,
      periods: periods.map((p) => ({ ...p, feeRate })),
    });
  const baseline = run(baselineFeeRate),
    comparison = run(comparisonFeeRate);
  return {
    modelVersion: FINANCE_MODEL_VERSION,
    baseline,
    comparison,
    endingBalanceDifference:
      baseline.closingBalance - comparison.closingBalance,
    chargedFeeDifference: comparison.totals.fees - baseline.totals.fees,
    gainDifference: baseline.totals.gain - comparison.totals.gain,
    fundedWithdrawalDifference:
      baseline.totals.withdrawn - comparison.totals.withdrawn,
  };
}
