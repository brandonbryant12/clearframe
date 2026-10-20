import { type PlotMotion } from '../../plot-data.mjs';

export type BarsSpecInput = Omit<
  BarsSpec,
  'orientation' | 'colors' | 'decimals' | 'prefix' | 'suffix'
> &
  Partial<
    Pick<BarsSpec, 'orientation' | 'colors' | 'decimals' | 'prefix' | 'suffix'>
  >;

export interface BarValue {
  label: string;
  value: number;
  highlight?: boolean;
}

export interface BarsSpec {
  title: string;
  unit: string;
  values: BarValue[];
  domain: number[];
  ticks: number[];
  decimals: number;
  prefix: string;
  suffix: string;
  orientation: string;
  reference?: { value: number; label: string };
  colors: string;
  asOf: string;
  source: string;
  motion: PlotMotion | 'none';
}
