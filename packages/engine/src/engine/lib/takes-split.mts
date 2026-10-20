// A recorded take split back into beats: where each beat's stretch of the take lies (from known
// part bounds, measured words or the take's own pauses), then frame-aligned slices that tile it.
import fs from 'node:fs';
import path from 'node:path';
import type { TimeRange } from '../domain.mjs';
import { speechSegments } from './audio-voice.mjs';
import { cutPoints } from './ingest.mjs';
import type { PCM } from './levels.mjs';
import { alignWords, estimateDuration } from './timing-speech.mjs';
import { hashOf, pcmToWav, writeJSON } from './util.mjs';
import { audioHash } from './word-timing.mjs';
import type { ScriptAlignment } from './word-align.mjs';
import type { OsVoice, Take, TakeSpec, NarratedBeat } from './takes-plan.mjs';
import { fitWords, snapToPauses } from './takes-words.mjs';
import type { BeatSpan, PartBounds } from './takes-words.mjs';

/** A recorded take waiting to be split into beats. */
export interface PendingTake {
  take: Take;
  spec: TakeSpec;
  hash: string;
  wav: string;
  bounds: PartBounds | null;
  osVoice: OsVoice | null;
  tokensPerBeat: string[][];
}

/** Where each beat lies in a take, and whether its words were heard. */
interface TakeSpans {
  spans: BeatSpan[];
  measured: boolean;
}

/** A silence between two speech segments: its middle and its length. */
interface Pause {
  at: number;
  len: number;
}

/** The take's measured words split back into beats, inside known part bounds when there are any. */
async function heardSpans(
  { bounds, tokensPerBeat, wav }: PendingTake,
  aligned: ScriptAlignment,
): Promise<BeatSpan[]> {
  let k = 0;
  const groups = tokensPerBeat.map((t) => {
    const g = aligned.words.slice(k, k + t.length);
    k += t.length;
    return g;
  });
  const spans = groups.map((g, i) => ({
    start: bounds?.[i]?.[0] ?? g[0].t0,
    end: bounds?.[i]?.[1] ?? g[g.length - 1].t1,
    words: g,
  }));
  // Without known part boundaries, cut in the pauses the voice made between lines.
  if (!bounds && spans.length > 1)
    snapToPauses(spans, (await speechSegments(wav)).segments);
  return spans;
}

/** The pause nearest where the expected lengths put a cut, after the last one picked. */
function nearestPause(
  gaps: readonly Pause[],
  picks: readonly Pause[],
  expected: number,
): Pause | undefined {
  return gaps
    .filter(
      (g) =>
        !picks.includes(g) &&
        (!picks.length || g.at > picks[picks.length - 1].at),
    )
    .sort(
      (a, b) =>
        Math.abs(a.at - expected) -
        Math.abs(b.at - expected) -
        0.5 * (a.len - b.len),
    )[0];
}

/** No recognizer: the take's pauses, matched to the parts by expected length. */
async function pauseSpans(
  { take, wav }: PendingTake,
  wpm: number,
  duration: number,
): Promise<BeatSpan[]> {
  const { segments } = await speechSegments(wav);
  const weights = take.beats.map((b) => estimateDuration(b.vo, wpm)),
    total = weights.reduce((a, b) => a + b, 0);
  const gaps: Pause[] = segments.slice(1).map((s, i) => ({
    at: (segments[i].end + s.start) / 2,
    len: s.start - segments[i].end,
  }));
  let acc = 0;
  const picks: Pause[] = [];
  for (let i = 0; i < take.beats.length - 1; i++) {
    acc += weights[i];
    const best = nearestPause(gaps, picks, (duration * acc) / total);
    if (!best)
      throw new Error(
        `${take.id}: could not find a pause between beats; record per beat (voice.takes: "beat") or install Whisper.`,
      );
    picks.push(best);
  }
  const edges = [0, ...picks.map((g) => g.at), duration];
  return take.beats.map((_, i) => ({
    start: edges[i],
    end: edges[i + 1],
    words: null,
  }));
}

