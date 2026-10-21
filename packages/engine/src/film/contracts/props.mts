import type {
  DepthKey,
  CanvasElement,
  ViewValue,
  TargetInput,
  ViewNext,
  RevealSpec,
} from './canvas.mjs';
import type {
  Cue,
  JsonRecord,
  CueResolver,
  Fail,
  FrameSize,
  Timed,
} from './primitives.mjs';
import type { RoughSpec, MosaicSpec, PrintSpec } from './canvas-effects.mjs';
import type { AssetDecl } from './storyboard.mjs';

// ------------------------------------------------------------------ block props

export interface ChartFormat {
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

/** A staged item: arrives on its own word, or in order. */
export interface Staged {
  say?: Cue;
  at?: number;
}

/** An item of kpis, steps, timeline, funnel, magnitude or checklist. */
export interface PropsItem extends Staged {
  text?: string;
  title?: string;
  label?: string;
  detail?: string;
  value?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  from?: number;
}

export interface Phrase extends Staged {
  text?: string;
}

export interface FlowNode extends Staged {
  icon?: string;
  label?: string;
  detail?: string;
}

export interface Pin extends Staged {
  x?: number;
  y?: number;
  label?: string;
  detail?: string;
}

export interface BarDatum {
  label: string;
  value: number;
}

export interface SeriesPoint {
  x: number;
  y: number;
}

export interface DeltaEnd {
  value: number;
  label?: string;
}

export interface CompareSide {
  title?: string;
  items?: string[];
}

export interface MatrixRow {
  label?: string;
  values?: string[];
}

export interface Segment {
  label: string;
  value: number;
}

export interface BreathPhase {
  label?: string;
  seconds?: number;
  scale?: string;
}

/**
 * Focus, by block: bars {label, index, say, dim, dur, note}, annotate {x, y, w, h, say} and
 * canvas depth of field {z, aperture, keys}. `at` is resolved by the job.
 */
export interface PropsFocus {
  label?: string;
  index?: number;
  say?: string;
  dim?: number;
  dur?: number;
  note?: string;
  at?: number;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  z?: number;
  aperture?: number;
  keys?: DepthKey[];
}

/**
 * Props of every native block. A block takes the subset its catalog entry lists; the shared
 * checks (catalog.mjs) and the block's validator (validators.mjs) establish these types.
 * Structured canvas inputs (plot, bars, cast…) are expanded before validation and are checked
 * by their own spec functions, so they stay `unknown` here.
 */
export interface BlockProps {
  // Shared text.
  title?: string;
  kicker?: string;
  source?: string;
  land?: Cue;
  support?: string;
  text?: string;
  label?: string;
  context?: string;
  caption?: string;
  author?: string;
  role?: string;
  verdict?: string;
  expression?: string;
  result?: string;
  explanation?: string;
  action?: string;
  number?: string;
  center?: string;
  align?: string;
  emphasis?: string[];
  emphasisStyle?: string;
  decimals?: number;
  prefix?: string;
  suffix?: string;

  // Numbers and charts.
  value?: number;
  /** stat: the starting value; delta: the before side. */
  from?: number | DeltaEnd;
  to?: DeltaEnd;
  change?: string;
  better?: string;
  max?: number;
  min?: number;
  total?: number;
  cols?: number;
  icon?: string;
  items?: Array<string | PropsItem>;
  data?: BarDatum[];
  format?: string | ChartFormat;
  orientation?: string;
  sort?: string;
  growSay?: Cue;
  drawSay?: Cue;
  focus?: PropsFocus;
  series?: Array<number | SeriesPoint>;
  labels?: string[];
  rates?: boolean;
  columns?: string[];
  rows?: MatrixRow[];
  highlight?: number;
  left?: CompareSide;
  right?: CompareSide;
  phrases?: Array<string | Phrase>;
  segments?: Segment[];

