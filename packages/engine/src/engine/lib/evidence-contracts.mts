import * as Schema from 'effect/Schema';
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
export interface VideoEvidence {
  scope: 'bound' | 'unbound' | 'stale' | 'invalid';
  coverage?: 'none' | 'partial' | 'full';
  video: string;
  videoSha256: string;
  receipt: string | null;
  receiptSha256?: string;
  profile?: string;
  inputId?: string | null;
  revision?: string | null;
  outputSha256?: string | null;
  checked: string[];
  unchecked: string[];
  problems: string[];
}
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
