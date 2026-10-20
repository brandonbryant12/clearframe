import type { Word } from './primitives.mjs';

export interface VoiceSettings {
  provider: string;
  model: string;
  voice: string;
  style: string;
  wpm: number;
  takes: 'film' | 'chapter' | 'beat';
  language?: string;
  perBeatStyle?: boolean;
  draftVoice?: string;
  pronounce?: Record<string, string>;
  cast?: Record<string, { voice: string; style?: string; draftVoice?: string }>;
}

export interface Pacing {
  lead: number;
  tail: number;
  minBeat: number;
  silentBeat: number;
  outro?: number;
  continuous?: boolean;
}

export interface MusicSettings {
  provider: string;
  model: string;
  volume: number;
  duck: boolean;
  fadeIn: number;
  fadeOut: number;
  file?: string | false;
  prompt?: string;
  duration?: number;
  bpm?: number;
  weightedPrompts?: { text?: string; weight: number }[];
  density?: number;
  brightness?: number;
  scale?: string;
  key?: string;
  ending?: string;
  offset?: number;
  arc?: Record<string, string>;
  sections?: { from: number; to: number; text: string }[];
  style?: string;
  drop?: { beat: string; at?: number | string; song?: number | 'auto' };
}

export interface MixSettings {
  loudness: number;
  voiceGain: number;
}

export interface Alignment {
  kind: 'measured' | 'estimated';
  audioHash?: string | null;
  provider?: string;
  createdAt?: string;
  interpolatedWords?: number;
  model?: string;
  at?: string;
  version?: number;
  source?: string;
}

export interface VoiceMetadata {
  textHash?: string;
  words?: Word[];
  alignment?: Alignment;
  provider?: string | null;
  text?: string;
  hash?: string;
  voice?: string | null;
  osVoice?: string | null;
  createdAt?: string;
  model?: string;
  style?: string;
  wpm?: number;
  duration?: number;
  take?: {
    id?: string;
    hash?: string;
    index?: number;
    count?: number;
    start?: number;
    end?: number;
  };
}
