import * as Schema from 'effect/Schema';
import type * as Types from 'effect/Types';
import type { Beat, TimedBeat, Storyboard } from '../domain.mjs';
import { VideoEvidenceSchema } from './evidence-contracts.mjs';
import { VerdictOutcomeSchema } from './qa-assessment.mjs';

const number = Schema.optionalKey(Schema.Number);
const text = Schema.optionalKey(Schema.String);

/** One thing QA found in the decoded film, at a time and beat when it has one. */
export const QaFindingSchema = Schema.Struct({
  level: Schema.Literals(['error', 'warn', 'note']),
  kind: Schema.String,
  message: Schema.String,
  t: number,
  frame: number,
  beat: Schema.optionalKey(Schema.NullOr(Schema.String)),
  local: Schema.optionalKey(Schema.NullOr(Schema.Number)),
  end: number,
  seconds: number,
  faint: number,
  deliberate: Schema.optionalKey(Schema.Boolean),
  said: text,
  fix: text,
  fill: Schema.optionalKey(
    Schema.Struct({ w: Schema.Number, h: Schema.Number }),
  ),
});
export type QaFinding = Types.Mutable<typeof QaFindingSchema.Type>;

export const LoudnessSchema = Schema.Struct({
  integrated: Schema.Number,
  peak: Schema.NullOr(Schema.Number),
});
export type Loudness = typeof LoudnessSchema.Type;
export interface ProbeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  nb_frames?: string;
  sample_aspect_ratio?: string;
  pix_fmt?: string;
  color_range?: string;
  color_primaries?: string;
  color_transfer?: string;
  color_space?: string;
  duration?: string;
}
export interface Probe {
  streams: readonly ProbeStream[];
}
export interface DecodedFrames {
  frames: number;
  at: (index: number) => Uint8Array;
  size: number;
}
export const QaSummarySchema = Schema.Struct({
  seconds: Schema.Number,
  changePerSecond: Schema.Number,
  frames: number,
  heldSeconds: number,
  deliberateSeconds: number,
  pops: number,
  loudness: Schema.optionalKey(Schema.NullOr(LoudnessSchema)),
  audio: Schema.optionalKey(Schema.Boolean),
  color: text,
  /** The evidence scope, repeated for a one-line summary. */
  evidence: text,
});
export type QaSummary = typeof QaSummarySchema.Type;

/** What `qaProject` returns: the measurements and the evidence they are bound to. */
export const QaResultSchema = Schema.Struct({
  /** The project's build/qa directory, where qa.json and the sheets are written. */
  dir: text,
  summary: QaSummarySchema,
  findings: Schema.mutable(Schema.Array(QaFindingSchema)),
  evidence: Schema.optionalKey(VideoEvidenceSchema),
  width: number,
  height: number,
  /** The grid every decoded frame was analysed at. */
  analysis: Schema.optionalKey(
    Schema.Struct({ width: Schema.Int, height: Schema.Int }),
  ),
});
export type QaResult = Types.Mutable<typeof QaResultSchema.Type>;

/** The whole `qa --json` response: the result, and the motion verdict or why it is unavailable. */
export const QaReportSchema = Schema.Struct({
  ...QaResultSchema.fields,
  motion: VerdictOutcomeSchema,
});
export type QaReport = typeof QaReportSchema.Type;
export interface TimeAnalysis {
  d: number[];
  skip: number[];
  second: number[];
  local?: number[];
  fps: number;
  beats?: TimedBeat[];
  worlds?: Record<string, string | null>;
  covers?: Record<string, readonly number[]>;
  holds?: Set<string>;
}
export interface FrameAnalysis {
  sb: Storyboard;
  beats: TimedBeat[];
  film: DecodedFrames;
  fps: number;
  w: number;
  h: number;
  holds: Set<string>;
}
export type ReviewedBeat = Partial<Beat>;
