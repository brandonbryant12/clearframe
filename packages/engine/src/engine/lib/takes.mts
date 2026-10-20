// Continuous narration: record a chapter in one take so the delivery flows from beat to beat,
// then split the take back into beats at frame-aligned pauses. Beats replay the take gaplessly;
// their word timings come from local Whisper when available (measured), else silence (estimated).
import fs from 'node:fs';
import path from 'node:path';
import * as Schema from 'effect/Schema';
import { errorMessage, isRecord } from './errors.mjs';
import { paths } from './project.mjs';
import { tokenize } from './timing-speech.mjs';
import { readPCM } from './levels.mjs';
import { hashOf, log, readJSON, writeJSON } from './util.mjs';
import { recordRate } from './voice-rates.mjs';
import { draftVoicesOf, planTakes, takeSpec } from './takes-plan.mjs';
import type { OsVoice, Take, TakeSpec, TakeStoryboard } from './takes-plan.mjs';
import type { PartBounds } from './takes-words.mjs';
import { draftTake } from './takes-draft.mjs';
import { heardWordsMany } from './takes-heard.mjs';
import { takeSpans, writeSlices } from './takes-split.mjs';
import type { PendingTake } from './takes-split.mjs';

export type {
  DraftSettings,
  NarratedBeat,
  OsVoice,
  Take,
  TakePart,
  TakeSpec,
  TakeStoryboard,
} from './takes-plan.mjs';
export {
  draftSettings,
  draftVoicesOf,
  planTakes,
  takeSpec,
} from './takes-plan.mjs';
export type { BeatSpan, PartBounds } from './takes-words.mjs';
export { fitWords, snapToPauses } from './takes-words.mjs';

export interface RecordTakesOptions {
  draft?: boolean;
  force?: boolean;
  synthesize: (spec: TakeSpec, wav: string) => Promise<unknown>;
}

/** The fields of `assets/vo/takes/<id>.json` that recording reuses. */
interface TakeMeta {
  hash?: string;
  bounds?: PartBounds | null;
  osVoice?: OsVoice | null;
}
const TakeMetaSchema: Schema.Codec<TakeMeta> = Schema.Struct({
  hash: Schema.optionalKey(Schema.String),
  bounds: Schema.optionalKey(
    Schema.NullOr(
      Schema.Array(
        Schema.Tuple([Schema.Finite, Schema.Finite]).pipe(Schema.mutable),
      ).pipe(Schema.mutable),
    ),
  ),
  osVoice: Schema.optionalKey(
    Schema.NullOr(
      Schema.Union([
        Schema.String,
        Schema.Record(Schema.String, Schema.String),
      ]),
    ),
  ),
});
const decodeTakeMeta = Schema.decodeUnknownSync(TakeMetaSchema);
function readTakeMeta(file: string): TakeMeta | null {
  const raw: unknown = readJSON(file, null);
  if (raw === null) return null;
  try {
    return decodeTakeMeta(raw);
  } catch (e) {
    throw new Error(
      `${file} is not a take record (${errorMessage(e)}); delete it to record the take again.`,
    );
  }
}
/** A metadata file as an object to compare fields against, or null when it is absent or not one. */
function readRecord(file: string): Record<string, unknown> | null {
  const raw: unknown = readJSON(file, null);
  return isRecord(raw) ? raw : null;
}

/**
 * Whether a take is already recorded for exactly this spec (take and every one of its lines). The
 * recorder skips such takes, so they cost nothing; budgets and estimates use the same test.
 */
export function takeCurrent(
  root: string,
  sb: Pick<TakeStoryboard, 'voice'>,
  take: Take,
  provider: string,
): boolean {
  const P = paths(root),
    hash = hashOf(takeSpec(sb, take, provider));
  const meta = readTakeMeta(path.join(P.vo, 'takes', `${take.id}.json`));
  return (
    meta?.hash === hash &&
    fs.existsSync(path.join(P.vo, 'takes', `${take.id}.wav`)) &&
    take.beats.every((b) => {
      const line = readRecord(path.join(P.vo, `${b.id}.json`))?.take;
      return (
        isRecord(line) &&
        line.hash === hash &&
        fs.existsSync(path.join(P.vo, `${b.id}.wav`))
      );
    })
  );
}

/** Whether a draft would replace a take some of whose lines are real recordings. */
function keepsRealTakes(voDir: string, take: Take): boolean {
  return take.beats.some((b) => {
    const recorded = readRecord(path.join(voDir, `${b.id}.json`))?.provider;
    return recorded === 'gemini' || recorded === 'imported';
  });
}

