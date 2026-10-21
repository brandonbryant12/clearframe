import type { Timed } from '../../../film/contracts/primitives.mjs';

export interface Rectangle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CueTiming extends Timed {
  at: number;
  cue: string;
}

export type ComposeMoments = {
  OLD: number;
  NEW: number;
  LINK: number;
  EXPIRES?: number;
  SEND?: number;
};

export type WeekMoments = {
  TODAY: number;
  DUE: number;
  ONE?: number;
  TWO?: number;
  THREE?: number;
  FOUR?: number;
  AFTER?: number;
};

export type DrawdownMoments = {
  OPEN: number;
  FALL: number;
  LOW: number;
  ACT?: number;
  RECOVER?: number;
};

export function required<T>(value: T | null | undefined, label: string): T {
  if (value == null) throw new Error(`Missing ${label} in sketch layout.`);
  return value;
}
