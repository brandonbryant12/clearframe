import type { BrandInventoryEntry } from '../brand.mjs';
import type { Speaker } from '../../domain.mjs';

export interface SpeakerOverride {
  name?: string;
  role?: string;
  color?: string;
}

export interface RecordingOptions {
  audio: string;
  words?: unknown;
  script?: unknown;
  from?: number;
  to?: number;
  fps?: number;
  vertical?: boolean;
  speakers?: Record<string, SpeakerOverride>;
  theme?: string | Record<string, string>;
  title?: string;
  treatment?: string;
  direction?: string;
  playbook?: string;
}

export interface RecordingRequest extends RecordingOptions {
  brand?: string;
}

export interface RecordingReceipt {
  beats: number;
  duration: number;
  speakers: string[];
  words: number;
  assets: BrandInventoryEntry[];
  interpolated?: number;
}

export interface BeatClock {
  pcm: Buffer;
  rate: number;
  fps: number;
  from: number;
  cuts: number[];
  voDir: string;
  script: boolean;
  vertical: boolean;
}

export interface SpeakerCast {
  [speakerId: string]: Speaker;
}
