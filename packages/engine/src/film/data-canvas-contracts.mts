import type { ChartFormat } from './types.mjs';
import type { chartContext } from './data-canvas-context.mjs';
export interface ChartValue {
  label: string;
  value: number;
  say?: string;
  highlight?: boolean;
  id?: string;
}
export interface ChartNote {
  text: string;
  to?: string;
  say?: string;
  at?: number;
}
/** A `chart` on a canvas: bars, a stacked bar, or one number over its bar. */
export interface ChartSpec extends ChartFormat {
  kind: 'bars' | 'stack' | 'number';
  values: ChartValue[];
  box?: number[];
  max?: number;
  id?: string;
  at?: number;
  stagger?: number;
  note?: ChartNote;
}
/** A value with the stable id its shape carries. */
export interface KeyedValue extends ChartValue {
  key: string;
}

export type ChartContext = ReturnType<typeof chartContext>;
