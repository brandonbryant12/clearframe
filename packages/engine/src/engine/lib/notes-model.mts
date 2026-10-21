import {
  decodeNotesFile,
  decodeKeepsFile,
  decodeDecision,
} from './notes-schema.mjs';
// Shapes of review/notes.json, review/keeps.json and review/decisions.jsonl, decoded on read.
import fs from 'node:fs';
import { isRecord } from './harness/contracts.mjs';

import { readJSONFile, reviewPath, writeJSONAtomic } from './store.mjs';
import type { AnchorPrints, NearCut } from './anchor.mjs';

export const KEEPS = ['voice', 'words', 'facts', 'picture', 'look'];
export const SCOPES = ['element', 'beat', 'range', 'chapter', 'film'];
export const NOTE_STATUSES = [
  'open',
  'applied',
  'accepted',
  'dismissed',
  'question',
];

export interface Author {
  role: string;
  name?: string;
}
/** Where a note points in the revision it was made on (see anchor.mts); film notes have none. */
export interface NoteAnchor {
  beat?: string;
  beats?: string[];
  at: number;
  to?: number;
  beatTime?: number;
  chapter?: string | null;
  words?: string;
  quoteAt?: number;
  source?: { file: string; from: number; to: number; original?: number[] };
  element?: string;
  near?: NearCut[];
  prints: Partial<AnchorPrints>;
}
export interface NoteEvent {
  status: string;
  at: string;
  revision?: string;
  by?: unknown;
  reason?: string;
}
export interface Note {
  id: string;
  createdAt?: string;
  author?: Author;
  via?: string;
  revision: string;
  text: string;
  scope: string;
  kind?: string;
  anchor: NoteAnchor | null;
  keep?: string[];
  status: string;
  history: NoteEvent[];
  resolution?: { revision?: string; at: string; summary?: string };
  replies?: { text: string; by?: string | null; at?: string | null }[];
}
export interface BeatBaseline {
  voice?: string | null;
  audio?: string | null;
  words?: string;
  facts?: string;
  picture?: string;
  removals?: string[];
}
export interface Keep {
  id: string;
  what: string;
  scope: { beats?: string[]; film?: boolean };
  revision: string;
  by: Author;
  said?: string;
  note?: string;
  createdAt?: string;
  active: boolean;
  baseline: Record<string, BeatBaseline | string>;
  releasedAt?: string;
  releasedBy?: Author;
  releaseSaid?: string;
}
export interface DecisionPrint {
  authored: string;
  rendered: string;
  start: number;
}
export interface Decision {
  id: string;
  at: string;
  action: string;
  role: string;
  by?: string;
  said?: string;
  reason?: string;
  revision: string;
  contentId?: string;
  videos?: { profile?: string; sha256?: string }[];
  scope?: {
    note?: string;
    beats?: string[];
    checkpoint?: string;
    keep?: string;
  };
  film?: string;
  prints?: Record<string, DecisionPrint>;
}

/** Older viewer pins carried a revision and time before scopes and edit history were recorded. */
function legacyNote(value: unknown) {
  if (!isRecord(value)) return value;
  const anchor = isRecord(value.anchor) ? value.anchor : null;
  let scope = 'film';
  if (anchor) {
    scope = 'range';
    if (anchor.beat) scope = 'beat';
    if (anchor.element) scope = 'element';
  }
  return {
    history: [],
    scope,
    anchor: null,
    ...value,
    ...(anchor ? { anchor: { prints: {}, ...anchor } } : {}),
  };
}
export function readNotes(root: string): Note[] {
  const value: unknown = readJSONFile(reviewPath(root, 'notes.json'), {
    version: 1,
    notes: [],
  });
  const normalized =
    isRecord(value) && Array.isArray(value.notes)
      ? { ...value, notes: value.notes.map(legacyNote) }
      : value;
  return decodeNotesFile(normalized).notes;
}
export const writeNotes = (root: string, notes: Note[]): void =>
  writeJSONAtomic(reviewPath(root, 'notes.json'), { version: 1, notes });
export const readKeeps = (root: string): Keep[] =>
  decodeKeepsFile(
    readJSONFile(reviewPath(root, 'keeps.json'), { version: 1, keeps: [] }),
  ).keeps;
export const writeKeeps = (root: string, keeps: Keep[]): void =>
  writeJSONAtomic(reviewPath(root, 'keeps.json'), { version: 1, keeps });

export function readDecisions(root: string): Decision[] {
  const file = reviewPath(root, 'decisions.jsonl');
  return fs.existsSync(file)
    ? fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => decodeDecision(JSON.parse(l)))
    : [];
}
