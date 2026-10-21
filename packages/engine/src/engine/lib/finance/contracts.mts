export const FINANCE_MODEL_VERSION = 1;

export interface MatchTier {
  from: number;
  through: number;
  rate: number;
  eligible: number;
  matched: number;
}

export interface MatchResult {
  modelVersion: number;
  tiers: MatchTier[];
  employerContribution: number;
  aboveMatchThreshold: number;
}

export interface VestingResult {
  modelVersion: number;
  vestedFraction: number;
  employeeOwned: number;
  employerOwned: number;
  employerUnvested: number;
  totalOwned: number;
}

export interface BenefitResult {
  modelVersion: number;
  formula: 'salary-times-service';
  annual: number;
  monthly: number;
}

export type CashflowTiming = 'start' | 'end';

export interface LedgerRow {
  label: string;
  opening: number;
  employee: number;
  employer: number;
  returnRate: number;
  gain: number;
  feeRate: number;
  feeAmount: number;
  assessedFees: number;
  fees: number;
  unpaidFees: number;
  requestedWithdrawal: number;
  withdrawn: number;
  shortfall: number;
  closing: number;
}

export const TOTAL_KEYS = [
  'employee',
  'employer',
  'gain',
  'fees',
  'unpaidFees',
  'withdrawn',
  'shortfall',
] as const;

export type LedgerTotals = Record<(typeof TOTAL_KEYS)[number], number>;

export interface LedgerResult {
  modelVersion: number;
  openingBalance: number;
  cashflowTiming: CashflowTiming;
  feeTiming: string;
  rows: LedgerRow[];
  totals: LedgerTotals;
  closingBalance: number;
}

export interface FeeComparisonResult {
  modelVersion: number;
  baseline: LedgerResult;
  comparison: LedgerResult;
  endingBalanceDifference: number;
  chargedFeeDifference: number;
  gainDifference: number;
  fundedWithdrawalDifference: number;
}
