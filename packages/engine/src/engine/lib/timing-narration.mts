// A beat's narration as timing reads it: the recorded take when its metadata is for these words,
// with measured word timings only while they still belong to its audio; otherwise an estimate.
import fs from 'node:fs';
import path from 'node:path';
import type { VoiceMetadata, Word } from '../domain.mjs';
import { decodeVoiceMetadata } from '../schemas.mjs';
import { errorMessage, isRecord } from './errors.mjs';
import { paths } from './project.mjs';
import { hashOf, readJSON, wavDuration } from './util.mjs';
import { audioHash, validateWords } from './word-timing.mjs';
import {
  distributeWords,
  estimateDuration,
  tokenize,
} from './timing-speech.mjs';

/** Where a beat sits in its continuous take. */
export interface TakePosition {
  index: number;
  count: number;
}

/** A beat's narration: a recorded take, or an estimate from its words until one exists. */
export interface Narration {
  src: string | null;
  duration: number;
  words: Word[];
  estimated: boolean;
  provider?: string | null;
  wordTiming?: 'estimated' | 'measured';
  alignmentIssue?: string;
  take?: TakePosition;
  stale?: string;
}

/** Measured words when they still belong to this audio and text; otherwise an estimate and why. */
function checkedWords(
  meta: VoiceMetadata,
  file: string,
  text: string,
  duration: number,
): Pick<Narration, 'words' | 'wordTiming' | 'alignmentIssue'> {
  const words = meta.words ?? distributeWords(tokenize(text), 0, duration);
  if (meta.alignment?.kind !== 'measured')
    return { words, wordTiming: 'estimated' };
  try {
    if (meta.alignment.audioHash !== audioHash(file))
      throw new Error('audio changed after alignment');
    validateWords(words, tokenize(text), duration);
    return { words, wordTiming: 'measured' };
  } catch (e) {
    return {
      words: distributeWords(tokenize(text), 0, duration),
      wordTiming: 'estimated',
      alignmentIssue: errorMessage(e),
    };
  }
}

/** A recorded take whose metadata is for this narration's words. */
function recordedVoice(
  id: string,
  file: string,
  text: string,
  raw: unknown,
): Narration {
  let meta: VoiceMetadata;
  try {
    meta = decodeVoiceMetadata(raw);
  } catch (e) {
    throw new Error(
      `${id}: narration metadata is invalid (${errorMessage(e)}); import or regenerate it.`,
    );
  }
  const duration = wavDuration(file);
  if (duration === null || !Number.isFinite(duration) || duration <= 0)
    throw new Error(
      `${id}: narration WAV is empty or invalid; import or regenerate it.`,
    );
  return {
    src: `assets/vo/${id}.wav`,
    duration,
    ...checkedWords(meta, file, text, duration),
    estimated: false,
    provider: meta.provider,
    take: takePosition(meta.take),
  };
}

function takePosition(take: VoiceMetadata['take']): TakePosition | undefined {
  if (take?.index === undefined || take.count === undefined) return undefined;
  return { ...take, index: take.index, count: take.count };
}

export function voiceFor(
  root: string,
  id: string,
  text: string,
  wpm: number,
): Narration {
  const p = paths(root);
  const file = path.join(p.vo, `${id}.wav`);
  const raw: unknown = readJSON(path.join(p.vo, `${id}.json`), null);
  // Metadata for other words (or none) means this take is not this narration.
  const current = isRecord(raw) && raw.textHash === hashOf(text);
  if (fs.existsSync(file) && current) return recordedVoice(id, file, text, raw);
  const duration = estimateDuration(text, wpm);
  return {
    src: null,
    duration,
    words: distributeWords(tokenize(text), 0, duration),
    estimated: true,
    stale: fs.existsSync(file)
      ? 'narration text changed since this take was recorded'
      : undefined,
  };
}
