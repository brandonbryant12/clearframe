// Timed words from a recording's transcript, its script's speakers, and the beats they form.
import { wordKey } from './word-timing.mjs';
import { alignScript } from './word-align.mjs';
import { isRecord } from './errors.mjs';
import type { Word } from '../domain.mjs';

/** A transcript word on the recording's clock; `estimated` marks interpolated timings. */
export interface TranscriptWord extends Word {
  estimated?: boolean;
  speaker?: string;
}
export interface Turn {
  speaker: string;
  text: string;
}
export interface ScriptToken {
  w: string;
  speaker: string;
}
export interface ScriptedWords {
  words: TranscriptWord[];
  interpolated: number;
  matched: number;
}
export interface SegmentOptions {
  min?: number;
  target?: number;
  max?: number;
  pause?: number;
}

interface DraftWord {
  w: string;
  t0: number | null;
  t1: number | null;
  estimated?: boolean;
  speaker?: string;
}
type Aligned = {
  words: (Word & { estimated?: boolean })[];
  interpolated: number;
  matched: number;
};

const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

/** Gemini interaction steps: the word_info annotations of its model output. */
function stepWords(steps: unknown): unknown[] {
  return records(steps)
    .filter((s) => s.type === 'model_output')
    .flatMap((s) => records(s.content))
    .flatMap((c) => records(c.annotations))
    .filter((a) => a.type === 'word_info');
}

/** The word list in WhisperX, Gemini, segment or plain [{w,t0,t1}] transcript JSON. */
function transcriptEntries(input: unknown): unknown {
  if (Array.isArray(input)) return input;
  if (!isRecord(input)) return undefined;
  const words =
    input.words ??
    (Array.isArray(input.segments)
      ? records(input.segments).flatMap((s) =>
          records(s.words ?? []).map((w) => ({ speaker: s.speaker, ...w })),
        )
      : undefined);
  if (!words && input.steps) return stepWords(input.steps);
  return words;
}

const secs = (v: unknown): number =>
  typeof v === 'string' && /^\d+(\.\d+)?s$/.test(v)
    ? Number(v.slice(0, -1))
    : Number(v);

function draftWords(words: unknown[]): DraftWord[] {
  const out: DraftWord[] = [];
  for (const word of words.filter(isRecord)) appendDraftWord(out, word);
  return out;
}

// Untimed words share the gap between their timed neighbours (and are flagged as estimates).
// A missing time counts as 0, as JavaScript arithmetic on the original nulls did.
function fillUntimed(out: DraftWord[]): void {
  for (let i = 0; i < out.length; i++) {
    if (out[i].t0 != null) continue;
    let j = i;
    while (j < out.length && out[j].t0 == null) j++;
    const from = i ? (out[i - 1].t1 ?? 0) : 0,
      to = j < out.length ? (out[j].t0 ?? 0) : from + 0.3 * (j - i),
      step = Math.max(0.02, (to - from) / (j - i));
    for (let k = i; k < j; k++) {
      const t0 = from + step * (k - i);
      out[k].t0 = t0;
      out[k].t1 = t0 + step;
    }
    i = j - 1;
  }
}

/** Timed words with optional speakers from common transcript JSON shapes. */
export function timedWords(input: unknown): TranscriptWord[] {
  const words = transcriptEntries(input);
  if (!Array.isArray(words) || !words.length)
    throw new Error('No word timestamps found in the transcript JSON.');
  const draft = draftWords(words);
  fillUntimed(draft);
  const out: TranscriptWord[] = draft.map((w) => ({
    ...w,
    t0: w.t0 ?? 0,
    t1: w.t1 ?? 0,
  }));
  for (let i = 1; i < out.length; i++) {
    if (out[i].t0 < out[i - 1].t1) out[i].t0 = out[i - 1].t1;
    if (out[i].t1 <= out[i].t0) out[i].t1 = out[i].t0 + 0.02;
  }
  return out;
}

/** Speaker turns from a script: JSON [{speaker, text}] or lines like "HOST: text". */
export function scriptTurns(input: unknown): Turn[] {
  if (Array.isArray(input))
    return input.map((entry: unknown) => {
      const t = isRecord(entry) ? entry : {};
      return {
        speaker: String(t.speaker ?? t.role ?? t.name),
        text: String(t.text ?? t.line ?? ''),
      };
    });
  const turns: Turn[] = [];
  for (const line of String(input).split(/\n+/)) {
    const m = line.match(/^\s*\**([\p{L}\p{N} ._-]{1,30}?)\**\s*:\s*(.+)$/u);
    const last = turns.at(-1);
    if (m) turns.push({ speaker: m[1].trim(), text: m[2] });
    else if (last && line.trim()) last.text += ' ' + line.trim();
  }
  if (!turns.length)
    throw new Error(
      'No speaker turns found; use lines like "HOST: text" or JSON [{speaker, text}].',
    );
  return turns;
}

