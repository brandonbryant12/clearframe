/** A position on an axis: a number, or a YYYY-MM-DD date on a date axis. */
export type AxisValue = number | string;

export interface Axis {
  type: 'linear' | 'date' | 'log';
  label: string;
  domain: AxisValue[];
  ticks: AxisValue[];
  decimals?: number;
  prefix?: string;
  suffix?: string;
  dateFormat?: string;
}

/** How an axis places and labels values (an axis, or an axis with its own domain or format). */
export interface AxisScale {
  type: string;
  domain: AxisValue[];
}

export interface AxisFormat {
  type: string;
  dateFormat?: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

export interface ObservedPoint {
  x: AxisValue;
  y: number;
}

/** A missing observation: null y leaves a gap. */
export interface MissingPoint {
  x: AxisValue;
  y: null;
}

export type PlotPoint = ObservedPoint | MissingPoint;

export interface PlotSeries {
  id: string;
  label: string;
  values: PlotPoint[];
}

/** The reveal clock: from `at`, over `duration` seconds. */
export interface PlotMotion {
  at: number;
  duration: number;
}

export interface PlotBand {
  from: AxisValue;
  to: AxisValue;
  label?: string;
}

export interface PlotAnnotation {
  seriesId: string;
  x: AxisValue;
  label: string;
  dx: number;
  dy: number;
}

export interface PlotSpec {
  title: string;
  x: Axis;
  y: Axis;
  series: PlotSeries[];
  asOf: string;
  source: string;
  motion: PlotMotion | 'none';
  annotation?: PlotAnnotation;
  bands?: PlotBand[];
  area?: boolean;
}
