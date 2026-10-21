import type { Cue, Paint, Count, ElementKey, SoundRef } from './motion.mjs';
import type { JsonObject } from './primitives.mjs';

/** Common element fields; named component specifications are validated by the native catalog. */
export interface Element extends Cue {
  id?: string;
  type: string;
  text?: string;
  x?: number;
  y?: number;
  z?: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
  upper?: boolean;
  fit?: number | string;
  tracking?: number;
  anchor?: string;
  size?: number;
  fps?: number;
  color?: string;
  fill?: Paint;
  stroke?: Paint;
  opacity?: number;
  scale?: number;
  rotate?: number;
  radius?: number;
  r?: number;
  dash?: number[];
  enter?: string;
  exit?: string;
  exitAt?: number;
  exitSay?: string;
  exitCue?: string;
  count?: Count | number;
  keys?: ElementKey[];
  loop?: ElementLoop;
  along?: ElementAlong;
  children?: Element[];
  source?: string;
  unfinished?: boolean | string;
  asset?: string;
  file?: string;
  font?: string;
  align?: string;
  weight?: number | string;
  sound?: SoundRef;
}

export interface Art {
  sketch?: string;
  seed?: number;
  opacity?: number;
  drift?: number;
  rough?: boolean | number | JsonObject;
  under?: Element[];
  over?: Element[];
}

export interface Plate {
  asset?: string;
  file?: string;
  side?: string;
  treatment?: string;
  drift?: string;
  scrim?: number;
  focus?: number[];
  offset?: number;
  loop?: boolean;
}

export interface ElementLoop {
  type: string;
  period?: number;
  amount?: number;
}
export interface ElementAlong extends Cue {
  d: string;
  ease?: string;
  rotate?: boolean;
  loop?: boolean;
}
