import type { TimeRange, Word, JsonObject } from './primitives.mjs';
import type { BlockProps } from './props.mjs';

export interface TimedVoice extends TimeRange {
  text: string;
  src: string | null;
  dur: number;
  estimated: boolean;
  provider: string | null;
  wordTiming: 'estimated' | 'measured';
  alignmentIssue?: string;
  stale?: string;
  words: Word[];
}

export interface TimedBeat extends TimeRange {
  id: string;
  index: number;
  chapter: string | null;
  scene: string | null;
  block: string | null;
  props: BlockProps | null;
  transition: string | null;
  dur: number;
  visual: string | null;
  vo?: TimedVoice;
  sfx?: { src: string; volume: number; t: number }[];
}

export interface MusicTiming {
  src: string | null;
  volume: number;
  duck: boolean;
  fadeIn: number;
  fadeOut: number;
  offset: number;
  scored: boolean;
  drop?: { beat: string; film: number; song: number };
}

export interface Timing {
  title: string;
  width: number;
  height: number;
  fps: number;
  duration: number;
  frames: number;
  theme: string | Record<string, string>;
  estimated: boolean;
  beats: TimedBeat[];
  music: MusicTiming | null;
  assets: { id: string; kind: string; src: string | null }[];
  look: {
    backdrop: string;
    chrome: boolean;
    captions: boolean | string | JsonObject;
    transition: string;
    sfx: boolean | string | JsonObject;
    voiceProvider: string;
  };
}
