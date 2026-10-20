import type { ChildProcess } from 'node:child_process';
import * as Schema from 'effect/Schema';

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
export type JobKind = (typeof JOB_KINDS)[number];
export type JobStatus =
  | 'queued'
  | 'waiting'
  | 'running'
  | 'complete'
  | 'failed'
  | 'cancelled'
  | 'interrupted';
export type SoundKind = 'voice' | 'music';
export interface SoundApproval {
  intent: string;
  basis: { specs: unknown };
  by?: string;
  at?: string;
  budget?: number;
}
export interface MediaProbe {
  width: number | null;
  height: number | null;
  duration: number | null;
  audio: boolean;
  authored?: number | null;
}
export interface JobResult {
  errors?: unknown[];
  warnings?: unknown[];
  craft?: unknown[];
  revision?: string;
  page?: string | null;
  passages?: {
    beats?: string[];
    before: string | null;
    after: string | null;
  }[];
  restored?: unknown[];
  conflicts?: unknown[];
  now?: unknown;
  restorePoint?: unknown;
}
export interface JobRecord {
  dir: string;
  id: string;
  kind: string;
  status: JobStatus;
  createdAt: string;
  requestKey?: string | null;
  requestFingerprint?: string;
  cancelled?: boolean;
  paid?: boolean;
  childPid?: number | null;
  workerPid?: number | null;
  log?: string;
  film?: string;
  hash?: string | null;
  print?: string | null;
  rough?: boolean;
  beat?: string;
  pos?: number;
  at?: number;
  beats?: string[];
  handles?: number;
  output?: string;
  note?: string;
  revision?: string | null;
  by?: string;
  said?: string;
  budget?: number;
  force?: boolean;
  draft?: boolean;
  approval?: SoundApproval;
  key?: string | null;
  cached?: boolean;
  matches?: boolean;
  requestedHash?: string | null;
  repinned?: boolean;
  startedAt?: string;
  finishedAt?: string;
  interruptedAt?: string;
  recovery?: { at: string; reason: string; from: JobStatus; outcome?: string };
  errors?: string[];
  progress?: number;
  url?: string | null;
  range?: number[];
  verified?: boolean;
  hasAudio?: boolean;
  result?: JobResult;
  media?: MediaProbe | null;
  label?: string;
}
export interface HarnessJob extends JobRecord {
  kind: JobKind;
  log: string;
  child?: ChildProcess;
  killTimer?: NodeJS.Timeout;
  settled?: Promise<void>;
}
export type JobView = Omit<
  HarnessJob,
  'dir' | 'child' | 'killTimer' | 'settled'
>;
export interface JobRequest {
  film?: string;
  kind: JobKind;
  hash?: string;
  requestKey?: string | null;
  beat?: string;
  pos?: number;
  at?: number;
  beats?: string[];
  handles?: number;
  rough?: boolean;
  draft?: boolean;
  note?: string;
  revision?: string;
  by?: string;
  said?: string;
}
export interface JobEvent {
  seq: number;
  jobId: string;
  type: string;
  at: string;
  data: unknown;
}
export interface EventOptions {
  after?: number;
  jobId?: string;
  limit?: number;
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
export const JobRequestSchema = Schema.Struct({
  kind: Schema.Literals(JOB_KINDS),
  film: Schema.optionalKey(Schema.String),
  hash: Schema.optionalKey(Schema.String),
  requestKey: Schema.optionalKey(Schema.NullOr(Schema.String)),
  beat: Schema.optionalKey(Schema.String),
  pos: Schema.optionalKey(Schema.Number),
  at: Schema.optionalKey(Schema.Number),
  beats: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
  handles: Schema.optionalKey(Schema.Number),
  rough: Schema.optionalKey(Schema.Boolean),
  draft: Schema.optionalKey(Schema.Boolean),
  note: Schema.optionalKey(Schema.String),
  revision: Schema.optionalKey(Schema.String),
  by: Schema.optionalKey(Schema.String),
  said: Schema.optionalKey(Schema.String),
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
