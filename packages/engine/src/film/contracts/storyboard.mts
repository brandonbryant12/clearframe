import type { TargetInput, CanvasElement } from './canvas.mjs';
import type { RoughSpec } from './canvas-effects.mjs';
import type { BlockProps } from './props.mjs';
import type { ThemeInput } from './job.mjs';
import type { JsonRecord } from './primitives.mjs';

// ------------------------------------------------------------------ storyboard and timing

/** A declared asset (storyboard `assets`). */
export interface AssetDecl {
  id: string;
  kind?: string;
  file?: string;
  prompt?: string;
  layers?: boolean | string[];
}

export interface Motion {
  preset: string;
  intensity: number;
}

/** A beat or film lens: `blur` is the motion-blur shutter (0–1). */
export interface Lens {
  blur?: number;
}

export interface CameraInput {
  move?: string;
  amount?: number;
  to?: number[] | TargetInput;
  at?: number;
  say?: string;
  dur?: number;
}

export interface PlateInput {
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

/** A beat's art layer: drawn elements under or over its block, or a library sketch. */
export interface ArtInput {
  under?: CanvasElement[];
  over?: CanvasElement[];
  rough?: RoughSpec | boolean;
  sketch?: string;
  seed?: number;
  opacity?: number;
  drift?: number;
}

export interface FrameChromeInput {
  brand?: string;
  left?: string;
  right?: string;
  label?: boolean;
  progress?: boolean;
}

/** A beat as authored. */
export interface StoryboardBeat {
  id: string;
  block?: string;
  props?: BlockProps;
  vo?: string;
  chapter?: string;
  transition?: string;
  into?: string;
  exit?: string;
  motion?: Partial<Motion>;
  textMotion?: string;
  type?: string;
  art?: ArtInput;
  pace?: string;
  plate?: PlateInput;
  lens?: unknown;
  heading?: string;
  tone?: string;
  transitionOrigin?: unknown;
  transitionColor?: string;
  label?: string;
  speaker?: string;
  camera?: string | CameraInput;
  placeholder?: string | { text?: string };
  duration?: number;
  lead?: number;
  tail?: number;
  hold?: number;
  min?: number;
  /** Props that replace `props` in a vertical scaffold (playbooks). */
  tall?: BlockProps;
  scene?: unknown;
  note?: string;
}

/** A storyboard as authored (playbooks and treatments build and edit these). */
export interface StoryboardInput {
  version?: number;
  title?: string;
  logline?: string;
  format?: { preset?: string; fps?: number };
  theme?: string | ThemeInput;
  motion?: Partial<Motion>;
  transition?: string;
  backdrop?: string;
  chrome?: boolean;
  captions?: boolean | string;
  music?: JsonRecord;
  sfx?: boolean | string;
  texture?: unknown;
  lens?: Lens;
  camera?: string | CameraInput;
  heading?: string;
  textMotion?: string;
  type?: string;
  frame?: boolean | FrameChromeInput;
  speakers?: Record<string, JsonRecord>;
  voice?: JsonRecord;
  sources?: unknown[];
  continuity?: { maxGeneratedShare?: number; [setting: string]: unknown };
  treatment?: string;
  length?: number;
  mix?: JsonRecord;
  assets?: AssetDecl[];
  beats: StoryboardBeat[];
}

/** A loaded storyboard (engine/lib/project.mjs fills these defaults). */
export interface Storyboard extends StoryboardInput {
  pacing: { outro?: number; [setting: string]: unknown };
  assets: AssetDecl[];
  sources: unknown[];
}

export interface TimedWord {
  w: string;
  t0: number;
  t1: number;
}

export interface BeatVoice {
  text: string;
  src?: string | null;
  start: number;
  end: number;
  dur?: number;
  estimated?: boolean;
  provider?: string | null;
  wordTiming?: string;
  alignmentIssue?: string;
  words: TimedWord[];
}

/** A beat on the timeline (engine/lib/timing.mjs computeTiming). */
export interface TimingBeat {
  id: string;
  index: number;
  chapter: string | null;
  scene?: unknown;
  block: string | null;
  props: BlockProps | null;
  transition: string | null;
  start: number;
  end: number;
  dur: number;
  heading?: string;
  vo?: BeatVoice;
  sfx?: Array<{ src: string; volume?: number; t?: number }>;
}

export interface Timing {
  title: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  frames: number;
  beats: TimingBeat[];
  music?: { src?: string | null } | null;
}

/** A caption cue in film seconds (engine/lib/timing.mjs captionCues). */
export interface CaptionCue {
  start: number;
  end: number;
  text: string;
  lines?: string[];
}
