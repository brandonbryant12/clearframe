import type { FrameComparison } from '../../film/rendering/contracts.mjs';

import type { renderRange, frameRange } from '../../film/render.mjs';

import type { RevisionMeta, Timeline } from './revisions.mjs';
import type { Located } from './notes.mjs';
/** A rendered or cut passage's receipt (film/render), as far as the loop reads it. */
export interface PassageReceipt {
  output: string;
  range?: { frames?: number[]; seconds?: number[]; fps?: number };
  verified?: FrameComparison[] | null;
  beats?: ReturnType<typeof frameRange>['covered'];
  audio?: Awaited<ReturnType<typeof renderRange>>['audio'];
  revision?: string;
  from?: string;
  object?: string | null;
  [key: string]: unknown;
}
export interface PassagePair {
  beats: string[];
  removed: string[];
  before?: PassageReceipt;
  after?: PassageReceipt;
}
export interface DeclaredScope {
  film: boolean;
  beats: string[];
  where?: Located;
}
export interface ScopeViolation {
  what?: string;
  beat?: string;
  message: string;
}
/** One side of a comparison: a stored revision, or the working copy (meta null). */
export interface Side {
  meta: RevisionMeta | null;
  timeline: Timeline;
}
export interface PassageRange {
  a: number;
  b: number;
  covered?: ReturnType<typeof frameRange>['covered'];
  handles: number;
  beatIds: string[];
}
