// Shapes of review/revisions: the timeline a person watched and the revision record beside it.
// Both are read back from disk, so they are decoded; fields this module does not name are kept.

import type { Word } from '../domain.mjs';
import type {
  PreparedContext as FilmPreparedContext,
  PreparedManifest,
} from '../../film/preparation/contracts.mjs';
import type { NativeJob } from '../../film/types.mjs';

// ------------------------------------------------------------------ prepared projects

export type JobBeat = NativeJob['beats'][number];
export type PreparedJob = NativeJob;
export type RevisionManifest = PreparedManifest;
export interface Placeholder {
  beat: string;
  reason: string;
}
/** Review reads the same prepared project contract as rendering. */
export type PreparedContext = FilmPreparedContext;

// ------------------------------------------------------------------ timeline

export interface BeatPrints {
  authored: string;
  own: string;
  rendered: string;
  picture: string;
  words: string;
  audio: string | null;
  voice: string | null;
  facts: string;
}
export interface TimelineVoice {
  text: string;
  start: number;
  end: number;
  timing: string;
  estimated: boolean;
  provider: string | null;
  take: string | null;
  plannedTake: string | null;
}
export interface SourceSegment {
  film: [number, number];
  source: [number, number];
}
export interface RemovedSpan {
  id: string;
  kind: string;
  words: string;
  from: number;
  to: number;
  note?: string;
}
export interface TimelineSource {
  file: string;
  offset: number;
  segments: SourceSegment[];
  removed: RemovedSpan[];
}
export interface Coupling {
  exit?: string | null;
  continues?: boolean | null;
  handoff?: boolean;
  morph?: boolean;
  carried?: boolean;
}
export interface TimelineBeat {
  id: string;
  index: number;
  chapter: string | null;
  block: string | null;
  speaker: string | null;
  start: number;
  end: number;
  startFrame: number;
  frames: number;
  transition: string;
  exit?: string | null;
  world: string | null;
  placeholder: string | null;
  visual: string | null;
  vo: TimelineVoice | null;
  words: Word[];
  source: TimelineSource | null;
  elements: string[];
  was: string[] | null;
  coupling?: Coupling;
  prints: BeatPrints;
}
export interface FilmPrints {
  look: string;
  sound: string;
  voice: string;
  data: string;
  renderer: string;
}
export interface Timeline {
  version: number;
  printScheme?: number;
  title: string;
  fps: number;
  frames: number;
  duration: number;
  width: number;
  height: number;
  music: { src: string; offset: number } | null;
  film: FilmPrints;
  beats: TimelineBeat[];
}

// ------------------------------------------------------------------ revision records

export interface RevisionVideo {
  profile?: string;
  object: string;
  sha256?: string;
  receipt?: string;
  frames?: number;
  encoder?: string;
  renderedAt?: string;
  retained?: boolean;
  releasedAt?: string;
}
/** A stored before/after passage; `verified` is the render's frame check (film/render), kept as written. */
export interface PreviewSide {
  object: string | null;
  revision?: string;
  frames?: number[];
  verified?: unknown;
}
export interface RevisionPreview {
  beats: string[];
  removed: string[];
  before: PreviewSide | null;
  after: PreviewSide | null;
}
export interface LineageRemoval {
  into?: string[];
  deleted?: boolean;
  by?: string;
  words?: string;
  text?: string | null;
}
export interface Lineage {
  added: Record<string, { from: string[] }>;
  removed: Record<string, LineageRemoval>;
  merged: Record<string, { from: string[] }>;
}
export interface RevisionImpact {
  from: string;
  summary: string[];
  counts: Record<string, number>;
}
/**
 * review/revisions/<id>/revision.json. Snapshots write every field; records written by other
 * tools (a studio import, an older ClearFrame) may carry only an id and their videos.
 */
export interface RevisionMeta {
  id: string;
  parent?: string | null;
  createdAt?: string;
  kind?: string;
  label?: string;
  reason?: string;
  by?: string;
  contentId?: string;
  inputId?: string;
  renderer?: { sourceHash?: string; fonts?: string; plan?: string };
  frames?: number;
  fps?: number;
  duration?: number;
  beats?: number;
  placeholders?: Placeholder[];
  unfinished?: unknown[];
  estimatedTiming?: string[];
  notes?: string[];
  lastEdit?: string | null;
  lineage?: Lineage | null;
  inputs?: Record<string, string>;
  job?: string;
  videos?: RevisionVideo[];
  previews?: RevisionPreview[];
  impact?: RevisionImpact;
}

// ------------------------------------------------------------------ impact reports

export type ChangeStatus =
  | 'added'
  | 'content'
  | 'appearance'
  | 'shifted'
  | 'unchanged'
  | 'removed';
export interface BeatChange {
  id: string;
  status: ChangeStatus;
  reasons?: string[];
  from?: string[];
  changed?: string[];
  shift?: number;
  durationDelta?: number;
  into?: string[];
  text?: string | null;
}
export interface SequenceOrder {
  reordered: boolean;
  moved: string[];
  before?: string[];
  after?: string[];
}
export interface TakeChange {
  take: string;
  beats: string[];
  because: string[];
}
export interface Passage {
  beats: string[];
  removed: string[];
  before: number[] | null;
  after: number[] | null;
}
export interface ImpactReport {
  from: string;
  to: string;
  film: Record<string, 'same' | 'changed'>;
  durationDelta: number;
  order: SequenceOrder;
  beats: BeatChange[];
  counts: Partial<Record<ChangeStatus, number>>;
  takes: TakeChange[];
  passages: Passage[];
  summary: string[];
}

export { decodeTimeline } from './revisions-schema-timeline.mjs';
export { decodeRevisionMeta } from './revisions-schema-meta.mjs';
