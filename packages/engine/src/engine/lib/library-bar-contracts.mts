import type { NativeJob } from '../../film/types.mjs';
export interface BarCase {
  id: string;
  storyboard: string | Record<string, unknown>;
  at?: number[];
  minPsnr?: number;
  files?: Record<string, string>;
  takeaway?: string;
  audio?: boolean;
}
export interface BarRefusal extends BarCase {
  match: string;
}
export interface BarSensitivity {
  id: string;
  base: string;
  changed: string;
  at: number;
  minChangedFraction?: number;
}
export interface BarFixture {
  name: string;
  reference?: string;
  cases: BarCase[];
  refusals?: BarRefusal[];
  sensitivities?: BarSensitivity[];
}
export type BarStatus = 'running' | 'passed' | 'failed';
export interface BarSample {
  frame: number;
  time: number;
  native: string;
  decoded: string;
  psnr: number | 'identical';
}
export interface BarCaseResult {
  id: string;
  takeaway?: string;
  status: BarStatus;
  errors: string[];
  warnings: string[];
  samples: BarSample[];
  project?: string;
  video?: string;
  videoSha256?: string;
  qaPhone?: string;
  phone?: string;
}
export interface BarRefusalResult {
  id: string;
  status: BarStatus;
  expected: string;
  errors: string[];
}
export interface BarSensitivityResult extends BarSensitivity {
  status: BarStatus;
  changedFraction?: number;
  changedPixels?: number;
  error?: string;
}
export interface BarReport {
  version: number;
  name: string;
  reference?: string;
  status: BarStatus;
  visualJudgement: 'open';
  comprehensionJudgement: 'open';
  fixtureSha256: string;
  implementationSha256: string;
  rendererSourceHash: string;
  cases: BarCaseResult[];
  refusals: BarRefusalResult[];
  sensitivities: BarSensitivityResult[];
  error?: string;
}
export interface PreparedCase {
  job: NativeJob;
  frames: Map<number, string>;
}
export interface BarContext {
  out: string;
  base: string;
  fixture: BarFixture;
  prepared: Map<string, PreparedCase>;
}
