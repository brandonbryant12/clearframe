// Deterministic illustrative calculations. No plan rules, market assumptions or tax limits.
// Currency values remain unrounded; round only when presenting. See docs/finance-calculations.md.
export const FINANCE_MODEL_VERSION = 1;
const fail = message => { throw new Error(`finance: ${message}`); };
const check = (condition, message) => { if (!condition) fail(message); };
function object(value, fields, name) {
  check(value && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
  for (const key of Object.keys(value)) check(fields.includes(key), `unknown ${name}.${key}`);
}
function number(value, name, min = -Infinity, max = Infinity) {
  check(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max,
    `${name} must be finite and in [${min}, ${max}]`);
  return value;
}
// Above this range cent-scale presentation loses useful precision with binary floating point.
const money = (value, name) => number(value, name, 0, 1e12);
const computed = (value, name) => number(value, name, -1e12, 1e12);
const fraction = (value, name) => number(value, name, 0, 1);

export function periodicRate(annualEffectiveRate, periodsPerYear) {
  number(annualEffectiveRate, 'annualEffectiveRate', -1);
  check(Number.isInteger(periodsPerYear) && periodsPerYear >= 1 && periodsPerYear <= 366,
    'periodsPerYear must be an integer from 1 to 366');
  return annualEffectiveRate === -1 ? -1 : Math.expm1(Math.log1p(annualEffectiveRate) / periodsPerYear);
}

export function matchingContribution(input) {
  object(input, ['compensation', 'employeeContribution', 'tiers'], 'match');
  const compensation = money(input.compensation, 'compensation');
  const contribution = money(input.employeeContribution, 'employeeContribution');
  check(contribution <= compensation, 'employeeContribution exceeds compensation');
  check(Array.isArray(input.tiers) && input.tiers.length > 0 && input.tiers.length <= 20,
    'tiers must contain 1–20 cumulative compensation thresholds');
  let previous = 0;
  const tiers = input.tiers.map((tier, i) => {
    object(tier, ['through', 'rate'], `tiers[${i}]`);
    const through = fraction(tier.through, `tiers[${i}].through`);
    check(through > previous, 'tier thresholds must strictly increase');
    const rate = number(tier.rate, `tiers[${i}].rate`, 0);
    const eligible = Math.max(0, Math.min(contribution, compensation * through) - compensation * previous);
    const matched = computed(eligible * rate, `tiers[${i}].matched`);
    const result = { from: previous, through, rate, eligible, matched };
    previous = through;
    return result;
  });
  return { modelVersion: FINANCE_MODEL_VERSION, tiers,
    employerContribution: computed(tiers.reduce((sum, t) => sum + t.matched, 0), 'employerContribution'),
    aboveMatchThreshold: Math.max(0, contribution - compensation * previous) };
}

export function vestedBalance(input) {
  object(input, ['employeeBalance', 'employerBalance', 'creditedService', 'schedule'], 'vesting');
  const employee = money(input.employeeBalance, 'employeeBalance');
  const employer = money(input.employerBalance, 'employerBalance');
  const service = number(input.creditedService, 'creditedService', 0);
  check(Array.isArray(input.schedule) && input.schedule.length > 0 && input.schedule.length <= 100,
    'schedule must contain 1–100 steps beginning at service 0');
  let lastService = -1, lastFraction = -1, vestedFraction = 0;
  for (const [i, step] of input.schedule.entries()) {
    object(step, ['service', 'fraction'], `schedule[${i}]`);
    number(step.service, `schedule[${i}].service`, 0);
    fraction(step.fraction, `schedule[${i}].fraction`);
    check(i !== 0 || step.service === 0, 'schedule must start at service 0');
    check(step.service > lastService && step.fraction >= lastFraction, 'schedule must be ordered and nondecreasing');
    if (service >= step.service) vestedFraction = step.fraction;
    lastService = step.service; lastFraction = step.fraction;
  }
  const vestedEmployer = employer * vestedFraction;
  return { modelVersion: FINANCE_MODEL_VERSION, vestedFraction, employeeOwned: employee,
    employerOwned: vestedEmployer, employerUnvested: employer - vestedEmployer,
    totalOwned: computed(employee + vestedEmployer, 'totalOwned') };
}

// One formula family, explicitly named; not a general pension entitlement calculator.
export function salaryServiceBenefit(input) {
  object(input, ['annualCompensation', 'creditedYears', 'annualAccrualRate', 'adjustmentFactor'], 'benefit');
  const compensation = money(input.annualCompensation, 'annualCompensation');
  const years = number(input.creditedYears, 'creditedYears', 0);
  const accrual = fraction(input.annualAccrualRate, 'annualAccrualRate');
  const adjustment = number(input.adjustmentFactor, 'adjustmentFactor', 0);
  const annual = computed(compensation * years * accrual * adjustment, 'annual benefit');
  return { modelVersion: FINANCE_MODEL_VERSION, formula: 'salary-times-service', annual, monthly: annual / 12 };
}

export function accountLedger(input) {
  object(input, ['openingBalance', 'cashflowTiming', 'periods'], 'account');
  const openingBalance = money(input.openingBalance, 'openingBalance');
  check(['start', 'end'].includes(input.cashflowTiming), 'cashflowTiming must be start or end');
  check(Array.isArray(input.periods) && input.periods.length > 0 && input.periods.length <= 1200,
    'periods must contain 1–1200 explicit return observations or assumptions');
  let balance = openingBalance;
  const labels = new Set();
  const totals = { employee: 0, employer: 0, gain: 0, fees: 0, unpaidFees: 0, withdrawn: 0, shortfall: 0 };
  const rows = input.periods.map((p, i) => {
    object(p, ['label', 'employee', 'employer', 'withdrawal', 'returnRate', 'feeRate', 'feeAmount'], `periods[${i}]`);
    check(typeof p.label === 'string' && p.label.trim().length > 0 && p.label.length <= 80,
      `periods[${i}].label must be nonempty text up to 80 characters`);
    check(!labels.has(p.label), 'period labels must be unique'); labels.add(p.label);
    const employee = money(p.employee === undefined ? 0 : p.employee, 'employee');
    const employer = money(p.employer === undefined ? 0 : p.employer, 'employer');
    const requestedWithdrawal = money(p.withdrawal === undefined ? 0 : p.withdrawal, 'withdrawal');
    const rate = number(p.returnRate, 'returnRate', -1);
    const feeRate = fraction(p.feeRate === undefined ? 0 : p.feeRate, 'feeRate');
    const feeAmount = money(p.feeAmount === undefined ? 0 : p.feeAmount, 'feeAmount');
    const opening = balance;
    let withdrawn = 0;
    const cashflow = () => {
      balance = computed(balance + employee + employer, 'balance after contributions');
      withdrawn = Math.min(requestedWithdrawal, balance);
      balance -= withdrawn;
    };
    if (input.cashflowTiming === 'start') cashflow();
    const gain = computed(balance * rate, 'period gain');
    balance = computed(balance + gain, 'balance after return');
    const assessedFees = computed(balance * feeRate + feeAmount, 'assessed fees');
    const fees = Math.min(balance, assessedFees);
    balance -= fees;
    if (input.cashflowTiming === 'end') cashflow();
    const row = { label: p.label, opening, employee, employer, returnRate: rate, gain,
      feeRate, feeAmount, assessedFees, fees, unpaidFees: assessedFees - fees, requestedWithdrawal, withdrawn,
      shortfall: requestedWithdrawal - withdrawn, closing: balance };
    for (const key of Object.keys(totals)) totals[key] = computed(totals[key] + row[key], `total ${key}`);
    return row;
  });
  return { modelVersion: FINANCE_MODEL_VERSION, openingBalance, cashflowTiming: input.cashflowTiming,
    feeTiming: 'after return, before end-of-period cashflows', rows, totals, closingBalance: balance };
}

export function feeComparison(input) {
  object(input, ['account', 'baselineFeeRate', 'comparisonFeeRate'], 'feeComparison');
  fraction(input.baselineFeeRate, 'baselineFeeRate'); fraction(input.comparisonFeeRate, 'comparisonFeeRate');
  // Validate before replacing rates so a malformed source period cannot be hidden.
  accountLedger(input.account);
  check(input.account.periods.every(p => p.feeRate == null && p.feeAmount == null),
    'feeComparison requires periods without pre-existing fee fields');
  const run = feeRate => accountLedger({ ...input.account, periods: input.account.periods.map(p => ({ ...p, feeRate })) });
  const baseline = run(input.baselineFeeRate), comparison = run(input.comparisonFeeRate);
  return { modelVersion: FINANCE_MODEL_VERSION, baseline, comparison,
    endingBalanceDifference: baseline.closingBalance - comparison.closingBalance,
    chargedFeeDifference: comparison.totals.fees - baseline.totals.fees,
    gainDifference: baseline.totals.gain - comparison.totals.gain,
    fundedWithdrawalDifference: baseline.totals.withdrawn - comparison.totals.withdrawn };
}

export function purchasingPower(nominalAmount, priceIndex, baseIndex) {
  money(nominalAmount, 'nominalAmount');
  number(priceIndex, 'priceIndex', Number.MIN_VALUE);
  number(baseIndex, 'baseIndex', Number.MIN_VALUE);
  return computed(nominalAmount * (baseIndex / priceIndex), 'purchasingPower');
}
