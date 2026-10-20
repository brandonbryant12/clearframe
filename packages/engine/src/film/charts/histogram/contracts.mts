import {
  type DistributionModel,
  type Relation,
} from '../../distribution-data.mjs';

import type { PlotMotion } from '../../plot-data.mjs';

export type HistogramSpecInput = Omit<
  HistogramSpec,
  'prefix' | 'suffix' | 'decimals' | 'tone'
> &
  Partial<Pick<HistogramSpec, 'prefix' | 'suffix' | 'decimals' | 'tone'>>;

export interface HistogramSpec {
  title: string;
  unit: string;
  observations: Array<number | null>;
  edges: number[];
  threshold: { value: number; relation: Relation; label: string };
  marker?: { value: number; label: string };
  prefix: string;
  suffix: string;
  decimals: number;
  tone: string;
  asOf: string;
  source?: string;
  motion: PlotMotion | 'none';
  /** The counted bins and threshold (distribution-data.mjs). */
  model: DistributionModel;
}