export async function takeSpans(
  pending: PendingTake,
  aligned: ScriptAlignment | null,
  wpm: number,
  duration: number,
): Promise<TakeSpans> {
  if (aligned)
    return { spans: await heardSpans(pending, aligned), measured: true };
  if (pending.bounds)
    return {
      spans: pending.bounds.map(([a, e]) => ({
        start: a,
        end: e,
        words: null,
      })),
      measured: false,
    };
  return {
    spans: await pauseSpans(pending, wpm, duration),
    measured: false,
  };
}

/** The OS voice that spoke a beat of a draft take: its speaker's in a cast. */
function spokeWith(osVoice: OsVoice | null, b: NarratedBeat): string | null {
  if (typeof osVoice !== 'object' || !osVoice) return osVoice;
  return b.speaker === undefined ? null : (osVoice[b.speaker] ?? null);
}

/** What a beat slice's metadata records about the take it came from. */
interface SliceSource {
  pending: PendingTake;
  provider: string;
  measured: boolean;
  heardBy: string | null;
}

/** One beat's slice of the take on disk, with its words on the slice's own clock. */
function writeSlice(
  source: SliceSource,
  { pcm, rate }: PCM,
  i: number,
  range: TimeRange,
  span: BeatSpan,
  voDir: string,
): void {
  const { pending, provider, measured, heardBy } = source;
  const { take, spec, hash, osVoice } = pending;
  const b = take.beats[i];
  const a = Math.round(range.start * rate),
    e = Math.round(range.end * rate);
  const slice = Buffer.alloc(Math.max(0, e - a) * 2);
  pcm.copy(slice, 0, a * 2, Math.min(pcm.length, e * 2));
  const file = path.join(voDir, `${b.id}.wav`);
  fs.writeFileSync(file, pcmToWav(slice, { sampleRate: rate }));
  const sliceDur = slice.length / 2 / rate;
  const words = span.words ? fitWords(span.words, range.start, sliceDur) : null;
  const interpolated = words ? words.filter((w) => w.estimated).length : null;
  const clean = words?.map(({ estimated: _estimated, ...w }) => w);
  const segs = [
    { start: span.start - range.start, end: span.end - range.start },
  ];
  const local = provider === 'local';
  writeJSON(path.join(voDir, `${b.id}.json`), {
    hash,
    textHash: hashOf(b.vo),
    provider,
    model: local ? 'os-tts' : spec.model,
    // A draft take is the OS voice that spoke it (null if never recorded); the Google voice and
    // style are settings, not what it used.
    voice: local ? null : spec.voice,
    ...(local ? { osVoice: spokeWith(osVoice, b) } : {}),
    style: local ? '' : spec.parts[i].style,
    text: b.vo,
    duration: sliceDur,
    take: { id: take.id, index: i, count: take.beats.length, hash },
    words: clean ?? alignWords(b.vo, segs, sliceDur),
    ...(measured && clean
      ? {
          alignment: {
            kind: interpolated ? 'estimated' : 'measured',
            provider: heardBy,
            audioHash: audioHash(file),
            ...(interpolated ? { interpolatedWords: interpolated } : {}),
          },
        }
      : {}),
    createdAt: new Date().toISOString(),
  });
}

/** Frame-aligned cuts inside the pauses between beats, so the slices tile the take; each slice
 *  is written beside the beat it voices. Returns how many words were interpolated. */
export function writeSlices(
  source: SliceSource,
  audio: PCM,
  spans: readonly BeatSpan[],
  { fps, voDir }: { fps: number; voDir: string },
): number {
  const duration = audio.pcm.length / 2 / audio.rate;
  const cuts = cutPoints(
    spans.map((p) => [
      { t0: p.start, t1: p.start },
      { t0: p.end, t1: p.end },
    ]),
    duration,
    fps,
  );
  source.pending.take.beats.forEach((_, i) =>
    writeSlice(
      source,
      audio,
      i,
      { start: cuts[i], end: cuts[i + 1] },
      spans[i],
      voDir,
    ),
  );
  return spans.reduce(
    (n, p) => n + (p.words?.filter((w) => w.estimated).length ?? 0),
    0,
  );
}
