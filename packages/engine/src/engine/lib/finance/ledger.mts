import { TOTAL_KEYS, FINANCE_MODEL_VERSION } from './contracts.mjs';
import type { LedgerResult, LedgerTotals, LedgerRow } from './contracts.mjs';
import {
  object,
  money,
  check,
  entries,
  number,
  fraction,
  computed,
} from './inputs.mjs';

/** `{openingBalance, cashflowTiming, periods: [{label, returnRate, employee?, employer?, withdrawal?, feeRate?, feeAmount?}]}`. */
export function accountLedger(input: unknown): LedgerResult {
  object(input, ['openingBalance', 'cashflowTiming', 'periods'], 'account');
  const openingBalance = money(input.openingBalance, 'openingBalance');
  const cashflowTiming = input.cashflowTiming;
  check(
    cashflowTiming === 'start' || cashflowTiming === 'end',
    'cashflowTiming must be start or end',
  );
  const periods = entries(
    input.periods,
    1200,
    'periods must contain 1–1200 explicit return observations or assumptions',
  );
  let balance = openingBalance;
  const labels = new Set<string>();
  const totals: LedgerTotals = {
    employee: 0,
    employer: 0,
    gain: 0,
    fees: 0,
    unpaidFees: 0,
    withdrawn: 0,
    shortfall: 0,
  };
  const rows = periods.map((p, i): LedgerRow => {
    object(
      p,
      [
        'label',
        'employee',
        'employer',
        'withdrawal',
        'returnRate',
        'feeRate',
        'feeAmount',
      ],
      `periods[${i}]`,
    );
    const label = p.label;
    check(
      typeof label === 'string' &&
        label.trim().length > 0 &&
        label.length <= 80,
      `periods[${i}].label must be nonempty text up to 80 characters`,
    );
    check(!labels.has(label), 'period labels must be unique');
    labels.add(label);
    const employee = money(
      p.employee === undefined ? 0 : p.employee,
      'employee',
    );
    const employer = money(
      p.employer === undefined ? 0 : p.employer,
      'employer',
    );
    const requestedWithdrawal = money(
      p.withdrawal === undefined ? 0 : p.withdrawal,
      'withdrawal',
    );
    const rate = number(p.returnRate, 'returnRate', -1);
    const feeRate = fraction(
      p.feeRate === undefined ? 0 : p.feeRate,
      'feeRate',
    );
    const feeAmount = money(
      p.feeAmount === undefined ? 0 : p.feeAmount,
      'feeAmount',
    );
    const opening = balance;
    let withdrawn = 0;
    const cashflow = (): void => {
      balance = computed(
        balance + employee + employer,
        'balance after contributions',
      );
      withdrawn = Math.min(requestedWithdrawal, balance);
      balance -= withdrawn;
    };
    if (cashflowTiming === 'start') cashflow();
    const gain = computed(balance * rate, 'period gain');
    balance = computed(balance + gain, 'balance after return');
    const assessedFees = computed(
      balance * feeRate + feeAmount,
      'assessed fees',
    );
    const fees = Math.min(balance, assessedFees);
    balance -= fees;
    if (cashflowTiming === 'end') cashflow();
    const row: LedgerRow = {
      label,
      opening,
      employee,
      employer,
      returnRate: rate,
      gain,
      feeRate,
      feeAmount,
      assessedFees,
      fees,
      unpaidFees: assessedFees - fees,
      requestedWithdrawal,
      withdrawn,
      shortfall: requestedWithdrawal - withdrawn,
      closing: balance,
    };
    for (const key of TOTAL_KEYS)
      totals[key] = computed(totals[key] + row[key], `total ${key}`);
    return row;
  });
  return {
    modelVersion: FINANCE_MODEL_VERSION,
    openingBalance,
    cashflowTiming,
    feeTiming: 'after return, before end-of-period cashflows',
    rows,
    totals,
    closingBalance: balance,
  };
}