/** Script words with their speakers; punctuation-only tokens join the previous word. */
export function scriptTokens(turns: Turn[]): ScriptToken[] {
  const out: ScriptToken[] = [];
  for (const t of turns)
    for (const w of t.text.split(/\s+/).filter(Boolean)) {
      const last = out.at(-1);
      if (wordKey(w)) out.push({ w, speaker: t.speaker });
      else if (last) last.w += w;
    }
  return out;
}

/**
 * Words for a recording with a known script: the script's spelling and speakers, the
 * recognizer's timings. Words the recognizer never heard are interpolated and flagged.
 */
export function scriptedWords(
  heard: TranscriptWord[],
  turns: Turn[],
): ScriptedWords {
  const tokens = scriptTokens(turns);
  const { words, interpolated, matched }: Aligned = alignScript(
    tokens.map((t) => t.w),
    heard,
  );
  return {
    words: words.map((w, k) => ({ ...w, speaker: tokens[k].speaker })),
    interpolated,
    matched,
  };
}

type SpokenWord = Word & { speaker?: string | null };

function breaksBefore(
  w: SpokenWord,
  prev: SpokenWord,
  first: SpokenWord,
  o: Required<SegmentOptions>,
): boolean {
  const d = prev.t1 - first.t0,
    gap = w.t0 - prev.t1;
  const sentence = /[.!?]["')\]”’]*$/.test(prev.w),
    clause = /[,;:—–]["')\]”’]*$/.test(prev.w);
  return (
    (w.speaker ?? null) !== (prev.speaker ?? null) ||
    (sentence && d >= o.min) ||
    (gap >= o.pause && d >= o.min) ||
    (clause && d >= o.target) ||
    w.t1 - first.t0 > o.max
  );
}

/**
 * Group words into beats: a new beat at a speaker change, after a sentence or a pause once
 * the beat is long enough, or before it grows past `max` seconds (preferring a comma).
 */
export function segmentWords<W extends SpokenWord>(
  words: W[],
  { min = 2.2, target = 5, max = 8.5, pause = 0.55 }: SegmentOptions = {},
): W[][] {
  const options = { min, target, max, pause };
  const segs: W[][] = [];
  let cur: W[] = [];
  for (const w of words) {
    const prev = cur.at(-1);
    if (prev && breaksBefore(w, prev, cur[0], options)) {
      segs.push(cur);
      cur = [];
    }
    cur.push(w);
  }
  if (cur.length) segs.push(cur);
  // Fold fragments under a second into the previous beat of the same speaker.
  for (let i = segs.length - 1; i > 0; i--) {
    const s = segs[i],
      p = segs[i - 1];
    if (
      s[s.length - 1].t1 - s[0].t0 < 1 &&
      (s[0].speaker ?? null) === (p[0].speaker ?? null)
    ) {
      p.push(...s);
      segs.splice(i, 1);
    }
  }
  return segs;
}

/** Frame-aligned cut points inside the pauses between beats, so slices tile the recording exactly. */
export function cutPoints(
  segs: readonly (readonly Pick<Word, 't0' | 't1'>[])[],
  duration: number,
  fps: number,
): number[] {
  const cuts = [0];
  const last = (): number => cuts[cuts.length - 1];
  for (let i = 1; i < segs.length; i++) {
    const before = segs[i - 1];
    const end = before[before.length - 1].t1,
      start = segs[i][0].t0,
      mid = (end + start) / 2;
    let t = Math.round(mid * fps) / fps;
    if (t < end && Math.ceil(end * fps) / fps <= start)
      t = Math.ceil(end * fps) / fps;
    if (t > start && Math.floor(start * fps) / fps >= end)
      t = Math.floor(start * fps) / fps;
    cuts.push(Math.max(t, last() + 1 / fps));
  }
  cuts.push(Math.max(Math.ceil(duration * fps) / fps, last() + 1 / fps));
  return cuts;
}

function appendDraftWord(
  out: DraftWord[],
  w: Readonly<Record<string, unknown>>,
): void {
  const text = String(w.w ?? w.word ?? w.text ?? '').trim(),
    t0 = secs(w.t0 ?? w.start ?? w.start_offset),
    t1 = secs(w.t1 ?? w.end ?? w.end_offset);
  const speaker = w.speaker ?? w.speaker_id ?? w.spk ?? null;
  if (!text) return;
  const last = out.at(-1);
  // Punctuation-only tokens join the previous word so beat text and timings stay aligned.
  if (!wordKey(text) && last) {
    last.w += text;
    if (Number.isFinite(t1)) last.t1 = Math.max(last.t1 ?? 0, t1);
    return;
  }
  if (!wordKey(text)) return;
  // Recognizers leave some words untimed (WhisperX digits) or zero-length: keep them, fill below.
  const timed = Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0;
  out.push({
    w: text,
    t0: timed ? t0 : null,
    t1: timed ? t1 : null,
    ...(timed ? {} : { estimated: true }),
    ...(speaker != null ? { speaker: String(speaker) } : {}),
  });
}
