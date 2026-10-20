import type {
  CanvasElement,
  ElementFields,
  HelperFrame,
  Timed,
} from './types.mjs';
import type { plotLayout } from './plots.mjs';
export interface ProcessStage {
  id: string;
  label: string;
  capacity: number;
}
export interface ProcessRun extends Timed {
  periods: number;
  dur: number;
  set?: Record<string, number>;
}
export interface ProcessInput {
  id?: string;
  title: string;
  unit?: string;
  period?: string;
  arrivals: number;
  stages: ProcessStage[];
  start?: Record<string, number>;
  runs: ProcessRun[];
  token?: number;
  done?: string;
  source?: string;
  asOf?: string;
}
export interface ProcessSpec extends ProcessInput {
  id: string;
  unit: string;
  period: string;
  token: number;
  done: string;
  source: string;
}
export interface ProcessState {
  period: number;
  queues: number[];
  done: number;
  caps: number[];
  moved: number[];
  run: number;
}
export type ProcessWhen = (r: ProcessRun, fallback: number) => number;
export interface ProcessRunTime {
  start: number;
  step: number;
}
export interface ProcessDrawing {
  p: ProcessSpec;
  frame: HelperFrame;
  W: number;
  H: number;
  L: ReturnType<typeof plotLayout>;
  wide: boolean;
  shift: number;
  states: ProcessState[];
  n: number;
  out: CanvasElement[];
  runs: ProcessRunTime[];
  time: number[];
  clock: number;
  font: number;
  top: number;
  bottom: number;
  maxTokens: number;
  cols: number;
  tokenSize: number;
  gap: number;
  rowsOfTokens: number;
  timed: (id: string) => string;
}
export type Scheduled = (
  id: string,
  values: string[],
  times: number[],
  place: ElementFields,
  style?: ElementFields,
) => void;
export type Stepped = (
  id: string,
  values: string[],
  place: ElementFields,
  style: ElementFields,
) => void;
export type Capacity = (
  i: number,
  place: ElementFields,
  style: ElementFields,
) => void;
export type Pile = (
  cx: number,
  baseY: number,
  i: number,
  dir: 'up' | 'right',
) => void;
export interface ProcessScene extends ProcessDrawing {
  stepped: Stepped;
  capacity: Capacity;
  pile: Pile;
  trend: (i: number) => string[];
}
