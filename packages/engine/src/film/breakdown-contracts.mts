import type {
  Timed,
  HelperFrame,
  CanvasElement,
  ElementFields,
} from './types.mjs';
import type { plotLayout } from './plots.mjs';
export interface BreakdownTotal {
  label: string;
  value: number;
}
export interface BreakdownPartInput extends BreakdownTotal, Timed {
  id?: string;
  highlight?: boolean;
  parts?: BreakdownPartInput[];
  residual?: true | string;
}
export interface BreakdownPart extends Omit<
  BreakdownPartInput,
  'id' | 'parts'
> {
  id: string;
  parts?: BreakdownPart[];
  remainder?: boolean;
}
export interface BreakdownOpen extends Timed {
  part: string;
}
export interface BreakdownInput {
  id?: string;
  title: string;
  unit: string;
  asOf: string;
  source?: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  total: BreakdownTotal;
  parts: BreakdownPartInput[];
  residual?: true | string;
  focus?: string;
  open?: BreakdownOpen;
  gather?: string;
  motion?: string;
}
export interface BreakdownSpec extends Omit<
  BreakdownInput,
  'id' | 'decimals' | 'prefix' | 'suffix' | 'source' | 'parts'
> {
  id: string;
  decimals: number;
  prefix: string;
  suffix: string;
  source: string;
  parts: BreakdownPart[];
  format: (value: number) => string;
}
export interface BreakdownLayout {
  L: ReturnType<typeof plotLayout>;
  W: number;
  H: number;
  beside: boolean;
  rows: number;
  top: number;
  slot: number;
  font: number;
  left: number;
  right: number;
  labelW: number;
  thickness: number;
  shift: number;
  room: number;
  lines: (label: string) => number;
}
export type BreakdownKind = 'header' | 'total' | 'residual' | 'part';
export interface BreakdownRow {
  key: string[];
  kind: BreakdownKind;
  cy: number;
  amount: number;
  bar: { x: number; y: number; w: number; h: number };
  marker: CanvasElement | null;
  label: CanvasElement & { x: number; y: number };
  value: CanvasElement & { x: number; y: number };
  item?: BreakdownPart;
  fill?: string;
}
export type BreakdownElement = CanvasElement & { id: string };
export type BreakdownBar = BreakdownElement & {
  x: number;
  y: number;
  w: number;
  h: number;
};
export type BreakdownWhen = (item: Timed, fallback: number) => number;
export type BreakdownArrival = (
  item: Timed,
  fallback: number,
  extra?: ElementFields,
) => ElementFields;
export interface BreakdownDrawTimes {
  header: ElementFields;
  partTime: (row: BreakdownRow, i: number) => ElementFields;
  labelTime: (row: BreakdownRow, i: number) => ElementFields;
}
export interface BreakdownScene {
  p: BreakdownSpec;
  G: BreakdownLayout;
  frame: HelperFrame;
  when: BreakdownWhen;
  arrive: BreakdownArrival;
  title: CanvasElement;
  unit: CanvasElement;
}
