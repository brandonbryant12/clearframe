import type { ResolvedStoryboard, Timing } from '../../engine/domain.mjs';
import type { LayerProvenance } from '../../scene/types.mjs';
import type { JobResult, NativeJob } from '../types.mjs';

export type Profile = 'rough' | 'draft' | 'final';
export interface PrepareOptions {
  draft?: boolean;
  rough?: boolean;
}
export interface Placeholder {
  beat: string;
  reason: string;
  declared: boolean;
  label: string;
  assets?: string[];
}
export interface UnfinishedElement {
  beat: string;
  element: string;
  note?: string;
}
export interface AllowedText {
  beat: string;
  text: string;
  why: string;
}
export interface RoughResult {
  sb: ResolvedStoryboard;
  timing: Timing;
  placeholders: Placeholder[];
  unfinished: UnfinishedElement[];
  allowed: AllowedText[];
}
export interface AuditFinding {
  level: string;
  beat: string;
  message: string;
  kind?: string;
  seconds?: number;
  text?: string;
}
export interface AuditOptions extends PrepareOptions {
  allowed?: AllowedText[];
  job?: NativeJob;
}
export interface AuditClassification {
  errors: string[];
  warnings: string[];
  craft: string[];
}
export interface PreparedManifest {
  version: 2;
  renderer: 'scene';
  rendererSourceHash: string;
  fontHashes: Record<string, string>;
  planSha256: string;
  jobSha256: string;
  provenance: LayerProvenance[];
  hashes: Record<string, string>;
  sounds?: Record<string, string>;
  inputId: string;
  draft: boolean;
  profile: Profile;
  placeholders?: Placeholder[];
  unfinished?: UnfinishedElement[];
  warnings: string[];
}
export interface PreparedJob extends RoughResult {
  root: string;
  result: JobResult;
  jobSha256: string;
}
export interface PreparedContext extends JobResult, RoughResult {
  root: string;
  dir: string;
  media: string;
  manifest: PreparedManifest;
  cleanup?: () => void;
}
export interface CheckResult extends AuditClassification {
  profile: Profile;
  notes: string[];
  placeholders: Placeholder[];
  unfinished?: UnfinishedElement[];
  duration?: number;
  inputId?: string;
}
export const profileOf = ({ draft, rough }: PrepareOptions): Profile => {
  if (rough) return 'rough';
  return draft ? 'draft' : 'final';
};
