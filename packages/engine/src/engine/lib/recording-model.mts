// Shapes of an ingested recording on disk: a beat's voice metadata and its declared slice of
// source/recording.wav, the transcript on the recording's clock, and review/edits.jsonl.
import fs from 'node:fs';
import path from 'node:path';
import * as Schema from 'effect/Schema';
import { BeatSchema, decodeStoryboard } from '../schemas.mjs';
import { checkId, readJSONFile, reviewPath } from './store.mjs';
import type { Beat, Storyboard, Word } from '../domain.mjs';

export const SOURCE = 'source/recording.wav';

const Rest = [Schema.Record(Schema.String, Schema.Unknown)] as const;
const Numbers = Schema.Array(Schema.Finite).pipe(Schema.mutable);

/** Who made an edit: a person by name, or the agent. */
export interface EditAuthor {
  role: string;
  name?: string;
  [key: string]: unknown;
}
/** A sample range taken out of a beat's slice (a cut, a shortened pause, a gap between merged beats). */
export interface Removal {
  id: string;
  kind: string;
  words: string;
  samples: number[];
  pad?: number;
  from: number;
  to: number;
  by?: EditAuthor;
  at?: string;
  note?: string;
}
/** A beat's declared view of the master: its frame span minus removals, and its share of the transcript. */
export interface RecordingSlice {
  file: string;
  start: number;
  end: number;
  offset?: number;
  fps?: number;
  span?: number[];
  words?: number[];
  removed?: Removal[];
}
export interface VoAlignment {
  kind?: string;
  provider?: string;
  audioHash?: string;
  interpolatedWords?: number;
}
/** assets/vo/<beat>.json: generated or imported narration and its word timings. */
export interface VoMeta {
  provider?: string;
  textHash?: string;
  text?: string;
  duration?: number;
  words?: Word[];
  alignment?: VoAlignment;
  source?: RecordingSlice;
  hash?: string;
  take?: { id?: string; hash?: string; [key: string]: unknown };
}
export type RecordedMeta = VoMeta & {
  provider: 'imported';
  source: RecordingSlice;
};
export interface TranscriptWord extends Word {
  speaker?: string;
  estimated?: boolean;
}
/** source/words.json: the recording's transcript on its own clock. */
export interface Transcript {
  version?: number;
  file?: string;
  rate: number;
  fps?: number;
  offset?: number;
  duration?: number;
  words: TranscriptWord[];
}
/** One beat's part of an edit-log entry. */
export interface EditPart {
  beat: string;
  deleted?: boolean;
  after?: string | null;
  storyboard?: Beat;
  meta?: VoMeta;
  removals?: number;
}
/** A line of review/edits.jsonl: c cut, u uncut, p split, m merge, x a rejected candidate's restore. */
export interface EditEntry {
  id: string;
  op: string;
  at?: string;
  note?: string;
  words?: string;
  seconds?: number;
  beats?: (EditPart | string)[];
  of?: string | string[];
  into?: string | string[];
  beat?: string;
  by?: unknown;
  conflicts?: string[];
  dropped?: Record<string, Beat>;
}
/** A storyboard beat with the ids it was made from (a split or merge records them). */
export type AuthoredBeat = Beat & { was?: string[] };

