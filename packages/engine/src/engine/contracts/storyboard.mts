import type { BlockProps } from './props.mjs';
import type {
  MotionSettings,
  SoundCue,
  CameraCue,
  CameraSettings,
} from './motion.mjs';
import type { Plate, Art } from './canvas.mjs';
import type { JsonObject, JsonValue, Format } from './primitives.mjs';
import type { Speaker, Source, Asset } from './assets.mjs';
import type {
  VoiceSettings,
  MusicSettings,
  MixSettings,
  Pacing,
} from './audio.mjs';

export interface Beat<P extends BlockProps = BlockProps> {
  was?: string[];
  id: string;
  block?: string;
  scene?: string;
  props?: P;
  vo?: string;
  style?: string;
  chapter?: string;
  speaker?: string;
  duration?: number;
  lead?: number;
  tail?: number;
  hold?: number;
  min?: number;
  transition?: string;
  into?: string;
  exit?: string;
  transitionColor?: string;
  transitionOrigin?: JsonValue;
  lens?: JsonObject;
  motion?: MotionSettings;
  sfx?: SoundCue[];
  tone?: string;
  textMotion?: string;
  type?: string;
  pace?: 'hold';
  heading?: string;
  label?: string;
  note?: string;
  camera?: string | CameraCue;
  plate?: Plate;
  art?: Art;
  visual?: string;
  placeholder?: string | boolean | { text: string };
  stage?: JsonObject;
}

export interface Storyboard {
  length?: number;
  $schema?: string;
  version?: number;
  title?: string;
  logline?: string;
  audience?: string;
  budget?: number;
  format?: Partial<Format>;
  theme?: string | Record<string, string>;
  motion?: MotionSettings;
  transition?: string;
  backdrop?: string;
  chrome?: boolean;
  captions?: boolean | string | JsonObject;
  sfx?: boolean | string | JsonObject;
  treatment?: string;
  camera?: string | CameraSettings;
  lens?: JsonObject;
  speakers?: Record<string, Speaker>;
  frame?: boolean | string | JsonObject;
  heading?: string;
  textMotion?: string;
  type?: string;
  texture?: string | JsonObject;
  voice?: Partial<VoiceSettings>;
  music?: false | Partial<MusicSettings>;
  mix?: Partial<MixSettings>;
  pacing?: Partial<Pacing>;
  sources?: Source[];
  continuity?: {
    maxGeneratedShare?: number;
    refs?: string[];
    treatment?: string;
    lighting?: string;
    camera?: string;
    motion?: string;
    motif?: string;
  };
  assets?: Asset[];
  beats: Beat[];
  stages?: JsonObject[];
}

export interface ResolvedStoryboard extends Omit<
  Storyboard,
  'format' | 'voice' | 'music' | 'mix' | 'pacing' | 'assets' | 'sources'
> {
  format: Format;
  voice: VoiceSettings;
  music: false | MusicSettings;
  mix: MixSettings;
  pacing: Pacing;
  assets: Asset[];
  sources: Source[];
}
