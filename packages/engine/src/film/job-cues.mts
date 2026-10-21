import type { TimedBeat as TimingBeat } from '../engine/domain.mjs';
import type { CueResolver } from './types.mjs';

import { type CueContext, type ItemCue } from './job-types.mjs';

import { findWord } from '../engine/lib/timing.mjs';

/**
 * Scene seconds for a structured item's time: `{cue, after}` (a named moment), `{say, after}` (a
 * spoken word, measured) or `{at}` (seconds); `fallback` when it gives none.
 */
export function timeOf(
  item: ItemCue,
  { moments, spoken, fallback = 0, where = 'cue', used }: CueContext,
): number {
  if (item == null) return fallback;
  if (typeof item === 'number' || typeof item === 'string') return spoken(item);
  const given = (['cue', 'say', 'at'] as const).filter((k) => item[k] != null);
  if (given.length > 1) throw new Error(`${where} takes one of say, at or cue`);
  if (item.cue != null) {
    if (!moments?.has(item.cue))
      throw new Error(
        `${where}.cue "${item.cue}" names no moment${moments?.size ? ` (this beat's moments: ${[...moments.keys()].join(', ')})` : '; declare it in the canvas props moments'}`,
      );
    used?.add(item.cue);
    return Math.max(0, (moments.get(item.cue) ?? 0) + (item.after ?? 0));
  }
  if (item.say != null)
    return Math.max(0, spoken(item.say) + (item.after ?? 0));
  if (item.at != null) return spoken(item.at);
  return fallback;
}

/** Seconds or a spoken word/phrase → scene seconds. */
/** Spoken cues a beat says more than once, by beat (see cueResolver). */
export const ambiguous = new WeakMap<TimingBeat, Set<string>>();

export function cueResolver(b: TimingBeat, frame: number): CueResolver {
  return (value, fallback = 0.35) => {
    if (value == null) return Math.min(fallback, Math.max(0, b.dur - frame));
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0 || value >= b.dur)
        throw new Error('Cue seconds must lie within the beat');
      return value;
    }
    const t = findWord(b.vo?.words ?? [], String(value));
    // A word said twice cues on its first saying: "New" in "every new parent… New request"
    // landed four seconds early. Noted once per beat (prepareBeat reports it).
    if (t != null && findWord(b.vo?.words ?? [], String(value), 1) != null) {
      const words = ambiguous.get(b) ?? new Set<string>();
      words.add(String(value));
      ambiguous.set(b, words);
    }
    if (t == null) {
      const said = (b.vo?.words ?? []).map((w) => w.w).join(' ');
      const excerpt = said.length > 140 ? `${said.slice(0, 140)}…` : said;
      const narration = said
        ? ` ("${excerpt}")`
        : ' (the beat has no narration)';
      throw new Error(
        `Spoken cue "${value}" not found in this beat's narration${narration}: use a word it says, spelled as it is written there`,
      );
    }
    return Math.max(0, t - b.start);
  };
}
