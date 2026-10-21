export type ValuationTerminal =
  | { kind: 'none'; periods: number }
  | { kind: 'growing-perpetuity' };
export interface ValuationScale {
  min: number;
  max: number;
  ticks: number[];
  decimals: number;
}
export interface ValuationInput {
  title: string;
  source: string;
  asOf: string;
  unit: string;
  cashFlowNow: number;
  initialOutlay: number;
  timing: 'annual-end';
  terminal: ValuationTerminal;
  growthRates: number[];
  discountRates: number[];
  rateDecimals: number;
  selected: { growth: number; discount: number };
  slice: 'growth' | 'discount';
  scale: ValuationScale;
}
export interface CashFlowTerm {
  year: number;
  cashFlow: number;
  presentValue: number;
}
export interface ValuationCell {
  row: number;
  column: number;
  growth: number;
  discount: number;
  valid: boolean;
  reason: 'discount-not-above-growth' | null;
  presentValue: number | null;
  initialOutlay: number;
  value: number | null;
  terms: CashFlowTerm[];
}
