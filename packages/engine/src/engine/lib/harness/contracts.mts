import type { ChildProcess } from 'node:child_process';
import * as Schema from 'effect/Schema';
import * as Struct from 'effect/Struct';
import type * as Types from 'effect/Types';

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
export const errorCode = (error: unknown): unknown =>
  error !== null && typeof error === 'object' && 'code' in error
    ? error.code
    : undefined;
export const errorStatus = (error: unknown): number | undefined =>
  error !== null &&
  typeof error === 'object' &&
  'status' in error &&
  typeof error.status === 'number'
    ? error.status
    : undefined;
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
// The harness's public data contracts. Each schema is the source of its TypeScript type: the
// harness decodes requests, ledger rows and events with the same definitions that agent
// adapters read as JSON Schema (`clearframe/contracts`, `clearframe capabilities --json`).
export const JOB_KINDS = [
  'still',
  'section',
  'check',
  'draft',
  'final',
  'captions',
  'revise',
  'reject',
  'voice',
  'music',
] as const;
export const JobKindSchema = Schema.Literals(JOB_KINDS);
export type JobKind = typeof JobKindSchema.Type;

export const JOB_STATUSES = [
  'queued',
  'waiting',
  'running',
  'complete',
  'failed',
  'cancelled',
  'interrupted',
] as const;
export const JobStatusSchema = Schema.Literals(JOB_STATUSES);
export type JobStatus = typeof JobStatusSchema.Type;
/** A job in one of these states will not change again. */
export const TERMINAL_STATUSES: readonly JobStatus[] = [
  'complete',
  'failed',
  'cancelled',
  'interrupted',
];

export const SoundKindSchema = Schema.Literals(['voice', 'music']);
export type SoundKind = typeof SoundKindSchema.Type;

const text = Schema.optionalKey(Schema.String);
const nullableText = Schema.optionalKey(Schema.NullOr(Schema.String));
const number = Schema.optionalKey(Schema.Number);
const boolean = Schema.optionalKey(Schema.Boolean);
const strings = Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String)));
const values = Schema.optionalKey(Schema.mutable(Schema.Array(Schema.Unknown)));

export const SoundApprovalSchema = Schema.Struct({
  intent: Schema.String,
  basis: Schema.Struct({ specs: Schema.Unknown }),
  by: text,
  at: text,
  budget: number,
});
export type SoundApproval = typeof SoundApprovalSchema.Type;

export const MediaProbeSchema = Schema.Struct({
  width: Schema.NullOr(Schema.Number),
  height: Schema.NullOr(Schema.Number),
  duration: Schema.NullOr(Schema.Number),
  audio: Schema.Boolean,
  authored: Schema.optionalKey(Schema.NullOr(Schema.Number)),
});
export type MediaProbe = Types.Mutable<typeof MediaProbeSchema.Type>;

export const JobResultSchema = Schema.Struct({
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
export type JobResult = Types.Mutable<typeof JobResultSchema.Type>;

export const JobRecoverySchema = Schema.Struct({
  at: Schema.String,
  reason: Schema.String,
  from: JobStatusSchema,
  /** `unknown` when paid work may or may not have completed before the interruption. */
  outcome: text,
});

/** Every field a job carries; `dir` is the project path and stays out of public views. */
export const jobRecordFields = {
  dir: Schema.NonEmptyString,
  id: Schema.NonEmptyString,
  kind: Schema.NonEmptyString,
  status: JobStatusSchema,
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
  approval: Schema.optionalKey(SoundApprovalSchema),
  key: nullableText,
  cached: boolean,
  matches: boolean,
  requestedHash: nullableText,
  repinned: boolean,
  startedAt: text,
  finishedAt: text,
  interruptedAt: text,
  recovery: Schema.optionalKey(JobRecoverySchema),
  errors: strings,
  progress: number,
  url: nullableText,
  range: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.Number))),
  verified: boolean,
  hasAudio: boolean,
  result: Schema.optionalKey(JobResultSchema),
  media: Schema.optionalKey(Schema.NullOr(MediaProbeSchema)),
  label: text,
};
export const JobRecordSchema = Schema.Struct(jobRecordFields);
export type JobRecord = Types.Mutable<typeof JobRecordSchema.Type>;

export interface HarnessJob extends JobRecord {
  kind: JobKind;
  log: string;
  child?: ChildProcess;
  killTimer?: NodeJS.Timeout;
  settled?: Promise<void>;
}

/** What `get`, `list` and `cancel` return: the job without its project path or live handles. */
export const JobViewSchema = Schema.Struct({
  ...Struct.omit(jobRecordFields, ['dir']),
  kind: JobKindSchema,
  log: Schema.String,
  /** Set by `cancel` when the child was stopped but the ledger could not record it. */
  persistenceError: text,
});
export type JobView = Types.Mutable<typeof JobViewSchema.Type>;

