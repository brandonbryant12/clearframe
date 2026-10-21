import type { PaletteColors, ThemeInput } from './job.mjs';
import type { JsonRecord } from './primitives.mjs';
import type {
  CameraInput,
  StoryboardBeat,
  FrameChromeInput,
  Lens,
} from './storyboard.mjs';
import type { RoughSpec, MosaicSpec, PrintSpec } from './canvas-effects.mjs';
import type {
  CanvasElement,
  ViewValue,
  TargetInput,
  DepthKey,
} from './canvas.mjs';
import type { PropsFocus } from './props.mjs';

// ------------------------------------------------------------------ library items

export type LibraryKind =
  | 'palettes'
  | 'treatments'
  | 'sketches'
  | 'playbooks'
  | 'types'
  | 'directions';

export interface LibraryItemBase {
  id: string;
  /** The file the item was read from. */
  source: string;
  order?: number;
  title?: string;
}

export interface PaletteItem extends LibraryItemBase {
  colors: PaletteColors;
  notes?: string;
}

/** Film-level settings a treatment applies to a storyboard. */
export interface TreatmentFilm {
  theme?: string | ThemeInput;
  type?: string;
  voice?: JsonRecord;
  transition?: string;
  motion?: { preset?: string; intensity?: number };
  [setting: string]: unknown;
}

export interface TreatmentBeats {
  camera?: string | CameraInput;
  emphasisStyle?: string;
  kinetic?: string;
  rough?: RoughSpec | boolean;
  mosaic?: MosaicSpec | boolean;
  print?: PrintSpec;
  font?: string;
  fps?: number;
  graphic?: string;
}

export interface TreatmentVariant {
  name: string;
  film?: TreatmentFilm;
  beats?: TreatmentBeats;
}

export interface TreatmentItem extends LibraryItemBase {
  title: string;
  when: string;
  film: TreatmentFilm;
  beats?: TreatmentBeats;
  rules?: string[];
  playbook?: string;
  playbooks?: string[];
  variants?: TreatmentVariant[];
}

/** A drawn sketch: its elements and the camera it brings. */
export interface SketchDrawing {
  elements: CanvasElement[];
  view?: ViewValue;
  viewFrom?: number[] | TargetInput;
  viewDur?: number;
  dolly?: DepthKey[];
  focus?: PropsFocus;
  world?: string;
  /** "under": an art layer for any block. */
  layer?: string;
}

export interface SketchBuildOptions {
  seed?: number;
  params?: JsonRecord;
  text?: Record<string, string>;
}

export type SketchBuild = (
  width: number,
  height: number,
  options?: SketchBuildOptions,
) => SketchDrawing;

/** A number or choice a sketch draws from (`sketchParams`). */
export interface SketchParam {
  default: unknown;
  min?: number;
  max?: number;
  integer?: boolean;
  oneOf?: unknown[];
  list?: boolean;
  length?: [number, number];
  about?: string;
  hint?: string;
  figure?: boolean;
}

export interface SketchItem extends LibraryItemBase {
  name: string;
  summary: string;
  use: string;
  build: SketchBuild;
  params?: Record<string, SketchParam>;
  keep?: boolean;
  keepText?: string[];
  freeMoments?: string[];
  diagram?: unknown;
  layer?: string;
  formats?: Record<string, SketchDrawing>;
  elements?: CanvasElement[];
}

export interface PlaybookEnding {
  name: string;
  about: string;
  beats: StoryboardBeat[];
}

export interface PlaybookItem extends LibraryItemBase {
  title: string;
  audience: string;
  inputs: string;
  beats: StoryboardBeat[];
  endings?: PlaybookEnding[];
  sources?: unknown[];
  recording?: unknown;
  theme?: string | ThemeInput;
  motion?: string;
  texture?: unknown;
  frame?: boolean | FrameChromeInput;
  speakers?: Record<string, JsonRecord>;
  voice?: JsonRecord;
  format?: string;
  backdrop?: string;
  captions?: boolean | string;
  note?: string;
  lens?: Lens;
  camera?: string | CameraInput;
  heading?: string;
  textMotion?: string;
  type?: string;
  transition?: string;
  sfx?: boolean | string;
  music?: JsonRecord;
}

export interface TypeItem extends LibraryItemBase {
  title: string;
  when: string;
  display: string;
  emphasis?: string;
  case?: string;
  tracking?: number;
  leading?: number;
}

export interface DirectionItem extends LibraryItemBase {
  title: string;
  when: string;
  materials: string[];
  playbook: string;
  treatment: string;
  story: string;
  picture: string;
  pace: string;
  rules: string[];
}

export interface LibraryItems {
  palettes: PaletteItem;
  treatments: TreatmentItem;
  sketches: SketchItem;
  playbooks: PlaybookItem;
  types: TypeItem;
  directions: DirectionItem;
}
