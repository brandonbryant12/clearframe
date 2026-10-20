import type { Timed, Point } from './primitives.mjs';
import type { CanvasElement } from './canvas.mjs';

// ------------------------------------------------------------------ canvas elements

export type ElementType =
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'path'
  | 'poly'
  | 'text'
  | 'icon'
  | 'document'
  | 'receipt'
  | 'app'
  | 'crumbs'
  | 'pointer'
  | 'image'
  | 'group'
  | 'meter'
  | 'spotlight'
  | 'particles'
  | 'solid';

export interface GradientPaint {
  gradient: string[];
  angle?: number;
  radial?: boolean;
  fade?: boolean;
}

/** A palette token, #rrggbb, or a gradient. */
export type Paint = string | GradientPaint;

export interface ShadowSpec {
  blur?: number;
  opacity?: number;
  dx?: number;
  dy?: number;
  color?: string;
}

/** A built-in effect by name, or `{name, volume}`. */
export type SoundRef = string | { name: string; volume?: number };

export interface ElementKey extends Timed {
  ease?: string;
  x?: number;
  y?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: number;
  opacity?: number;
  blur?: number;
  hold?: boolean;
  tiltX?: number;
  tiltY?: number;
  sound?: SoundRef;
}

export interface LoopSpec {
  type: string;
  period?: number;
  amount?: number;
}

export interface AlongSpec extends Timed {
  d: string;
  ease?: string;
  rotate?: boolean;
  loop?: boolean;
}

export interface EchoSpec {
  count?: number;
  lag?: number;
  step?: Partial<Record<'x' | 'y' | 'rotate' | 'scale', number>>;
  fade?: number;
  to?: string;
}

export interface CountSpec {
  from?: number;
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  dur?: number;
}

/** Emphasis drawn on a text element's own words (or a document section's). */
export interface TextMark extends Timed {
  words?: string;
  style?: string;
  color?: string;
  width?: number;
  pad?: number;
  rough?: boolean;
  label?: string;
  size?: number;
  rotate?: number;
  fill?: string;
  sound?: SoundRef | false;
  /** A document mark may name its section by index. */
  section?: number;
}

/** A globe's [lat, lon] coordinate pair has no text-mark timing fields. */
export type GlobeMark = number[];

export type ElementMark = TextMark | GlobeMark;

export interface DocumentSection {
  heading?: string;
  text: string;
}

export interface ScrollMove extends Timed {
  to: number | string;
}

export interface MorphFrom {
  id: string;
  slice: [number, number];
  axis?: 'x' | 'y';
}

/** A morph across the cut: the element starts as `from` (a still copy) and moves to itself. */
export interface Morph {
  from: CanvasElement;
  dur: number;
}

export interface RoughSpec {
  amount?: number;
  passes?: number;
  boil?: number;
  fill?: string;
  gap?: number;
  angle?: number;
  hatchWidth?: number;
}

export interface RecolorFront {
  say?: string;
  at?: number;
  dur?: number;
  fill?: Paint;
  axis?: number;
  share?: number;
}

export interface MosaicSpec {
  tile?: number;
  gap?: number;
  jitter?: number;
  flow?: string;
  outline?: boolean;
  build?: string;
  from?: Point;
  spread?: number;
  shade?: number;
  shine?: number;
  glint?: number;
  grout?: string;
  axis?: number;
  seed?: number;
  recolor?: RecolorFront[];
  halo?: number;
  knockout?: boolean;
  style?: string;
}

export interface PrintSettings {
  screen?: string;
  cell?: number;
  angle?: number;
  tone?: number | [number, number];
  axis?: number;
  register?: [number, number];
  wear?: number;
  ink?: string;
}

/** A print preset name or its settings. */
export type PrintSpec = string | PrintSettings;

export interface MaterialSettings {
  map?: string | string[];
  depth?: number;
  soften?: number;
  flow?: number;
  stripe?: number;
  angle?: number;
  grain?: number;
  gain?: number;
}

export type MaterialSpec = string | MaterialSettings;

export interface ShineSpec extends Timed {
  color?: string;
  width?: number;
  angle?: number;
  opacity?: number;
  every?: number;
}

export interface ShadeSpec {
  light?: [number, number, number];
  ambient?: number;
  edges?: boolean;
}

export interface PointerStep {
  to?: string | Point;
  say?: string;
  at?: number;
  press?: boolean;
  point?: Point;
}
