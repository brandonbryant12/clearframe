import type { CanvasElement, Cue } from './types.mjs';
export interface ScheduleOptions {
  start: number;
  stagger?: number;
  entrance: number;
  resolve: (value: Cue) => number;
  limit?: number;
  still?: boolean;
  ground?: boolean;
}
export interface ElementSchedule {
  el: CanvasElement;
  resolve: (value: Cue) => number;
  at: number;
  dur: number;
  entrance: number;
  limit: number;
  enterWord?: string;
  settle: number;
}
