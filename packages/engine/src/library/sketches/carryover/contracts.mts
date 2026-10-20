import type {
  CanvasElement,
  ElementFields,
} from '../../../film/contracts/canvas.mjs';

import type { AT } from './timing.mjs';

export interface BuildOptions {
  seed?: number;
  text?: Record<string, string>;
  params?: {
    count?: number;
    stays?: number[];
    icons?: string[];
    bookend?: boolean;
  };
}

export interface CarryoverLayoutContext {
  T: boolean;
  w: number;
  h: number;
  count: number;
  icons: string[];
  words: Record<string, string>;
}

export interface DrawElectionCardsContext {
  count: number;
  y0: number;
  cardH: number;
  gap: number;
  stays: number[];
  icons: string[];
  bookend: boolean;
  on: CarryoverOn;
  across: number;
  mid: number;
  left: number;
  colW: number;
  els: CanvasElement[];
  still: { at: number; enter: string };
  above: boolean;
  text: (
    t: string,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra?: ElementFields,
  ) => CanvasElement;
  start: number;
  size: number;
  tick: DrawTick;
  right: number;
  chipW: number;
}

export type CarryoverCue = keyof typeof AT;
export interface CarryoverCueTiming {
  cue: CarryoverCue;
  at: number;
  after?: number;
}
export type CarryoverOn = (
  cue: CarryoverCue,
  delay: number,
) => CarryoverCueTiming;
export type TickTiming = (delay: number) => {
  cue: string;
  at: number;
  after?: number;
};
export type DrawTick = (y: number, when: TickTiming | null) => CanvasElement[];