const AuthorSchema: Schema.Codec<EditAuthor> = Schema.StructWithRest(
  Schema.Struct({
    role: Schema.String,
    name: Schema.optionalKey(Schema.String),
  }),
  Rest,
);
const RemovalSchema: Schema.Codec<Removal> = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.String,
    kind: Schema.String,
    words: Schema.String,
    samples: Numbers,
    pad: Schema.optionalKey(Schema.Finite),
    from: Schema.Finite,
    to: Schema.Finite,
    by: Schema.optionalKey(AuthorSchema),
    at: Schema.optionalKey(Schema.String),
    note: Schema.optionalKey(Schema.String),
  }),
  Rest,
);
const SliceSchema: Schema.Codec<RecordingSlice> = Schema.StructWithRest(
  Schema.Struct({
    file: Schema.String,
    start: Schema.Finite,
    end: Schema.Finite,
    offset: Schema.optionalKey(Schema.Finite),
    fps: Schema.optionalKey(Schema.Finite),
    span: Schema.optionalKey(Numbers),
    words: Schema.optionalKey(Numbers),
    removed: Schema.optionalKey(
      Schema.Array(RemovalSchema).pipe(Schema.mutable),
    ),
  }),
  Rest,
);
const WordSchema: Schema.Codec<Word> = Schema.StructWithRest(
  Schema.Struct({ w: Schema.String, t0: Schema.Finite, t1: Schema.Finite }),
  Rest,
);
const VoMetaSchema: Schema.Codec<VoMeta> = Schema.StructWithRest(
  Schema.Struct({
    provider: Schema.optionalKey(Schema.String),
    textHash: Schema.optionalKey(Schema.String),
    text: Schema.optionalKey(Schema.String),
    duration: Schema.optionalKey(Schema.Finite),
    words: Schema.optionalKey(Schema.Array(WordSchema).pipe(Schema.mutable)),
    alignment: Schema.optionalKey(
      Schema.StructWithRest(
        Schema.Struct({
          kind: Schema.optionalKey(Schema.String),
          provider: Schema.optionalKey(Schema.String),
          audioHash: Schema.optionalKey(Schema.String),
          interpolatedWords: Schema.optionalKey(Schema.Finite),
        }),
        Rest,
      ),
    ),
    source: Schema.optionalKey(SliceSchema),
    hash: Schema.optionalKey(Schema.String),
    take: Schema.optionalKey(
      Schema.StructWithRest(
        Schema.Struct({
          id: Schema.optionalKey(Schema.String),
          hash: Schema.optionalKey(Schema.String),
        }),
        Rest,
      ),
    ),
  }),
  Rest,
);
const TranscriptSchema: Schema.Codec<Transcript> = Schema.StructWithRest(
  Schema.Struct({
    version: Schema.optionalKey(Schema.Finite),
    file: Schema.optionalKey(Schema.String),
    rate: Schema.Finite,
    fps: Schema.optionalKey(Schema.Finite),
    offset: Schema.optionalKey(Schema.Finite),
    duration: Schema.optionalKey(Schema.Finite),
    words: Schema.Array(
      Schema.StructWithRest(
        Schema.Struct({
          w: Schema.String,
          t0: Schema.Finite,
          t1: Schema.Finite,
          speaker: Schema.optionalKey(Schema.String),
          estimated: Schema.optionalKey(Schema.Boolean),
        }),
        Rest,
      ),
    ).pipe(Schema.mutable),
  }),
  Rest,
);
const IdOrIds = Schema.Union([
  Schema.String,
  Schema.Array(Schema.String).pipe(Schema.mutable),
]);
const EditPartSchema: Schema.Codec<EditPart> = Schema.StructWithRest(
  Schema.Struct({
    beat: Schema.String,
    deleted: Schema.optionalKey(Schema.Boolean),
    after: Schema.optionalKey(Schema.NullOr(Schema.String)),
    storyboard: Schema.optionalKey(BeatSchema),
    meta: Schema.optionalKey(VoMetaSchema),
    removals: Schema.optionalKey(Schema.Finite),
  }),
  Rest,
);
const EditEntrySchema: Schema.Codec<EditEntry> = Schema.StructWithRest(
  Schema.Struct({
    id: Schema.String,
    op: Schema.String,
    at: Schema.optionalKey(Schema.String),
    note: Schema.optionalKey(Schema.String),
    words: Schema.optionalKey(Schema.String),
    seconds: Schema.optionalKey(Schema.Finite),
    beats: Schema.optionalKey(
      Schema.Array(Schema.Union([Schema.String, EditPartSchema])).pipe(
        Schema.mutable,
      ),
    ),
    of: Schema.optionalKey(IdOrIds),
    into: Schema.optionalKey(IdOrIds),
    beat: Schema.optionalKey(Schema.String),
    by: Schema.optionalKey(Schema.Unknown),
    conflicts: Schema.optionalKey(
      Schema.Array(Schema.String).pipe(Schema.mutable),
    ),
    dropped: Schema.optionalKey(Schema.Record(Schema.String, BeatSchema)),
  }),
  Rest,
);

export const decodeVoMeta = Schema.decodeUnknownSync(VoMetaSchema);
export const decodeTranscript = Schema.decodeUnknownSync(TranscriptSchema);
const decodeEdit = Schema.decodeUnknownSync(EditEntrySchema);

/** A beat that replays a slice of the ingested recording. */
export const isRecorded = (
  meta: VoMeta | null | undefined,
): meta is RecordedMeta =>
  meta?.provider === 'imported' && meta?.source?.file === SOURCE;

/** The ids a beat was made from (split or merge), recorded on the storyboard beat. */
export function wasOf(beat: unknown): string[] | null {
  if (
    !beat ||
    typeof beat !== 'object' ||
    !('was' in beat) ||
    !Array.isArray(beat.was)
  )
    return null;
  return beat.was.filter((id: unknown): id is string => typeof id === 'string');
}
/** The beat parts of an edit-log entry (entries that list beat ids instead have none). */
export const editParts = (e: EditEntry): EditPart[] =>
  (e.beats ?? []).filter((p): p is EditPart => typeof p !== 'string');
/** The beat ids an entry names, whether it lists parts or ids. */
export const editBeatIds = (e: EditEntry): string[] =>
  (e.beats ?? []).map((p) => (typeof p === 'string' ? p : p.beat));

export const metaPath = (root: string, id: string): string =>
  path.join(root, 'assets', 'vo', `${checkId('beat', id)}.json`);
export const wavPath = (root: string, id: string): string =>
  path.join(root, 'assets', 'vo', `${checkId('beat', id)}.wav`);
export const readStoryboardFile = (root: string): Storyboard =>
  decodeStoryboard(readJSONFile(path.join(root, 'storyboard.json')));
/** A beat's voice metadata, or null when it has none. */
export function readMeta(root: string, id: string): VoMeta | null {
  const raw = readJSONFile(metaPath(root, id), null);
  return raw == null ? null : decodeVoMeta(raw);
}
/** Voice metadata from an already-parsed value (a stored object, a file read elsewhere). */
export const voMetaOrNull = (raw: unknown): VoMeta | null =>
  raw == null ? null : decodeVoMeta(raw);
export function readTranscript(root: string): Transcript | null {
  const raw = readJSONFile(path.join(root, 'source', 'words.json'), null);
  return raw == null ? null : decodeTranscript(raw);
}

// ------------------------------------------------------------------ the edit log
// review/edits.jsonl, one line per edit: c001 cut, u001 uncut, p001 split, m001 merge,
// x001 a rejected candidate's restore (written by edit-loop.mjs).

export function readEdits(root: string): EditEntry[] {
  const file = reviewPath(root, 'edits.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => decodeEdit(JSON.parse(l)));
}
export function logEdit(root: string, entry: EditEntry): void {
  const file = reviewPath(root, 'edits.jsonl');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(
    file,
    JSON.stringify({ ...entry, at: new Date().toISOString() }) + '\n',
  );
}
