import type { Timed, Point } from './primitives.mjs';
import type {
  ElementType,
  Paint,
  SoundRef,
  ElementKey,
  LoopSpec,
  AlongSpec,
  EchoSpec,
  MorphFrom,
  Morph,
  RoughSpec,
  MosaicSpec,
  PrintSpec,
  ShineSpec,
  ShadowSpec,
  MaterialSpec,
  CountSpec,
  ElementMark,
  DocumentSection,
  ScrollMove,
  ShadeSpec,
  PointerStep,
} from './canvas-effects.mjs';

/**
 * One element of the canvas dialect (canvas beats, art layers, stage under/over). Geometry
 * fields depend on `type` (ELEMENT_TYPES in canvas.mjs lists them); timing and style fields are
 * shared. Fields marked internal are written by the film pipeline, never authored.
 */
export interface CanvasElement extends Timed {
  type: ElementType;
  id?: string;
  /** An author's note, or (internal, data-canvas.mjs) a chart annotation marker. */
  note?: string | boolean;
  fill?: Paint;
  stroke?: Paint;
  width?: number;
  opacity?: number;
  dash?: number[];
  cap?: string;
  join?: string;
  rotate?: number;
  scale?: number;
  origin?: Point;
  blend?: string;
  enter?: string;
  drawEase?: string;
  dist?: number;
  exit?: string;
  exitAt?: number;
  exitSay?: string;
  exitAfter?: number;
  exitCue?: string;
  exitDur?: number;
  sound?: SoundRef | false;
  keys?: ElementKey[];
  loop?: LoopSpec;
  along?: AlongSpec;
  echo?: EchoSpec;
  fps?: number;
  morphDur?: number;
  morphFrom?: MorphFrom;
  morph?: Morph;
  /** Hand-drawn strokes; `false` opts out of a canvas-wide setting (null once validated). */
  rough?: RoughSpec | boolean | null;
  mosaic?: MosaicSpec | boolean;
  print?: PrintSpec | false;
  behind?: boolean;
  subject?: boolean;
  depth?: number;
  z?: number;
  blur?: number;
  shine?: ShineSpec | true;
  shadow?: boolean | ShadowSpec;
  glow?: boolean | ShadowSpec;
  /** [x, y] degrees for a plane; [x, y, z] for a solid. */
  tilt?: number[];
  material?: MaterialSpec;
  unfinished?: boolean | string;

  // Geometry.
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  r?: number;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  arrow?: string;
  head?: number;
  d?: string;
  points?: number[][];
  closed?: boolean;
  text?: string;
  size?: number;
  font?: string;
  anchor?: string;
  height?: number;
  leading?: number;
  tracking?: number;
  upper?: boolean;
  /** A counted figure on text; a particle count on particles. */
  count?: CountSpec | number;
  /** The widest a text line may be; cover or contain on an image. */
  fit?: number | string;
  marks?: ElementMark[];
  balance?: boolean;
  name?: string;
  title?: string;
  kicker?: string;
  sections?: DocumentSection[];
  scroll?: ScrollMove[];
  asset?: string;
  file?: string;
  treatment?: string;
  children?: CanvasElement[];
  stagger?: number;
  bars?: number;
  style?: string;
  step?: number;
  gap?: number;
  radius?: number;
  dim?: number;
  kind?: string;
  seed?: number;
  speed?: number;
  /** Native renderer wire field. */
  ['shape']?: string;
  spin?: number[];
  perspective?: number;
  nodes?: unknown;
  arcs?: number[][];
  shade?: boolean | ShadeSpec;
  to?: string | Point;
  steps?: PointerStep[];
  from?: Point;
  point?: Point;
  press?: boolean;
  leave?: boolean;

  // Internal.
  /** data-canvas.mjs: the value key a label belongs to. */
  of?: string;
  /** job.mjs linkWorlds: a group carrying an earlier world beat's drawing. */
  carried?: boolean;
  /** Seconds a carried group runs ahead of the beat's clock. */
  shift?: number;
  /** The view centre parallax layers were placed for. */
  depthRef?: Point;
}

/** A partial element: options merged into one a helper draws. */
export type ElementFields = Partial<CanvasElement>;

/** Extent of drawn elements at rest, in author units. */
export interface Extent {
  w: number;
  h: number;
  left: number;
  top: number;
  bottom: number;
}

/** Camera depth key for a canvas (`dolly`, `focus.keys`). */
export interface DepthKey {
  at?: number;
  say?: string;
  z?: number;
  dur?: number;
  ease?: string;
}

/** A camera rect addressed to what is drawn. */
export interface TargetInput {
  on: string | string[];
  pad?: number;
  state?: 'start' | 'end' | null;
}

/** A checked target: element ids, padding, the state to frame. */
export interface TargetSpec {
  ids: string[];
  pad: number;
  state: 'start' | 'end' | null;
  world?: string;
}

/** A canvas view: "auto", [width, height], a camera rect, or a target. */
export type ViewValue = 'auto' | number[] | TargetInput;

export interface RevealSpec extends Timed {
  from: string | string[];
  pad?: number;
  state?: 'start' | 'end';
}

/** The camera move from one world view to the next, set on the beat before. */
export interface ViewNext {
  to: ViewValue | undefined;
  at: number;
  dur: number;
}
