import type { PlotSpec, AxisValue } from '../plot-data.mjs';
export interface CorrelationInput {
  plot: PlotSpec;
  method: 'pearson';
  frequency: 'monthly';
  returnType: 'simple-percent';
  window: { start: string; end: string };
  minObservations: number;
}
export interface CorrelationCell {
  row: number;
  column: number;
  rowId: string;
  columnId: string;
  n: number;
  value: number | null;
  reason: 'insufficient-pairs' | 'zero-variance' | null;
  dates: AxisValue[];
  missingDates: AxisValue[];
}
