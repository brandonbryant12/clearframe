import type { Beat, TimedBeat, Storyboard } from '../domain.mjs';
import type { VideoEvidence } from './evidence-contracts.mjs';

export interface QaFinding {
  level: 'error' | 'warn' | 'note';
  kind: string;
  message: string;
  t?: number;
  frame?: number;
  beat?: string | null;
  local?: number | null;
  end?: number;
  seconds?: number;
  faint?: number;
  deliberate?: boolean;
  said?: string;
  fix?: string;
  fill?: { w: number; h: number };
}
export interface Loudness {
  integrated: number;
  peak: number | null;
}
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
export interface QaSummary {
  seconds: number;
  changePerSecond: number;
  frames?: number;
  heldSeconds?: number;
  deliberateSeconds?: number;
  pops?: number;
  loudness?: Loudness | null;
  audio?: boolean;
  color?: string;
  evidence?: string;
}
export interface QaResult {
  dir?: string;
  summary: QaSummary;
  findings: QaFinding[];
  evidence?: VideoEvidence;
  width?: number;
  height?: number;
}
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
