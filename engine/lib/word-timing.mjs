import crypto from 'node:crypto';
import fs from 'node:fs';
export const audioHash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
// Number words key as digits, so a cue of "18" finds a spoken "eighteen" and a recognizer's
// "7" lines up with a scripted "seven". Single words and hyphenated tens only.
const UNITS =
  'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(
    ' ',
  );
const TENS = 'twenty thirty forty fifty sixty seventy eighty ninety'.split(' ');
const NUMBER = new Map([
  ...UNITS.map((w, i) => [w, String(i)]),
  ...TENS.map((w, i) => [w, String(20 + 10 * i)]),
  ...TENS.flatMap((t, i) => UNITS.slice(1, 10).map((u, j) => [t + u, String(21 + 10 * i + j)])),
  ['hundred', '100'],
  ['thousand', '1000'],
]);
export const wordKey = s => {
  const key = String(s)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
  return NUMBER.get(key) ?? key;
};
const seconds = value =>
  typeof value === 'string' && /^\d+(\.\d+)?s$/.test(value) ? Number(value.slice(0, -1)) : value;

/** Accept native words, Whisper/WhisperX JSON or Gemini word_info annotations. */
export function normalizeWords(input) {
  let words = Array.isArray(input) ? input : (input?.words ?? input?.segments?.flatMap(s => s.words ?? []));
  if (!words && input?.steps)
    words = input.steps
      .filter(s => s.type === 'model_output')
      .flatMap(s => s.content ?? [])
      .flatMap(c => c.annotations ?? [])
      .filter(a => a.type === 'word_info');
  if (!Array.isArray(words) || !words.length)
    throw new Error('No word timestamps found; phrase timestamps are insufficient for speech-following text.');
  return words.map(w => ({
    w: String(w.w ?? w.word ?? w.text ?? '').trim(),
    t0: seconds(w.t0 ?? w.start ?? w.start_offset),
    t1: seconds(w.t1 ?? w.end ?? w.end_offset),
  }));
}

export function validateWords(words, tokens, duration) {
  if (words.length !== tokens.length)
    throw new Error(
      `Word alignment mismatch: ${words.length} timed words for ${tokens.length} transcript words. Review the transcript; timings are never spread to hide missing words.`,
    );
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!w.w || wordKey(w.w) !== wordKey(tokens[i].w ?? tokens[i]))
      throw new Error(`Word alignment mismatch at ${i + 1}: "${w.w}" versus "${tokens[i].w ?? tokens[i]}"`);
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
export function activeWord(words, time) {
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
