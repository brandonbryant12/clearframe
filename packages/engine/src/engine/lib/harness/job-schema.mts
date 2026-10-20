import * as Schema from 'effect/Schema';
import type { JobRecord } from './contracts.mjs';

const text = Schema.optionalKey(Schema.String);
const nullableText = Schema.optionalKey(Schema.NullOr(Schema.String));
const number = Schema.optionalKey(Schema.Number);
const boolean = Schema.optionalKey(Schema.Boolean);
const strings = Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String)));
const values = Schema.optionalKey(Schema.mutable(Schema.Array(Schema.Unknown)));
const status = Schema.Literals([
  'queued',
  'waiting',
  'running',
  'complete',
  'failed',
  'cancelled',
  'interrupted',
]);
const approval = Schema.StructWithRest(
  Schema.Struct({
    intent: Schema.String,
    basis: Schema.StructWithRest(Schema.Struct({ specs: Schema.Unknown }), [
      Schema.Record(Schema.String, Schema.Unknown),
    ]),
    by: text,
    at: text,
    budget: number,
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
const result = Schema.Struct({
  errors: values,
  warnings: values,
  craft: values,
  revision: text,
  page: nullableText,
  passages: Schema.optionalKey(
    Schema.mutable(
      Schema.Array(
        Schema.Struct({
          beats: strings,
          before: Schema.NullOr(Schema.String),
          after: Schema.NullOr(Schema.String),
        }),
      ),
    ),
  ),
  restored: values,
  conflicts: values,
  now: Schema.optionalKey(Schema.Unknown),
  restorePoint: Schema.optionalKey(Schema.Unknown),
});
const media = Schema.Struct({
  width: Schema.NullOr(Schema.Number),
  height: Schema.NullOr(Schema.Number),
  duration: Schema.NullOr(Schema.Number),
  audio: Schema.Boolean,
  authored: Schema.optionalKey(Schema.NullOr(Schema.Number)),
});

/** Persisted job fields are decoded in full; extension data from older ledgers is retained. */
export const JobSchema: Schema.Codec<JobRecord> = Schema.StructWithRest(
  Schema.Struct({
    dir: Schema.NonEmptyString,
    id: Schema.NonEmptyString,
    kind: Schema.NonEmptyString,
    status,
    createdAt: Schema.NonEmptyString,
    requestKey: Schema.optionalKey(Schema.NullOr(Schema.NonEmptyString)),
    requestFingerprint: text,
    cancelled: boolean,
    paid: boolean,
    childPid: Schema.optionalKey(Schema.NullOr(Schema.Int)),
    workerPid: Schema.optionalKey(Schema.NullOr(Schema.Int)),
    log: text,
    film: text,
    hash: nullableText,
    print: nullableText,
    rough: boolean,
    beat: text,
    pos: number,
    at: number,
    beats: strings,
    handles: number,
    output: text,
    note: text,
    revision: nullableText,
    by: text,
    said: text,
    budget: number,
    force: boolean,
    draft: boolean,
    approval: Schema.optionalKey(approval),
    key: nullableText,
    cached: boolean,
    matches: boolean,
    requestedHash: nullableText,
    repinned: boolean,
    startedAt: text,
    finishedAt: text,
    interruptedAt: text,
    recovery: Schema.optionalKey(
      Schema.Struct({
        at: Schema.String,
        reason: Schema.String,
        from: status,
        outcome: text,
      }),
    ),
    errors: strings,
    progress: number,
    url: nullableText,
    range: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.Number))),
    verified: boolean,
    hasAudio: boolean,
    result: Schema.optionalKey(result),
    media: Schema.optionalKey(Schema.NullOr(media)),
    label: text,
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);
