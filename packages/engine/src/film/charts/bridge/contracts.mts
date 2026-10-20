import { type PlotMotion } from '../../plot-data.mjs';

export type BridgeSpecInput = Omit<
  BridgeSpec,
  'orientation' | 'good' | 'decimals' | 'prefix' | 'suffix'
> &
  Partial<
    Pick<BridgeSpec, 'orientation' | 'good' | 'decimals' | 'prefix' | 'suffix'>
  >;

export interface BridgeTotal {
  label: string;
  value: number;
  say?: string;
}

/** A driver (value) or a subtotal (total: true, value filled in from the running total). */
export interface BridgeStep {
  label: string;
  value: number;
  total?: true;
  say?: string;
}

export interface BridgeSpec {
  title: string;
  unit: string;
  start: BridgeTotal;
  steps: BridgeStep[];
  end: BridgeTotal;
  domain: number[];
  ticks: number[];
  decimals: number;
  prefix: string;
  suffix: string;
  good: string;
  orientation: string;
  asOf: string;
  source: string;
  motion: PlotMotion | 'none';
}

/** One column in reading order: the level it starts from and the level it reaches. */
export interface BridgeColumn {
  kind: 'start' | 'subtotal' | 'step' | 'end';
  label: string;
  from: number;
  to: number;
  value: number;
  say?: string;
}
