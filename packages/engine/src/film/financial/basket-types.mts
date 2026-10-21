export interface Currency {
  unit: string;
  decimals: number;
}
export interface BasketItem {
  id: string;
  label: string;
  unit: string;
  quantity: number;
}
export interface BasketInputPeriod {
  date: string;
  pricesMinor: Record<string, number | null>;
}
export interface BasketInput {
  title: string;
  source: string;
  asOf: string;
  baseDate: string;
  currency: Currency;
  budgetMinor: number;
  substitutionPolicy: 'none';
  priceBasis: string;
  qualification: string;
  items: BasketItem[];
  periods: BasketInputPeriod[];
}
export interface BasketRow extends BasketItem {
  unitPriceMinor: number | null;
  lineCostMinor: number | null;
}
export interface PricedBasketRow extends BasketRow {
  unitPriceMinor: number;
  lineCostMinor: number;
}
export interface CostWeight {
  numerator: number;
  denominator: number;
}
export interface BasketRowComparison {
  baseCostWeight: CostWeight;
  unitChangeMinor: number | null;
  lineChangeMinor: number | null;
}
export interface PeriodBase {
  date: string;
  missingItemIds: string[];
  coveredItems: number;
  knownSubtotalMinor: number;
}
export interface CompletePeriod extends PeriodBase {
  complete: true;
  rows: PricedBasketRow[];
  costMinor: number;
  wholeBaskets: number;
  spentMinor: number;
  remainderMinor: number;
}
export interface IncompletePeriod extends PeriodBase {
  complete: false;
  rows: BasketRow[];
  costMinor: null;
  wholeBaskets: null;
  spentMinor: null;
  remainderMinor: null;
}
export type BasketPeriod = CompletePeriod | IncompletePeriod;