  // Speech and motion blocks.
  mode?: string;
  maxWords?: number;
  maxGap?: number;
  maxDuration?: number;
  upper?: boolean;
  nodes?: FlowNode[];
  stagger?: number;
  period?: number;
  clockwise?: boolean;
  phases?: BreathPhase[];
  minScale?: number;
  maxScale?: number;
  ring?: boolean;

  // Media.
  asset?: string;
  file?: string;
  offset?: number;
  fit?: string;
  drift?: boolean;
  pins?: Pin[];

  // Stage (compiled by scene/compile.mjs; only its shape is checked here).
  actors?: unknown[];
  links?: unknown[];
  events?: unknown[];
  under?: unknown[];
  over?: unknown[];
  code?: JsonRecord;
  ground?: JsonRecord;
  camera?: JsonRecord;
  motion?: JsonRecord;
  shutter?: number;
  samples?: number;
  z?: string;

  // Canvas.
  elements?: CanvasElement[];
  view?: ViewValue;
  viewFrom?: number[] | TargetInput;
  viewTall?: number[] | TargetInput;
  viewAt?: number;
  viewDur?: number;
  viewDrift?: number;
  viewNext?: ViewNext;
  world?: string;
  reveal?: RevealSpec;
  rough?: RoughSpec | boolean;
  mosaic?: MosaicSpec | boolean;
  print?: PrintSpec | false;
  dolly?: DepthKey[];
  sketch?: string;
  sketchText?: Record<string, string>;
  sketchSay?: Record<string, string>;
  sketchParams?: JsonRecord;
  seed?: number;
  place?: number[];
  plates?: string;
  moments?: unknown;
  sourceElement?: string;
  sourceSize?: number;
  chart?: unknown;
  diagram?: unknown;
  graph?: unknown;
  accumulate?: unknown;
  estimate?: unknown;
  field?: unknown;
  plot?: unknown;
  bars?: unknown;
  bridge?: unknown;
  breakdown?: unknown;
  process?: unknown;
  decision?: unknown;
  table?: unknown;
  cast?: unknown;
  multiples?: unknown;
  distribution?: unknown;
  stat?: unknown;
  teaching?: unknown;
  kpi?: unknown;
}

/** The frame a block validator lays its props out for. */
export interface ValidationFrame {
  vertical: boolean;
  width: number;
  height: number;
  assets: AssetDecl[];
  resolve?: CueResolver;
  captions: boolean;
}

/** Validation helpers bound to one block's props and error prefix (validators.mjs). */
export interface PropHelpers {
  fail: Fail;
  text: (value: unknown, field: string, max?: number) => void;
  num: (value: unknown, key: string) => asserts value is number;
  findPhrase: (text: unknown, phrase: unknown) => number;
  precision: (value: unknown) => number;
  icon: (value: unknown, field: string) => void;
  unit: (value: unknown, field: string) => asserts value is number;
  keys: (
    obj: unknown,
    allowed: readonly string[],
    field: string,
  ) => asserts obj is object;
  list: (
    items: unknown,
    key: string,
    min: number,
    max: number,
  ) => asserts items is unknown[];
  required: (value: unknown, key: string) => asserts value is string;
  numeric: (obj: NumericFigure, key: string) => void;
  format: (values?: number[]) => void;
}

/** A counted figure (stat props, a kpis item). */
export interface NumericFigure {
  value?: unknown;
  from?: unknown;
  decimals?: number;
  prefix?: unknown;
  suffix?: unknown;
}

/** A frame for expanding structured canvas props, with the beat's clock when the job builds it. */
export interface HelperFrame extends FrameSize {
  beatId?: string;
  duration?: number;
  moments?: Map<string, number> | null;
  usedMoments?: Set<string>;
  /** Scene seconds for `{cue, after}`, `{say, after}` or `{at}`; `fallback` when it gives none. */
  when?: (
    item: Timed | Cue | null | undefined,
    fallback?: number,
    where?: string,
  ) => number;
  /** A heading's band: the cast keeps below `top` or above `bottom`. */
  top?: number;
  bottom?: number;
}