export const JobRequestSchema = Schema.Struct({
  kind: JobKindSchema,
  film: text,
  hash: text,
  /** Repeating a key with the same request returns its job; reusing it for another is refused. */
  requestKey: Schema.optionalKey(Schema.NullOr(Schema.String)),
  beat: text,
  pos: number,
  at: number,
  beats: strings,
  handles: number,
  rough: boolean,
  draft: boolean,
  note: text,
  revision: text,
  by: text,
  said: text,
});
export type JobRequest = typeof JobRequestSchema.Type;

/** `start`: the new or existing job's id; `duplicate` for a repeated key, `cached` for a cached preview. */
export const StartResultSchema = Schema.Struct({
  id: Schema.String,
  duplicate: boolean,
  cached: boolean,
  job: Schema.optionalKey(JobViewSchema),
});
export type StartResult = typeof StartResultSchema.Type;

export const HarnessHealthSchema = Schema.Struct({
  state: Schema.Literals(['ready', 'stopped', 'failed']),
  error: Schema.NullOr(Schema.String),
});
export type HarnessHealth = typeof HarnessHealthSchema.Type;

const EventStateSchema = Schema.Struct({
  status: JobStatusSchema,
  cancelled: Schema.Boolean,
});
const eventFields = {
  /** Ledger-wide cursor: pass the last seen `seq` as `after` to read on. */
  seq: Schema.Int,
  jobId: Schema.String,
  at: Schema.String,
};
/** A job's lifecycle as the ledger recorded it; consumers resume from a `seq` cursor. */
export const JobEventSchema = Schema.Union([
  Schema.Struct({
    ...eventFields,
    /** `migrated`: first seen while importing older history. */
    type: Schema.Literals(['created', 'migrated']),
    data: EventStateSchema,
  }),
  Schema.Struct({
    ...eventFields,
    type: Schema.Literal('transition'),
    data: Schema.Struct({ from: EventStateSchema, to: EventStateSchema }),
  }),
]);
export type JobEvent = typeof JobEventSchema.Type;

export const EventOptionsSchema = Schema.Struct({
  after: Schema.optionalKey(Schema.Int),
  jobId: text,
  limit: Schema.optionalKey(Schema.Int),
});
export type EventOptions = typeof EventOptionsSchema.Type;

/** Why the harness refused an operation; `status` is the HTTP status the studio replies with. */
export const HarnessFailureSchema = Schema.Literals([
  'invalid-request',
  'approval-required',
  'request-key-conflict',
  'unknown-job',
  'not-running',
  'unavailable',
]);
export class HarnessRequestError extends Schema.TaggedError<HarnessRequestError>()(
  'HarnessRequestError',
  {
    reason: HarnessFailureSchema,
    message: Schema.String,
    status: Schema.Int,
  },
) {}

/** Decodes a request from any caller (JSON, CLI, another runtime); refuses it with its first issue. */
export function decodeJobRequest(body: unknown): JobRequest {
  try {
    return Schema.decodeUnknownSync(JobRequestSchema)(body);
  } catch (error) {
    throw new HarnessRequestError({
      reason: 'invalid-request',
      message: `Invalid job request: ${errorMessage(error).split('\n')[0]}`,
      status: 400,
    });
  }
}

export interface StoreOptions {
  file: string;
  legacyFile?: string;
  keepJobs?: number;
}
export const isJobKind = (value: string): value is JobKind =>
  JOB_KINDS.some((kind) => kind === value);
export function hydrateJob(record: JobRecord): HarnessJob {
  if (!isJobKind(record.kind))
    throw new Error(`Unsupported stored job kind: ${record.kind}`);
  return { ...record, kind: record.kind, log: record.log ?? '' };
}
export const WorkerMessage = Schema.Struct({
  type: Schema.Literal('worker'),
  pid: Schema.Int,
});
export const ProbeSchema = Schema.Struct({
  streams: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        codec_type: Schema.String,
        width: Schema.optionalKey(Schema.Number),
        height: Schema.optionalKey(Schema.Number),
      }),
    ),
  ),
  format: Schema.optionalKey(
    Schema.Struct({ duration: Schema.optionalKey(Schema.String) }),
  ),
});

export const SOUND_GRANT = Symbol('clearframe sound grant');
export interface SoundGrant {
  [SOUND_GRANT]: true;
  kind: SoundKind;
  paid?: boolean;
  force?: boolean;
  budget?: number;
  approval?: SoundApproval;
}
