import type { Storyboard } from '../../domain.mjs';
import type { plan } from '../generate.mjs';
import type { SoundKind } from '../harness/contracts.mjs';
interface Provider {
  id: string;
  name: string;
  paid: boolean;
  ready: boolean;
  needs: string | null;
  note: string;
}
interface SpeechProvider extends Provider {
  models?: string[];
}
interface MusicProvider extends Provider {
  models?: { id: string; price: number; note: string }[];
}
export interface SoundBeat {
  id: string;
  words: number;
  seconds: number;
  made: string | null;
  model: string | null;
  voice: string | null;
  at: string | null;
  audio: string | null;
  current: boolean;
  draftOnly: boolean;
  cost: number;
  measured: boolean;
}
export interface SoundTake {
  id: string;
  beats: SoundBeat[];
  seconds: number;
  cost: number;
  status: string;
}
export interface SoundBasis {
  kind: SoundKind;
  hash: string;
  model?: string;
  voice?: string;
  style?: string;
  takes?: string[];
  prompt?: string;
  bpm?: number | null;
  cost: number;
  specs: string[];
}
export interface SoundState {
  providers: { speech: SpeechProvider[]; music: MusicProvider[] };
  narration: {
    recorded: boolean;
    provider: string;
    model: string;
    voice: string;
    style: string;
    takesMode: string;
    voices: { id: string; character: string }[];
    lines: number;
    takes: SoundTake[];
    cost: number;
  };
  music:
    | { off: true }
    | {
        off: false;
        model: string;
        prompt: string;
        bpm: number | null;
        volume: number;
        duck: boolean;
        fadeIn: number;
        fadeOut: number;
        made: string | null;
        at: string | null;
        audio: string | null;
        current: boolean;
        cost: number;
        seconds: number | null;
      };
  sfx: NonNullable<Storyboard['sfx']>;
  budget: number | null;
  plan: {
    total: number;
    rows: ReturnType<typeof plan>['rows'];
    duration: number;
  } | null;
  planError: string | null;
  basis?: { voice: SoundBasis | null; music: SoundBasis | null };
}
