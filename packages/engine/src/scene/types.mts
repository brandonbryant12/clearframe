// Scene models: what stage recipes compile and the plan the renderer reads
// (scene/native/src/plan.rs decodes it). Types only.
//
// Authored stage specs arrive as unchecked JSON; scene/fields.mjs reads them field by field, with
// the same refusals the recipes always gave. Plan elements keep the canvas element dialect: the
// compiler names the fields it reads or writes, and passes every other field to the renderer.
import type { NativeJob } from '../film/types.mjs';

/** Frame pixels of the authored frame (the short side is 1080). */
export interface FrameSize {
  width: number;
  height: number;
}

/** Where a stage's actors and code may sit: title-safe, below the heading, above the source line. */
export interface StageArea {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Turns authored seconds or a spoken word into layer seconds; refuses a cue it cannot place. */
export type Cue = (value: unknown) => number;
/** A layer clock's cue, with the seconds an absent value takes. */
export type LayerCue = (value: unknown, fallback?: number) => number;

/** The exact git objects a code editor shows, recorded so a viewer reads the reviewed code. */
export interface CodeProvenance {
  kind: 'code';
  repo: string;
  file: string;
  commit: string;
  base: string;
  blobs: { before: string | null; after: string | null };
}
export type Staged = (record: CodeProvenance) => void;
export interface LayerProvenance extends CodeProvenance {
  layer: string;
}

/** One native element: a type, the fields the compiler names, and the rest for the renderer. */
export interface PlanElement {
  type: string;
  [field: string]: unknown;
}

/** A keyframe on a compiled element (`at` is layer seconds). */
export interface PlanKey {
  at: number;
  dur?: number;
  ease?: unknown;
  scale?: number;
  opacity?: number;
  x?: number;
  y?: number;
  stroke?: unknown;
  fill?: unknown;
}

/** An element whose keys a recipe writes (actors' groups, cards and status lights). */
export interface KeyedElement extends PlanElement {
  id: string;
  keys: PlanKey[];
}

/** An actor's group: the identity links attach to and events move. */
export interface ActorGroup extends KeyedElement {
  type: 'group';
  x: number;
  y: number;
  at: number;
  children: PlanElement[];
  exitAt?: number;
  exit?: unknown;
  exitDur?: unknown;
}

/** A connector or a label that leaves the stage when its actor does. */
export interface LeavingElement extends PlanElement {
  id: string;
  at: number;
  exitAt?: number;
  exit?: string;
  exitDur?: unknown;
}

export type SpanRole =
  | 'comment'
  | 'string'
  | 'number'
  | 'keyword'
  | 'type'
  | 'function'
  | 'plain'
  | 'punctuation';
/** A run of code in one colour role (authored spans may name any role the renderer draws). */
export interface CodeSpan {
  text: string;
  role: string;
}
/** One editor row; authored fields beyond these pass through to the renderer. */
export interface CodeLine {
  id: string;
  text?: string;
  spans?: CodeSpan[];
  indent?: number;
  number?: number;
  [field: string]: unknown;
}
/** What the editor shows from `at`: `show`, `add`, `remove` and `focus` name line ids. */
export interface CodeStep {
  at: number;
  [field: string]: unknown;
}
/** A code editor; `maxH` is the room below it while it is fitted, never in the plan. */
export interface CodeElement extends PlanElement {
  type: 'code';
  id: unknown;
  x: number;
  y: number;
  w: number;
  h?: number;
  maxH?: number;
  size: number;
  gutter: unknown;
  enter: unknown;
  at: unknown;
  dur: unknown;
  leading?: number;
  lines: CodeLine[];
  steps: CodeStep[];
  title: unknown;
}

/** A compiled camera: authored fields pass through; its `keys` are CameraKeys in time order. */
export type PlanCamera = Record<string, unknown>;
export interface CameraKey {
  at: number;
  [field: string]: unknown;
}

/** A compiled stage: its elements (authored ones still to be checked by the plan compiler). */
export interface CompiledStage {
  elements: unknown[];
  camera: PlanCamera | null;
}

export type Depth = 'under' | 'over';

export interface PlanLayer {
  id: string;
  start: number;
  frames: number;
  beat?: string;
  z: unknown;
  /** Seconds of fade at the layer's start and end. */
  fade: [number, number];
  camera?: PlanCamera;
  shutter: number;
  samples: number;
  motion: unknown;
  elements: PlanElement[];
}

/** Footage shown by a native layer: which file, from where, for how long. */
export interface Footage {
  beat: string;
  index: number;
  source: string;
  offset: number;
  seconds: number;
}

/** A word of narration with its measured start (film seconds). */
export interface PlanWord {
  w: string;
  t0: number;
}
/** A beat on the timeline, as the plan compiler reads it. */
export interface PlanTimingBeat {
  id: string;
  block?: string | null;
  start: number;
  end: number;
  dur: number;
  vo?: { words: readonly PlanWord[] };
}
export interface PlanTiming {
  width: number;
  height: number;
  beats: readonly PlanTimingBeat[];
}
/** An authored beat: its heading props and its own native layers (`stage`: one or a list). */
export interface PlanSourceBeat {
  id: string;
  props?: { title?: unknown; kicker?: unknown };
  stage?: unknown;
}
export interface PlanStoryboard {
  beats: readonly PlanSourceBeat[];
  stages?: readonly unknown[];
}
export interface AssetRef {
  file?: string;
  asset?: string;
}
export interface PlanContext {
  root: string;
  sb: PlanStoryboard;
  timing: PlanTiming;
  job: NativeJob;
  /** Copy a project file into the job's media under its content hash. */
  stage: (rel: string, where: string) => { file: string; key: string };
  /** The project path of an element's `file` or `asset`. */
  assetFile: (ref: AssetRef, kind: 'clip' | 'image', where: string) => string;
}
export interface CompiledPlan {
  plan: ScenePlan;
  warnings: string[];
  footage: Footage[];
  provenance: LayerProvenance[];
  /** Seconds by which each beat's native layers have arrived. */
  settle: Record<string, number>;
  hash: string;
}

export interface ScenePlan {
  kind: 'clearframe.scene';
  version: 1;
  format: { width: number; height: number; fps: number; frames: number };
  job: 'job.json';
  media: 'media';
  layers: PlanLayer[];
  inputs: {
    provenance: LayerProvenance[];
    footage: Array<Pick<Footage, 'source' | 'offset' | 'seconds'>>;
  };
}
