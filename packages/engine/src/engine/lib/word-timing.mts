import crypto from 'node:crypto';
import fs from 'node:fs';
import type { Word } from '../domain.mjs';
import { isRecord } from './errors.mjs';

/** A transcript word: a token's text, or the token itself. */
export type ScriptWord = string | { w: string };
/** Anything with a spoken interval (selection needs no text). */
export interface Interval {
  t0: number;
  t1: number;
}

export const audioHash = (file: string): string =>
  crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
// Number words key as digits, so a cue of "18" finds a spoken "eighteen" and a recognizer's
// "7" lines up with a scripted "seven". Single words and hyphenated tens only.
const UNITS =
  'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(
    ' ',
  );
const TENS = 'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');
const NUMBER = new Map<string, string>([
  ...UNITS.map((w, i): [string, string] => [w, String(i)]),
  ...TENS.map((w, i): [string, string] => [w, String(20 + 10 * i)]),
  ...TENS.flatMap((t, i) =>
    UNITS.slice(1, 10).map((u, j): [string, string] => [
      t + u,
      String(21 + 10 * i + j),
    ]),
  ),
  ['hundred', '100'],
  ['thousand', '1000'],
]);
export const wordKey = (s: string | number): string => {
  const key = String(s)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
  return NUMBER.get(key) ?? key;
};
// Gemini writes offsets as "1.250s". Anything that is not a time becomes NaN, which
// validateWords refuses as an invalid interval.
function seconds(value: unknown): number {
  if (typeof value === 'string' && /^\d+(\.\d+)?s$/.test(value))
    return Number(value.slice(0, -1));
  return typeof value === 'number' ? value : NaN;
}
const field = (value: unknown, key: string): unknown =>
  isRecord(value) ? value[key] : undefined;
function list(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

/** The raw word entries of native words, Whisper/WhisperX JSON or Gemini REST steps. */
function rawWords(input: unknown): unknown {
  if (Array.isArray(input)) return input;
  const words = field(input, 'words');
  if (words != null) return words;
  const segments = field(input, 'segments');
  if (segments != null)
    return Array.isArray(segments)
      ? segments.flatMap((s: unknown) => list(field(s, 'words')))
      : segments;
  const steps = field(input, 'steps');
  if (!Array.isArray(steps)) return undefined;
  return steps
    .filter((s: unknown) => field(s, 'type') === 'model_output')
    .flatMap((s: unknown) => list(field(s, 'content')))
    .flatMap((c) => list(field(c, 'annotations')))
    .filter((a) => field(a, 'type') === 'word_info');
}

/** Accept native words, Whisper/WhisperX JSON or Gemini word_info annotations. */
export function normalizeWords(input: unknown): Word[] {
  const words = rawWords(input);
  if (!Array.isArray(words) || !words.length)
    throw new Error(
      'No word timestamps found; phrase timestamps are insufficient for speech-following text.',
    );
  return words.map((w: unknown) => ({
    w: String(
      field(w, 'w') ?? field(w, 'word') ?? field(w, 'text') ?? '',
    ).trim(),
    t0: seconds(
      field(w, 't0') ?? field(w, 'start') ?? field(w, 'start_offset'),
    ),
    t1: seconds(field(w, 't1') ?? field(w, 'end') ?? field(w, 'end_offset')),
  }));
}

const scriptText = (t: ScriptWord): string => (typeof t === 'string' ? t : t.w);

export function validateWords<W extends Word>(
  words: W[],
  tokens: readonly ScriptWord[],
  duration: number,
): W[] {
  if (words.length !== tokens.length)
    throw new Error(
      `Word alignment mismatch: ${words.length} timed words for ${tokens.length} transcript words. Review the transcript; timings are never spread to hide missing words.`,
    );
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!w.w || wordKey(w.w) !== wordKey(scriptText(tokens[i])))
      throw new Error(
        `Word alignment mismatch at ${i + 1}: "${w.w}" versus "${scriptText(tokens[i])}"`,
      );
    if (
      !Number.isFinite(w.t0) ||
      !Number.isFinite(w.t1) ||
      w.t0 < 0 ||
      w.t1 <= w.t0 ||
      w.t1 > duration + 0.005 ||
      (i && w.t0 < words[i - 1].t1)
    )
      throw new Error(
        `Invalid word interval at ${i + 1}; timestamps must be ordered, non-overlapping, and inside the audio.`,
      );
  }
  return words;
}

/** End-exclusive, gap-aware selection. Pure: random access and backward seeks are identical. */
export function activeWord(words: readonly Interval[], time: number): number {
  let lo = 0,
    hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].t0 <= time) lo = mid + 1;
    else hi = mid;
  }
  const i = lo - 1;
  return i >= 0 && time < words[i].t1 ? i : -1;
}