/** Where a recording of this take comes from, and what it reuses. */
interface TakeRecording {
  root: string;
  sb: TakeStoryboard;
  provider: string;
  dir: string;
  options: RecordTakesOptions;
}

/** Record one take that changed (or reuse its audio), noting it as soon as it exists. Null when
 *  the take is skipped: already current, or real takes a draft must not replace. */
async function recordTake(
  rec: TakeRecording,
  take: Take,
): Promise<PendingTake | null> {
  const { root, sb, provider, dir } = rec;
  const { draft, force, synthesize } = rec.options;
  const spec = takeSpec(sb, take, provider),
    hash = hashOf(spec);
  const wav = path.join(dir, `${take.id}.wav`),
    meta = readTakeMeta(path.join(dir, `${take.id}.json`));
  if (!force && takeCurrent(root, sb, take, provider)) return null;
  if (!force && draft && keepsRealTakes(paths(root).vo, take)) {
    log.dim(
      `  ${take.id}: keeping real takes (use --force to replace with a draft)`,
    );
    return null;
  }
  let bounds: PartBounds | null = null,
    // The OS voice that actually spoke a draft take. A reused take keeps its own record; one
    // recorded before voices were noted stays unknown.
    osVoice: OsVoice | null = null;
  if (!force && meta?.hash === hash && fs.existsSync(wav)) {
    bounds = meta.bounds ?? null;
    osVoice = meta.osVoice ?? null;
  } else if (provider === 'local') {
    osVoice = draftVoicesOf(sb, spec);
    bounds = await draftTake(sb, spec, wav);
  } else {
    await synthesize(spec, wav);
  }
  // Record the take as soon as it exists, so a later failure never pays for it twice.
  writeJSON(path.join(dir, `${take.id}.json`), {
    hash,
    provider,
    beats: take.beats.map((b) => b.id),
    bounds,
    ...(provider === 'local' ? { osVoice } : {}),
    createdAt: new Date().toISOString(),
  });
  return {
    take,
    spec,
    hash,
    wav,
    bounds,
    osVoice,
    tokensPerBeat: take.beats.map((b) => tokenize(b.vo).map((t) => t.w)),
  };
}

/** How a split take reports itself. */
function takeSummary(
  take: Take,
  duration: number,
  measured: boolean,
  interpolatedCount: number,
  pace: number | false | null,
): string {
  const words = interpolatedCount
    ? ` (${interpolatedCount} words interpolated; estimated timings)`
    : ' (all words measured)';
  const alignment = measured ? ` · Whisper alignment${words}` : '';
  const reads = pace ? ` · reads at ~${Math.round(pace)} wpm` : '';
  return `${take.id}: ${take.beats.length} beats · ${duration.toFixed(1)}s continuous take${alignment}${reads}`;
}

/** Record (or reuse) every take and split it into per-beat takes with word timings. */
export async function recordTakes(
  root: string,
  sb: TakeStoryboard,
  options: RecordTakesOptions,
): Promise<void> {
  const P = paths(root),
    dir = path.join(P.vo, 'takes'),
    fps = sb.format.fps;
  fs.mkdirSync(dir, { recursive: true });
  const provider = options.draft ? 'local' : sb.voice.provider;
  // Pass 1: record every take that changed.
  const pending: PendingTake[] = [];
  for (const take of planTakes(sb)) {
    const recorded = await recordTake(
      { root, sb, provider, dir, options },
      take,
    );
    if (recorded) pending.push(recorded);
  }
  // Pass 2: one recognizer pass for all of them.
  const heard = await heardWordsMany(
    pending.map((x) => x.wav),
    pending.map((x) => x.tokensPerBeat.flat()),
    sb.voice.language,
  );
  // Pass 3: split each take into beats.
  for (const [n, item] of pending.entries()) {
    const { take, hash, wav, bounds } = item;
    const audio = readPCM(wav),
      duration = audio.pcm.length / 2 / audio.rate;
    const { spans, measured } = await takeSpans(
      item,
      heard.aligned[n],
      sb.voice.wpm,
      duration,
    );
    const interpolatedCount = writeSlices(
      { pending: item, provider, measured, heardBy: heard.provider },
      audio,
      spans,
      { fps, voDir: P.vo },
    );
    writeJSON(path.join(dir, `${take.id}.json`), {
      hash,
      provider,
      beats: take.beats.map((b) => b.id),
      duration,
      bounds,
      createdAt: new Date().toISOString(),
    });
    // Teach the drafts how fast this voice really reads.
    const pace =
      provider !== 'local' &&
      recordRate(sb.voice, take.beats.map((b) => b.vo).join(' '), duration);
    log.ok(takeSummary(take, duration, measured, interpolatedCount, pace));
  }
}
