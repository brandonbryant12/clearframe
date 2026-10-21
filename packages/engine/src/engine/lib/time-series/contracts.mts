export const TIME_SERIES_VERSION = 1;

export const MONTHS = { monthly: 1, quarterly: 3, annual: 12 } as const;

export type Frequency = keyof typeof MONTHS;

export interface SeriesBasis {
  modelVersion: number;
  frequency: Frequency;
  interpolation: 'none';
}

export interface ValueObservation {
  date: string;
  value: number | null;
}

export interface PriceObservation {
  date: string;
  nominal: number | null;
  priceIndex: number | null;
}

export interface DeflatedObservation extends PriceObservation {
  priceRatio: number | null;
  real: number | null;
  gap: number | null;
  missing: 'nominal' | 'price-index' | null;
}

export interface Deflation {
  modelVersion: number;
  method: 'matched-date-price-ratio';
  baseDate: string;
  basePriceIndex: number;
  observations: DeflatedObservation[];
}

export type GrowthGap =
  | 'warmup'
  | 'missing-endpoint'
  | 'nonpositive-base'
  | 'negative-ending-level';

export interface GrowthObservation extends ValueObservation {
  baseDate: string | null;
  change: number | null;
  annualized: number | null;
  missing: GrowthGap | null;
  changeInGrowth: number | null;
}

export interface Growth extends SeriesBasis {
  method: 'lagged-relative-endpoints';
  lag: number;
  annualize: boolean;
  periodsPerYear: number;
  changeInGrowthUnit: string;
  observations: GrowthObservation[];
}

export interface RollingObservation extends ValueObservation {
  windowStart: string;
  count: number;
  complete: boolean;
  missing: 'warmup' | 'missing-window-value' | null;
  mean: number | null;
  standardDeviation: number | null;
}

export interface Rolling extends SeriesBasis {
  method: 'complete-window-sample-statistics';
  window: number;
  ddof: 1;
  annualized: false;
  observations: RollingObservation[];
}

export interface DrawdownObservation extends ValueObservation {
  observedPeak: number | null;
  peakDate: string | null;
  drawdown: number | null;
  missing: 'missing-level' | 'no-positive-peak' | null;
}

export interface OpenEpisode {
  peakDate: string;
  peakValue: number;
  troughDate: string;
  troughValue: number;
  drawdown: number;
}

export interface DrawdownEpisode extends OpenEpisode {
  recoveryDate: string | null;
  recovered: boolean;
  calendarDays: number;
}

export interface Drawdown extends SeriesBasis {
  method: 'observed-running-peak';
  equalPeakRule: 'most-recent-observation';
  missingPolicy: string;
  missingDates: string[];
  maxDrawdown: number;
  currentDrawdown: number | null;
  episodes: DrawdownEpisode[];
  observations: DrawdownObservation[];
}
