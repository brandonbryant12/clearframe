import { FINANCE_MODEL_VERSION } from './contracts.mjs';
import type {
  MatchResult,
  MatchTier,
  VestingResult,
  BenefitResult,
} from './contracts.mjs';
import {
  object,
  money,
  check,
  entries,
  fraction,
  number,
  computed,
} from './inputs.mjs';

/** `{compensation, employeeContribution, tiers: [{through, rate}]}`: the employer match, tier by tier. */
export function matchingContribution(input: unknown): MatchResult {
  object(input, ['compensation', 'employeeContribution', 'tiers'], 'match');
  const compensation = money(input.compensation, 'compensation');
  const contribution = money(
    input.employeeContribution,
    'employeeContribution',
  );
  check(
    contribution <= compensation,
    'employeeContribution exceeds compensation',
  );
  const rawTiers = entries(
    input.tiers,
    20,
    'tiers must contain 1–20 cumulative compensation thresholds',
  );
  let previous = 0;
  const tiers = rawTiers.map((tier, i): MatchTier => {
    object(tier, ['through', 'rate'], `tiers[${i}]`);
    const through = fraction(tier.through, `tiers[${i}].through`);
    check(through > previous, 'tier thresholds must strictly increase');
    const rate = number(tier.rate, `tiers[${i}].rate`, 0);
    const eligible = Math.max(
      0,
      Math.min(contribution, compensation * through) - compensation * previous,
    );
    const matched = computed(eligible * rate, `tiers[${i}].matched`);
    const result = { from: previous, through, rate, eligible, matched };
    previous = through;
    return result;
  });
  return {
    modelVersion: FINANCE_MODEL_VERSION,
    tiers,
    employerContribution: computed(
      tiers.reduce((sum, t) => sum + t.matched, 0),
      'employerContribution',
    ),
    aboveMatchThreshold: Math.max(0, contribution - compensation * previous),
  };
}

/** `{employeeBalance, employerBalance, creditedService, schedule: [{service, fraction}]}`: what is owned. */
export function vestedBalance(input: unknown): VestingResult {
  object(
    input,
    ['employeeBalance', 'employerBalance', 'creditedService', 'schedule'],
    'vesting',
  );
  const employee = money(input.employeeBalance, 'employeeBalance');
  const employer = money(input.employerBalance, 'employerBalance');
  const service = number(input.creditedService, 'creditedService', 0);
  const schedule = entries(
    input.schedule,
    100,
    'schedule must contain 1–100 steps beginning at service 0',
  );
  let lastService = -1,
    lastFraction = -1,
    vestedFraction = 0;
  for (const [i, step] of schedule.entries()) {
    object(step, ['service', 'fraction'], `schedule[${i}]`);
    const stepService = number(step.service, `schedule[${i}].service`, 0);
    const stepFraction = fraction(step.fraction, `schedule[${i}].fraction`);
    check(i !== 0 || stepService === 0, 'schedule must start at service 0');
    check(
      stepService > lastService && stepFraction >= lastFraction,
      'schedule must be ordered and nondecreasing',
    );
    if (service >= stepService) vestedFraction = stepFraction;
    lastService = stepService;
    lastFraction = stepFraction;
  }
  const vestedEmployer = employer * vestedFraction;
  return {
    modelVersion: FINANCE_MODEL_VERSION,
    vestedFraction,
    employeeOwned: employee,
    employerOwned: vestedEmployer,
    employerUnvested: employer - vestedEmployer,
    totalOwned: computed(employee + vestedEmployer, 'totalOwned'),
  };
}

// One formula family, explicitly named; not a general pension entitlement calculator.
export function salaryServiceBenefit(input: unknown): BenefitResult {
  object(
    input,
    [
      'annualCompensation',
      'creditedYears',
      'annualAccrualRate',
      'adjustmentFactor',
    ],
    'benefit',
  );
  const compensation = money(input.annualCompensation, 'annualCompensation');
  const years = number(input.creditedYears, 'creditedYears', 0);
  const accrual = fraction(input.annualAccrualRate, 'annualAccrualRate');
  const adjustment = number(input.adjustmentFactor, 'adjustmentFactor', 0);
  const annual = computed(
    compensation * years * accrual * adjustment,
    'annual benefit',
  );
  return {
    modelVersion: FINANCE_MODEL_VERSION,
    formula: 'salary-times-service',
    annual,
    monthly: annual / 12,
  };
}
