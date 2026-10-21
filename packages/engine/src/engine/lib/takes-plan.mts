// Which narrated beats are recorded together, and what each take asks the voice for. The spec's
// hash caches a recording, so everything that changes its sound belongs in it.
import type { Beat, VoiceSettings } from '../domain.mjs';
import { estimateDuration } from './timing-speech.mjs';

/** What planning and recording takes read from a storyboard. */
export interface TakeStoryboard {
  voice: VoiceSettings;
  beats: readonly Beat[];
  format: { fps: number };
}
/** A beat with narration. */
export type NarratedBeat = Beat & { vo: string };
/** Narrated beats recorded together in one continuous take. */
export interface Take {
  id: string;
  beats: NarratedBeat[];
}
export interface TakePart {
  text: string;
  style: string;
  speaker?: string;
}
/** What a draft take's sound depends on besides its words. */
export interface DraftSettings {
  wpm?: number;
  draftVoice?: string;
  pronounce?: Record<string, string>;
  cast?: Record<string, string | null>;
}
/** What a take asks the provider for; its hash caches the recording. */
export interface TakeSpec {
  provider: string;
  model: string;
  voice: string;
  cast: { speaker: string; voice: string }[] | null;
  language: string | null;
  style: string;
  parts: TakePart[];
  draft?: DraftSettings;
}
/** The OS voice of a draft take: one name, or one per speaker for a cast. */
export type OsVoice = string | Record<string, string>;

export const narrated = (b: Beat): b is NarratedBeat =>
  typeof b.vo === 'string' && b.vo !== '';

/** The take being filled while planning. */
interface OpenTake {
  chapter: string;
  beats: NarratedBeat[];
  seconds: number;
  lastChapter?: string;
}

/** Whether the open take is full before `b`: past ~8 minutes at a chapter change for a film take,
 *  past 14 beats or ~100 s for a chapter take. */
function takeFull(cur: OpenTake, b: Beat, film: boolean, wpm: number): boolean {
  const seconds = cur.seconds + estimateDuration(b.vo ?? '', wpm);
  if (film) return seconds > 480 && b.chapter !== cur.lastChapter;
  return cur.beats.length >= 14 || seconds > 100;
}

/**
 * Narrated beats grouped into takes. `film` (the default) records the whole narration in one
 * continuous take, which keeps one voice, one energy and one room tone from the first line
 * to the last; it splits at a chapter boundary only past ~8 minutes, well inside Gemini TTS
 * limits (8k input / 16k output tokens ≈ 10 min). `chapter` records one take per chapter
 * (≤ 14 beats, ≤ ~100 s).
 */
export function planTakes(sb: Pick<TakeStoryboard, 'voice' | 'beats'>): Take[] {
  const film = (sb.voice.takes ?? 'film') === 'film';
  const takes: { beats: NarratedBeat[] }[] = [];
  let cur: OpenTake | null = null;
  for (const b of sb.beats) {
    // A beat without narration ends the take it interrupts.
    if (!narrated(b)) {
      if (cur) takes.push(cur);
      cur = null;
      continue;
    }
    const chapter = film ? '' : (b.chapter ?? '');
    if (
      !cur ||
      cur.chapter !== chapter ||
      takeFull(cur, b, film, sb.voice.wpm)
    ) {
      if (cur) takes.push(cur);
      cur = { chapter, beats: [], seconds: 0 };
    }
    cur.beats.push(b);
    cur.seconds += estimateDuration(b.vo, sb.voice.wpm);
    cur.lastChapter = b.chapter;
  }
  if (cur) takes.push(cur);
  return takes.map((t, i) => ({
    id: `take-${String(i + 1).padStart(2, '0')}`,
    beats: t.beats,
  }));
}

/** One performance: every part of a take shares the film's (or the speaker's) style. Per-beat
 *  styles re-prompt the voice mid-take and make it drift; they are sent only when
 *  voice.perBeatStyle is set. */
function partStyle(voice: VoiceSettings, b: NarratedBeat): string {
  const own = voice.perBeatStyle ? b.style : undefined;
  const speaker =
    b.speaker === undefined ? undefined : voice.cast?.[b.speaker]?.style;
  return own ?? speaker ?? voice.style ?? '';
}

/** What a take asks the provider for; its hash caches the recording. */
export function takeSpec(
  sb: Pick<TakeStoryboard, 'voice'>,
  take: Take,
  provider: string,
): TakeSpec {
  const cast = sb.voice.cast
    ? Object.entries(sb.voice.cast).map(([speaker, c]) => ({
        speaker,
        voice: c.voice ?? sb.voice.voice,
      }))
    : null;
  return {
    provider,
    model: sb.voice.model,
    voice: sb.voice.voice,
    cast,
    language: sb.voice.language ?? null,
    style: sb.voice.style ?? '',
    parts: take.beats.map((b) => ({
      text: b.vo,
      style: partStyle(sb.voice, b),
      ...(cast ? { speaker: b.speaker } : {}),
    })),
    ...draftSettings(sb, provider),
  };
}

/** What changes a free draft take besides its words: the OS voice, its speed and the respellings it
 * reads. Part of a local take's hash, so editing `voice.pronounce` or `wpm` records it again. */
export function draftSettings(
  sb: Pick<TakeStoryboard, 'voice'>,
  provider: string,
): { draft?: DraftSettings } {
  if (provider !== 'local') return {};
  const { wpm, draftVoice, pronounce } = sb.voice;
  const cast = sb.voice.cast
    ? Object.fromEntries(
        Object.entries(sb.voice.cast).map(([k, c]): [string, string | null] => [
          k,
          c.draftVoice ?? null,
        ]),
      )
    : null;
  // In this order, without unset values: the take's hash depends on it.
  const set: DraftSettings = {};
  if (wpm != null) set.wpm = wpm;
  if (draftVoice != null) set.draftVoice = draftVoice;
  if (pronounce != null) set.pronounce = pronounce;
  if (cast != null) set.cast = cast;
  return Object.keys(set).length ? { draft: set } : {};
}

/** Each speaker's OS voice in a cast take. */
export function castVoices(
  sb: Pick<TakeStoryboard, 'voice'>,
  cast: readonly { speaker: string }[],
): Record<string, string> {
  const pool = ['Samantha', 'Daniel', 'Karen', 'Moira', 'Rishi', 'Tessa'];
  return Object.fromEntries(
    cast.map((c, i): [string, string] => [
      c.speaker,
      sb.voice.cast?.[c.speaker]?.draftVoice ?? pool[i % pool.length],
    ]),
  );
}

/** The OS voice a draft take speaks with: one name, or one per speaker for a cast. */
export function draftVoicesOf(
  sb: Pick<TakeStoryboard, 'voice'>,
  spec: Pick<TakeSpec, 'cast'>,
): OsVoice {
  if (!spec.cast) return sb.voice.draftVoice ?? 'system default';
  return castVoices(sb, spec.cast);
}
