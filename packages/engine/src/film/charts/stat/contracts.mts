import { type PlotMotion } from '../../plot-data.mjs';

export type StatSpecInput = Omit<StatSpec, 'decimals' | 'count'> &
  Partial<Pick<StatSpec, 'decimals' | 'count'>>;

export interface StatChange {
  value: number;
  decimals: number;
  suffix: string;
  context: string;
  good: string;
}

export interface StatSpec {
  kicker?: string;
  value: number;
  decimals: number;
  prefix: string;
  suffix: string;
  label: string;
  change?: StatChange;
  asOf: string;
  source: string;
  motion: PlotMotion | 'none';
  count: boolean;
}
