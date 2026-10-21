// Spoken text as tokens: syllable weights, the pauses punctuation and inline tags leave, and
// word timings spread over a duration or over detected speech segments.
import type { TimeRange, Word } from '../domain.mjs';
import { round } from './util.mjs';

/** A spoken word with its syllable weight and the pause after it, in seconds. */
export interface Token {
  w: string;
  syl: number;
  pause: number;
}

const PAUSES: readonly (readonly [RegExp, number])[] = [
  [/(\.\.\.|…)$/, 0.45],
  [/[.!?]["')\]]*$/, 0.38],
  [/[;:]$/, 0.26],
  [/(—|--|–)$/, 0.24],
  [/,$/, 0.17],
];
const TAG_PAUSES = new Map<string, number>([
  ['short pause', 0.35],
  ['long pause', 0.8],
  ['breath', 0.3],
  ['heavy breath', 0.45],
  ['sigh', 0.5],
  ['exhales', 0.4],
]);
const DASHES = new Set(['—', '--', '–']);
const last = <T,>(list: readonly T[]): T => list[list.length - 1];

/** Adds a pause after the last token, when there is one. */
function pauseAfterLast(tokens: Token[], pause: number): void {
  if (tokens.length) last(tokens).pause += pause;
}

/** Spoken text → tokens with syllable weights and trailing pauses. Inline <tags> become pauses; |backchannels| are dropped. */
export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const cleaned = String(text).replace(/\|[^|]*\|/g, ' ');
  for (const part of cleaned.split(/(<[^>]+>)/)) {
    const tag = part.match(/^<([^>]+)>$/);
    if (tag) {
      pauseAfterLast(
        tokens,
        TAG_PAUSES.get(tag[1].trim().toLowerCase()) ?? 0.15,
      );
      continue;
    }
    for (const raw of part.split(/\s+/).filter(Boolean)) {
      if (DASHES.has(raw)) {
        pauseAfterLast(tokens, 0.24);
        continue;
      }
      const pause = PAUSES.find(([re]) => re.test(raw))?.[1] ?? 0;
      tokens.push({ w: raw, syl: syllables(raw), pause });
    }
  }
  return tokens;
}

/** Spoken weight of a lower-cased word that contains digits: figures, decimals, units. */
function figureSyllables(w: string): number {
  const [int, dec = ''] = w.replace(/[^\d.]/g, '').split('.');
  let s =
    Math.min(int.length, 3) * 1.8 +
    Math.max(0, int.length - 3) * 1.1 +
    (int.length > 3 ? 2 : 0);
  s += dec.length ? 1 + dec.length * 1.2 : 0;
  if (w.includes('%')) s += 2;
  if (w.includes('$') || w.includes('€') || w.includes('£')) s += 1.5;
  if (/\d(k|m|bn|b|x)\b/.test(w)) s += 1.5;
  return Math.max(1, s);
}

export function syllables(word: string): number {
  const w = word.toLowerCase();
  if (/\d/.test(w)) return figureSyllables(w);
  const letters = w.replace(/[^a-z]/g, '');
  if (!letters) return 0.5;
  if (/^[A-Z]{2,5}$/.test(word.replace(/[^A-Za-z]/g, '')))
    return letters.length; // acronyms are spelled out
  let s = (letters.match(/[aeiouy]+/g) ?? []).length;
  if (/[^aeiou]e$/.test(letters) && s > 1) s -= 1;
  if (/[^aeiou]le$/.test(letters)) s += 1;
  return Math.max(1, s);
}

const secPerSyl = (wpm: number): number => 60 / (wpm * 1.6);

/** Estimated spoken duration of `text` at `wpm` (used until real audio exists). */
export function estimateDuration(text: string, wpm = 150): number {
  const toks = tokenize(text);
  if (!toks.length) return 0;
  const speech = toks.reduce((a, t) => a + t.syl, 0) * secPerSyl(wpm);
  const pauses = toks.slice(0, -1).reduce((a, t) => a + t.pause, 0);
  return speech + pauses;
}

/** Spread words over [t0, t1] proportionally to syllables, honouring punctuation pauses. */
export function distributeWords(
  tokens: readonly Token[],
  t0: number,
  t1: number,
): Word[] {
  if (!tokens.length) return [];
  const weights = tokens.map((t, i) => ({
    speak: t.syl,
    gap: i < tokens.length - 1 ? t.pause * 6 : 0,
  }));
  const total = weights.reduce((a, w) => a + w.speak + w.gap, 0) || 1;
  const scale = (t1 - t0) / total;
  let cursor = t0;
  return tokens.map((t, i) => {
    const s = cursor;
    const e = s + weights[i].speak * scale;
    cursor = e + weights[i].gap * scale;
    return { w: t.w, t0: round(s), t1: round(e) };
  });
}

/** Tokens grouped into phrases, each ending at a pause of a comma or longer. */
function phrasesOf(tokens: readonly Token[]): Token[][] {
  const phrases: Token[][] = [];
  let cur: Token[] = [];
  for (const t of tokens) {
    cur.push(t);
    if (t.pause >= 0.17) {
      phrases.push(cur);
      cur = [];
    }
  }
  if (cur.length) phrases.push(cur);
  return phrases;
}

/** Index of the smallest score among `count` candidates (the first, on a tie). */
function weakest(count: number, score: (i: number) => number): number {
  let best = 0,
    least = Infinity;
  for (let i = 0; i < count; i++) {
    const s = score(i);
    if (s < least) {
      least = s;
      best = i;
    }
  }
  return best;
}

/**
 * Align words to real audio using detected speech segments (from ffmpeg silencedetect).
 * Phrases (split at punctuation) are matched to speech segments; words are spread inside each.
 */
export function alignWords(
  text: string,
  segments: readonly TimeRange[],
  duration: number,
): Word[] {
  const tokens = tokenize(text);
  if (!tokens.length) return [];
  const segs: TimeRange[] = segments
    .filter((s) => s.end - s.start > 0.06)
    .map((s) => ({ ...s }));
  if (!segs.length) return distributeWords(tokens, 0, duration);

  const phrases = phrasesOf(tokens);
  // Join the segments with the shortest silence between them, then the phrases with the
  // weakest pause after them, until there is one segment per phrase.
  while (segs.length > phrases.length) {
    const best = weakest(
      segs.length - 1,
      (i) => segs[i + 1].start - segs[i].end,
    );
    segs.splice(best, 2, { start: segs[best].start, end: segs[best + 1].end });
  }
  while (phrases.length > segs.length) {
    const best = weakest(phrases.length - 1, (i) => last(phrases[i]).pause);
    phrases.splice(best, 2, [...phrases[best], ...phrases[best + 1]]);
  }
  return phrases.flatMap((p, i) =>
    distributeWords(p, segs[i].start, segs[i].end),
  );
}
