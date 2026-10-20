import type {
  PlateInput,
  Lens,
  Motion,
  FrameChromeInput,
} from './storyboard.mjs';
import type { TargetInput, CanvasElement } from './canvas.mjs';
import type { JsonRecord } from './primitives.mjs';
import type { BlockProps } from './props.mjs';

// ------------------------------------------------------------------ the native job

export type PaletteKey =
  | 'bg'
  | 'surface'
  | 'ink'
  | 'muted'
  | 'accent'
  | 'accent2'
  | 'positive'
  | 'negative';

export type PaletteColors = Record<PaletteKey, string>;

/** A resolved palette: its base preset and every colour. */
export interface Theme extends PaletteColors {
  base: string;
}

/** A palette preset name with colour overrides. */
export type ThemeInput = { base?: string } & Partial<PaletteColors>;

/** A type voice resolved for the renderer. */
export interface TypeVoice {
  id: string;
  display: string;
  emphasis: string;
  upper: boolean;
  tracking: number;
  leading: number;
}

export interface JobWord {
  text: string;
  start: number;
  end: number;
}

export interface JobCaption {
  start: number;
  end: number;
  text: string;
  lines?: string[];
}

export interface JobPlate extends PlateInput {
  video?: boolean;
}

export interface JobCamera {
  move?: string;
  amount?: number;
  to?: number[] | TargetInput;
  at?: number;
  say?: string;
  dur?: number;
}

export type JobSpeaker = JsonRecord & { id: string; continues: boolean };

/** Tone, transition style, label, speaker, camera, plate and lens of one beat. */
export interface BeatLayers {
  lens?: Lens;
  heading?: string;
  text_motion?: string;
  type?: TypeVoice;
  tone?: string;
  enter_style?: { color: string };
  label?: string;
  speaker?: JobSpeaker;
  camera?: JobCamera;
  plate?: JobPlate;
}

export interface ArtLayers {
  under: CanvasElement[];
  over: CanvasElement[];
}

/** One beat of the native job: a pure description of every frame it covers. */
export interface JobBeat extends BeatLayers {
  id: string;
  block: string;
  frames: number;
  start_frame: number;
  cue_seconds: number;
  count_seconds?: number;
  transition: string;
  exit: string;
  exit_style?: { color: string };
  settle_seconds: number;
  motion: Motion;
  props: BlockProps;
  art?: ArtLayers;
  words: JobWord[];
  captions: JobCaption[];
  /** The element box an `into` transition goes through, in frame pixels. */
  into?: number[];
  /** Voice levels per frame (prepare.mjs). */
  levels?: unknown;
}

export type Texture =
  | string
  | { grain?: number; vignette?: number; animate?: boolean };

export interface NativeJob {
  version: number;
  title: string;
  width: number;
  height: number;
  fps: number;
  frames: number;
  theme: Theme;
  motion: Motion;
  backdrop: string;
  chrome: boolean;
  captions: boolean;
  caption_style: string;
  texture?: Texture;
  text_motion: string;
  type?: TypeVoice;
  frame?: FrameChromeInput;
  beats: JobBeat[];
  guides?: boolean;
}

/** Errors block a render; warnings are advice (drafts demote some errors). */
export interface JobReport {
  errors: string[];
  warnings: string[];
  draft: boolean;
}

export interface JobResult {
  job: NativeJob;
  errors: string[];
  warnings: string[];
}
