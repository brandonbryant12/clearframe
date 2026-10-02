import test from 'node:test';
import assert from 'node:assert/strict';
import { periodicRate, matchingContribution, vestedBalance, salaryServiceBenefit,
  accountLedger, feeComparison, purchasingPower } from '../engine/lib/finance.mjs';
const near = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const period = (label, extra = {}) => ({ label, returnRate: 0, ...extra });

test('effective annual rate conversion compounds back, including losses and total loss', () => {
  for (const r of [0, 0.08, -0.2, -1]) near((1 + periodicRate(r, 12)) ** 12 - 1, r);
  assert.throws(() => periodicRate(-1.01, 12));
  assert.throws(() => periodicRate(0.1, 0));
});

test('tiered match applies marginal bands, not the top rate to the entire contribution', () => {
  const tiers = [{ through: 0.03, rate: 1 }, { through: 0.05, rate: 0.5 }];
  for (const [contribution, expected] of [[0, 0], [200, 200], [300, 300], [400, 350], [600, 400]]) {
    near(matchingContribution({ compensation: 10000, employeeContribution: contribution, tiers }).employerContribution, expected);
  }
  assert.throws(() => matchingContribution({ compensation: 100, employeeContribution: 120, tiers }));
  assert.throws(() => matchingContribution({ compensation: 100, employeeContribution: 2, tiers: [...tiers].reverse() }));
});

test('vesting preserves the employee balance and changes only at credited-service thresholds', () => {
  const common = { employeeBalance: 8000, employerBalance: 2000,
    schedule: [{ service: 0, fraction: 0 }, { service: 2, fraction: 0.5 }, { service: 4, fraction: 1 }] };
  assert.equal(vestedBalance({ ...common, creditedService: 1.99 }).totalOwned, 8000);
  assert.equal(vestedBalance({ ...common, creditedService: 2 }).totalOwned, 9000);
  assert.equal(vestedBalance({ ...common, creditedService: 9 }).totalOwned, 10000);
  assert.throws(() => vestedBalance({ ...common, creditedService: 1, schedule: [{ service: 1, fraction: 1 }] }));
});

test('salary/service example resolves annual and monthly benefit without inferred adjustments', () => {
  const result = salaryServiceBenefit({ annualCompensation: 60000, creditedYears: 20, annualAccrualRate: 0.015, adjustmentFactor: 1 });
  assert.equal(result.annual, 18000); assert.equal(result.monthly, 1500);
  assert.throws(() => salaryServiceBenefit({ annualCompensation: 60000, creditedYears: 20, annualAccrualRate: 0.015 }));
});

test('cashflow timing matches independent annuity formulas and never rounds intermediate balances', () => {
  const n = 24, r = 0.01, contribution = 100, opening = 1000;
  const common = { openingBalance: opening, periods: Array.from({ length: n }, (_, i) => period(String(i), { returnRate: r, employee: contribution })) };
  const annuity = contribution * ((1 + r) ** n - 1) / r;
  near(accountLedger({ ...common, cashflowTiming: 'end' }).closingBalance, opening * (1 + r) ** n + annuity);
  near(accountLedger({ ...common, cashflowTiming: 'start' }).closingBalance, opening * (1 + r) ** n + annuity * (1 + r));
});

test('period ledgers reconcile gains, fees, contributions and funded withdrawals', () => {
  // Start: (100 + 20 + 10 - 40) * 1.1 * .99 - 2 = 96.01.
  const periods = [period('A', { employee: 20, employer: 10, withdrawal: 40, returnRate: 0.1, feeRate: 0.01, feeAmount: 2 }), period('B', { returnRate: -0.2 })];
  const result = accountLedger({ openingBalance: 100, cashflowTiming: 'start', periods });
  near(result.rows[0].closing, 96.01); near(result.closingBalance, 76.808);
  for (const row of result.rows) near(row.closing, row.opening + row.employee + row.employer + row.gain - row.fees - row.withdrawn);
  const t = result.totals; near(result.closingBalance, 100 + t.employee + t.employer + t.gain - t.fees - t.withdrawn);
});

test('unfunded fees and withdrawals remain visible instead of creating negative payable cash', () => {
  const r = accountLedger({ openingBalance: 10, cashflowTiming: 'end', periods: [period('A', { feeAmount: 15, employee: 2, withdrawal: 9 })] }).rows[0];
  assert.equal(r.fees, 10); assert.equal(r.unpaidFees, 5);
  assert.equal(r.withdrawn, 2); assert.equal(r.shortfall, 7); assert.equal(r.closing, 0);
  const wiped = accountLedger({ openingBalance: 100, cashflowTiming: 'end', periods: [period('A', { returnRate: -1, employee: 10 })] });
  assert.equal(wiped.closingBalance, 10);
});

test('fee comparison separates paid fees, growth difference and withdrawal differences', () => {
  const account = { openingBalance: 1000, cashflowTiming: 'end', periods: [period('1', { returnRate: 0.1 }), period('2', { returnRate: 0.1 })] };
  const r = feeComparison({ account, baselineFeeRate: 0, comparisonFeeRate: 0.01 });
  near(r.baseline.closingBalance, 1210); near(r.comparison.closingBalance, 1185.921);
  near(r.chargedFeeDifference, 22.979); near(r.gainDifference, 1.1);
  near(r.endingBalanceDifference, r.chargedFeeDifference + r.gainDifference - r.fundedWithdrawalDifference);
  assert.throws(() => feeComparison({ account: { ...account, periods: [period('1', { feeAmount: 5 })] }, baselineFeeRate: 0, comparisonFeeRate: 0.01 }));
});

test('sequence changes outcomes with withdrawals despite an identical return set', () => {
  const run = returns => accountLedger({ openingBalance: 100, cashflowTiming: 'start', periods: returns.map((returnRate, i) => period(String(i), { returnRate, withdrawal: 10 })) });
  near(run([0.2, -0.2]).closingBalance, 78.4); near(run([-0.2, 0.2]).closingBalance, 74.4);
});

test('real values use an explicit common price basis, with invalid and overflowing inputs rejected', () => {
  near(purchasingPower(1200, 120, 100), 1000);
  assert.throws(() => purchasingPower(1200, 0, 100));
  assert.throws(() => purchasingPower(1e12, Number.MIN_VALUE, 100));
  const account = { openingBalance: 100, cashflowTiming: 'end', periods: [period('1')] };
  assert.throws(() => accountLedger({ ...account, periods: [{ label: '1' }] }));
  assert.throws(() => accountLedger({ ...account, periods: [period('1', { returnRate: NaN })] }));
  assert.throws(() => accountLedger({ ...account, periods: [period('1'), period('1')] }));
  assert.throws(() => accountLedger({ ...account, periods: [period('1', { returnRate: -1.1 })] }));
  assert.throws(() => accountLedger({ ...account, periods: [period('1', { employerContributon: 5 })] }));
  assert.throws(() => accountLedger({ ...account, periods: [period('1', { employee: null })] }));
  assert.throws(() => accountLedger({ ...account, periods: [period('1', { returnRate: 1e99 })] }));
  assert.throws(() => accountLedger({ ...account, openingBalance: -1 }));
});
