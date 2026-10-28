import * as Schema from 'effect/Schema';
import type * as Types from 'effect/Types';
import type { Timing } from '../domain.mjs';
export interface EvidenceProbeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  nb_frames?: string | number;
}
export interface EvidenceOptions {
  timing?: Pick<Timing, 'frames' | 'fps'>;
  probe?: { streams?: readonly EvidenceProbeStream[] };
}
export const EvidenceScopeSchema = Schema.Literals([
  'bound',
  'unbound',
  'stale',
  'invalid',
]);
/** Which receipt identity checks ran; not a measure of picture, sound or meaning. */
export const IdentityCoverageSchema = Schema.Literals([
  'none',
  'partial',
  'full',
]);
const textList = Schema.mutable(Schema.Array(Schema.String));
/** What a QA or review measurement is bound to, and what that binding checked. */
export const VideoEvidenceSchema = Schema.Struct({
  scope: EvidenceScopeSchema,
  coverage: Schema.optionalKey(IdentityCoverageSchema),
  video: Schema.String,
  videoSha256: Schema.String,
  receipt: Schema.NullOr(Schema.String),
  receiptSha256: Schema.optionalKey(Schema.String),
  profile: Schema.optionalKey(Schema.String),
  inputId: Schema.optionalKey(Schema.NullOr(Schema.String)),
  revision: Schema.optionalKey(Schema.NullOr(Schema.String)),
  outputSha256: Schema.optionalKey(Schema.NullOr(Schema.String)),
  checked: textList,
  unchecked: textList,
  problems: textList,
});
export type VideoEvidence = Types.Mutable<typeof VideoEvidenceSchema.Type>;
export interface IdentityFinding {
  level: 'warn' | 'error';
  kind: 'identity';
  message: string;
}
const optionalString = Schema.optionalKey(Schema.String);
const optionalNumber = Schema.optionalKey(Schema.Number);
const hashes = Schema.optionalKey(Schema.Record(Schema.String, Schema.String));
export const receiptSchema = Schema.Struct({
  kind: optionalString,
  range: Schema.optionalKey(
    Schema.Struct({ frames: Schema.optionalKey(Schema.Array(Schema.Number)) }),
  ),
  profile: optionalString,
  draft: Schema.optionalKey(Schema.Boolean),
  inputId: optionalString,
  revision: optionalString,
  outputSha256: optionalString,
  frames: optionalNumber,
  fps: optionalNumber,
  width: optionalNumber,
  height: optionalNumber,
  hashes,
  rendererSourceHash: optionalString,
  jobSha256: optionalString,
  fontHashes: hashes,
  finishingSourceHashes: hashes,
});
export type VideoReceipt = typeof receiptSchema.Type;
export const decodeReceipt = Schema.decodeUnknownSync(receiptSchema);

export interface EvidenceState {
  root: string;
  evidence: VideoEvidence;
  invalid: string[];
  stale: string[];
}
