import type {
  BeatChange,
  ChangeStatus,
  Lineage,
  SequenceOrder,
  TakeChange,
  Timeline,
  TimelineBeat,
} from './revisions-model.mjs';

export const round = (n: number, d = 3): number =>
  Math.round(n * 10 ** d) / 10 ** d;

export const sameRange = (a: TimelineBeat, b: TimelineBeat): boolean =>
  a.startFrame === b.startFrame && a.frames === b.frames;

export const fmtShift = (s: number): string =>
  `${s < 0 ? 'earlier' : 'later'} by ${Math.abs(s).toFixed(2)} s`;

export const clip = (s: unknown, n: number): string =>
  String(s ?? '').length > n
    ? String(s).slice(0, n - 1) + '…'
    : String(s ?? '');

export const MOVED = 'moved to another place in the sequence';

export interface Compare {
  A: Timeline;
  B: Timeline;
  before: Map<string, TimelineBeat>;
  after: Map<string, TimelineBeat>;
  global: string[];
  worldsChanged: Set<string>;
  lineage?: Lineage | null;
}

export interface SummaryInput {
  B: Timeline;
  film: Record<string, 'same' | 'changed'>;
  global: string[];
  order: SequenceOrder;
  counts: Partial<Record<ChangeStatus, number>>;
  all: BeatChange[];
  durationDelta: number;
  firstShift: BeatChange | undefined;
  takes: TakeChange[];
}

export interface ImpactOptions {
  lineage?: Lineage | null;
  from?: string;
  to?: string;
}

export interface Stretch {
  beats: string[];
  before: string[];
}
