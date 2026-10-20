import type {
  ResolvedStoryboard as Storyboard,
  Timing,
} from '../engine/domain.mjs';
import type {
  JobReport,
  Theme,
  TypeVoice,
  Texture,
  Motion,
  CaptionCue,
  Timed,
  CueResolver,
} from './types.mjs';

export type { CastCarry as JobCast } from './cast.mjs';
import type { CastCarry as JobCast } from './cast.mjs';
export interface FilmSettings {
  textMotion: string;
  type: TypeVoice | null;
  theme: Theme;
  motion: Motion;
  vertical: boolean;
  captions: boolean;
  captionStyle: string;
  backdrop: string;
  texture: Texture | null;
}
export interface BeatContext {
  sb: Storyboard;
  timing: Timing;
  film: FilmSettings;
  transitions: string[];
  captions: CaptionCue[];
  report: JobReport;
  cast?: JobCast;
}
export interface CueContext {
  moments?: Map<string, number> | null;
  spoken: CueResolver;
  fallback?: number;
  where?: string;
  used?: Set<string>;
}
export type ItemCue = Timed | string | number | null | undefined;

/** Convert only accepted texture fields after film validation has reported bad inputs. */
export function textureValue(value: unknown): Texture | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || Array.isArray(value)) return null;
  const texture: Exclude<Texture, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === 'grain' && typeof item === 'number') texture.grain = item;
    if (key === 'vignette' && typeof item === 'number') texture.vignette = item;
    if (key === 'animate' && typeof item === 'boolean') texture.animate = item;
  }
  return texture;
}
