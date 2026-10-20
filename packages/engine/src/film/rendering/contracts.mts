import type {
  PrepareOptions,
  PreparedContext,
  PreparedManifest,
  CheckResult,
} from '../preparation/contracts.mjs';
import type { NativeReport } from './schemas.mjs';
import type { unvalidated } from './provenance.mjs';
export interface ExpectedVideo {
  width: number;
  height: number;
  fps: number;
  frames: number;
}
export interface RenderOptions extends PrepareOptions {
  out?: string;
  noAudio?: boolean;
  force?: boolean;
  scale?: number;
  check?: CheckResult | null;
  revision?: boolean;
  label?: string;
}
export interface RenderReport extends PreparedManifest, ExpectedVideo {
  encoder: string;
  authoredWidth: number;
  authoredHeight: number;
  scale: number;
  seconds: number;
  backend: string;
  native: NativeReport;
  audio: boolean;
  colorSpace: string | null;
  colorTransfer: string | null;
  colorPrimaries: string | null;
  colorRange: string | null;
  finishingSourceHashes: Record<string, string>;
  outputSha256: string;
  voiceProviders: string[];
  notValidated?: ReturnType<typeof unvalidated>;
  revision?: string;
}
export interface RangeOptions {
  from?: number;
  to?: number;
  beats?: string[];
  handles?: number;
}
export interface PreviewOptions extends RangeOptions, PrepareOptions {
  out?: string;
  verify?: boolean;
  name?: string;
  ctx?: PreparedContext;
}
export interface CutOptions {
  fps: number;
  a: number;
  b: number;
  out: string;
}
export interface StillOptions extends PrepareOptions {
  at?: number | string;
  beat?: string;
  pos?: number;
  out?: string;
  grid?: boolean;
}
export interface WorldOptions extends PrepareOptions {
  name?: string;
  out?: string;
}
export interface SheetOptions extends PrepareOptions {
  per?: number;
  columns?: number;
  thumb?: number;
  out?: string;
  grid?: boolean;
}
export interface LookbookOptions extends PrepareOptions {
  beat?: string;
  pos?: number;
  out?: string;
}
export interface FrameComparison {
  film: number;
  preview: number;
  psnr: number | null;
  neighbour: number | null;
}
