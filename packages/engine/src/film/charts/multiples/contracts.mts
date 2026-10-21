import {
  type Axis,
  type PlotMotion,
  type PlotSeries,
  type PlotSpec,
} from '../../plot-data.mjs';

export interface MultiplesSpec {
  title: string;
  unit: string;
  x: Axis;
  y: Axis;
  series: PlotSeries[];
  highlight?: string;
  asOf: string;
  source?: string;
  motion: PlotMotion | 'none';
  /** Each series checked as a one-series plot on the shared axes. */
  panels: PlotSpec[];
}
