// The exact requests a paid narration or music run would send. Their content hashes key the
// caches and bind a person's approval, so field order and presence here are part of the contract.
import type {
  Beat,
  MusicSettings,
  ResolvedStoryboard,
  TimedBeat,
} from '../domain.mjs';
import { draftSettings, planTakes, takeSpec } from './takes.mjs';
import { loadStoryboard } from './project.mjs';
import { computeTiming } from './timing.mjs';
import { hashOf, round } from './util.mjs';
import { composePrompt } from '../../skills/lyria-music/scripts/music.mjs';
import type { MusicSection } from '../../skills/lyria-music/scripts/music.mjs';
import type { WeightedPrompt } from '../../skills/lyria-music/scripts/realtime.mjs';
import type {
  CastVoice,
  SpeechPart,
} from '../../skills/gemini-tts/scripts/tts.mjs';
import type { SoundKind } from './generate-model.mjs';

/** One line's request when narration is recorded per beat. */
export function voiceSpec(sb: ResolvedStoryboard, b: Beat, provider: string) {
  return {
    provider,
    model: sb.voice.model,
    voice: sb.voice.voice,
    style: b.style ?? sb.voice.style ?? '',
    language: sb.voice.language ?? null,
    text: b.vo,
    ...draftSettings(sb, provider),
  };
}

/** A continuous take's request as `takeSpec` builds it (the fields synthesis reads). */
export interface TakeRequest {
  cast: CastVoice[] | null;
  parts: SpeechPart[];
  style: string;
  voice: string;
  model: string;
  language: string | null;
}

/** The text parts a take sends: one text and one style for a single voice, turns for a cast. */
export function takeParts(
  sb: ResolvedStoryboard,
  spec: TakeRequest,
): SpeechPart[] {
  const single = !spec.cast && !sb.voice.perBeatStyle;
  return single
    ? [{ text: spec.parts.map((p) => p.text).join('\n\n'), style: spec.style }]
    : spec.parts;
}

/** What the musical arc reads from a timeline. */
export interface ArcTiming {
  duration: number;
  beats: readonly Pick<TimedBeat, 'chapter' | 'index' | 'start' | 'end'>[];
}

const sectionKey = (b: ArcTiming['beats'][number], count: number): string => {
  if (b.chapter) return b.chapter;
  if (b.index === 0) return 'open';
  return b.index === count - 1 ? 'close' : 'body';
};
const defaultSectionText = (i: number, count: number): string => {
  if (i === 0) return 'Intro: sparse and airy — a soft pad and a gentle pulse.';
  if (i === count - 1)
    return 'Outro: resolve and thin out to one sustained chord.';
  return 'Steady, understated groove; one new layer at most; leave space for a speaking voice.';
};

/** Derive a timestamped musical arc from the edit, so the score breathes with the story. */
export function musicSections(
  timing: ArcTiming,
  sb: ResolvedStoryboard,
): MusicSection[] {
  const music = sb.music || undefined;
  if (music?.sections) return music.sections;
  const groups: { key: string; from: number; to: number }[] = [];
  for (const b of timing.beats) {
    const key = sectionKey(b, timing.beats.length);
    const g = groups.at(-1);
    if (g && g.key === key) g.to = b.end;
    else groups.push({ key, from: b.start, to: b.end });
  }
  const arc = music?.arc ?? {};
  return groups.map((g, i) => ({
    from: round(g.from, 1),
    to: round(g.to, 1),
    text: arc[g.key] ?? defaultSectionText(i, groups.length),
  }));
}

/** A Lyria RealTime bed: weighted prompts and generation controls, streamed to an exact length. */
export interface RealtimeMusicSpec {
  model: string;
  prompts: WeightedPrompt[];
  bpm: number | undefined;
  density: number | undefined;
  brightness: number | undefined;
  scale: string | undefined;
  seconds: number;
}
/** A composed Lyria bed: one prompt carrying style, tempo, length and timestamped sections. */
export interface ComposedMusicSpec {
  model: string;
  prompt: string;
}
export type MusicSpec = RealtimeMusicSpec | ComposedMusicSpec;
export const isRealtime = (spec: MusicSpec): spec is RealtimeMusicSpec =>
  'prompts' in spec;

const scoredMusic = (sb: ResolvedStoryboard): MusicSettings => {
  if (!sb.music)
    throw new Error('storyboard.music is false; there is no music to score.');
  return sb.music;
};

export function musicSpec(
  sb: ResolvedStoryboard,
  timing: ArcTiming,
): MusicSpec {
  const music = scoredMusic(sb);
  const model = music.model ?? 'lyria-3.5';
  const seconds = Math.ceil(timing.duration + 2);
  if (model === 'lyria-realtime')
    return {
      model,
      prompts: music.weightedPrompts ?? [{ text: music.prompt, weight: 1.0 }],
      bpm: music.bpm,
      density: music.density,
      brightness: music.brightness,
      scale: music.scale,
      seconds,
    };
  return {
    model,
    prompt: composePrompt({
      style: music.prompt,
      bpm: music.bpm,
      key: music.key,
      seconds,
      sections: musicSections(timing, sb),
      ending: music.ending,
    }),
  };
}

/**
 * The exact provider requests a paid narration or music run would send, as content hashes: one per
 * take (or per line), or one for the bed. A person's approval in the studio is bound to these.
 */
export function soundSpecs(
  sb: ResolvedStoryboard,
  kind: SoundKind,
  timing?: ArcTiming | null,
): string[] {
  if (kind === 'music') {
    if (!sb.music) return [];
    if (!timing)
      throw new Error(
        'Music requests depend on the film timing; pass it to soundSpecs.',
      );
    return [hashOf(musicSpec(sb, timing))];
  }
  if (sb.voice.takes !== 'beat')
    return planTakes(sb).map((t) => hashOf(takeSpec(sb, t, sb.voice.provider)));
  return sb.beats
    .filter((b) => b.vo)
    .map((b) => hashOf(voiceSpec(sb, b, sb.voice.provider)));
}

export const approvedSoundSpecs = (root: string, kind: SoundKind): string[] => {
  const sb = loadStoryboard(root);
  return soundSpecs(sb, kind, kind === 'music' ? computeTiming(root) : null);
};
