export const EXPECTATIONS_VERSION = 1;

export interface DatedValue {
  date: string;
  value: number | null;
}

export interface TargetValue {
  targetDate: string;
  value: number | null;
}

export interface Vintage {
  id: string;
  issuedAt: string;
  values: TargetValue[];
}

export interface Release {
  targetDate: string;
  releasedAt: string;
  value: number | null;
}

export interface Actual {
  targetDate: string;
  value: number | null;
  releasedAt: string | null;
  state: 'not-released' | 'withdrawn' | 'released';
  revisionCount: number;
}

export interface VintageSnapshot {
  modelVersion: number;
  asOf: string;
  method: 'latest-available-release-per-observation';
  vintages: Vintage[];
  actuals: Actual[];
}

export const CURVE_KINDS = ['par', 'spot', 'quoted'] as const;

export type CurveKind = (typeof CURVE_KINDS)[number];

export interface Tenor {
  months: number;
  years: number;
  label: string;
}

export interface CurveSnapshot {
  date: string;
  values: (Tenor & { value: number | null })[];
}

export interface MaturityCurves {
  modelVersion: number;
  kind: CurveKind;
  unit: 'percent-per-year';
  xMeaning: string;
  interpolation: 'none';
  tenors: Tenor[];
  snapshots: CurveSnapshot[];
}

/** A band over scenarios: their full range, or empirical quantiles between `lower` and `upper`. */
export type BandSpec =
  | { kind: 'range' }
  | { kind: 'quantile'; lower: number; upper: number };

export type Band = BandSpec & {
  method: 'supplied-scenario-min-max' | 'equal-weight-empirical-type-7';
};

export interface Scenario {
  id: string;
  label: string;
  values: DatedValue[];
  weight: number;
}

export interface EnvelopeObservation {
  date: string;
  count: number;
  complete: boolean;
  lower: number | null;
  upper: number | null;
  median: number | null;
  missing: 'incomplete-scenario-set' | null;
}

export interface ScenarioEnvelope {
  modelVersion: number;
  origin: DatedValue;
  history: DatedValue[];
  scenarios: Scenario[];
  band: Band;
  observations: EnvelopeObservation[];
  weighting: string;
  interpretation: string;
  missingPolicy: string;
}
