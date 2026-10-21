import fs from 'node:fs';
import path from 'node:path';
import { parsePCM } from '../levels.mjs';
import { round } from '../util.mjs';

import {
  readJSONFile,
  sha256,
  sha256File,
  writeJSONAtomic,
} from '../store.mjs';
import { isRecord } from '../errors.mjs';
import {
  SOURCE,
  isRecorded,
  metaPath,
  readMeta,
  readStoryboardFile,
  readTranscript,
} from '../recording-model.mjs';
import type {
  RecordedMeta,
  Transcript,
  TranscriptWord,
} from '../recording-model.mjs';
import type { Beat } from '../../domain.mjs';
import type { SourceAudio, MasterState } from './contracts.mjs';

// ------------------------------------------------------------------ the source

export function loadSource(root: string): SourceAudio {
  const file = path.join(root, SOURCE);
  if (!fs.existsSync(file))
    throw new Error(
      'No source/recording.wav: recording edits work on projects made with ingest --audio.',
    );
  const bytes = fs.readFileSync(file);
  const { rate, pcm } = parsePCM(bytes, SOURCE);
  return { file, rate, pcm, samples: pcm.length / 2, sha: sha256(bytes) };
}

/**
 * The master as it is: its SHA-256, and whether source/recording.json (written at ingest)
 * still describes it. Every beat is rebuilt from this file, so a replaced master is caught
 * by its bytes, even when its record was left as it was.
 */
export function masterState(root: string, sha?: string): MasterState {
  const file = path.join(root, SOURCE);
  if (!fs.existsSync(file))
    return {
      sha: null,
      recorded: null,
      problem: 'source/recording.wav is missing',
    };
  const actual = sha ?? sha256File(file);
  const record = readJSONFile(
    path.join(root, 'source', 'recording.json'),
    null,
  );
  const recorded =
    isRecord(record) && typeof record.sha256 === 'string'
      ? record.sha256
      : null;
  return {
    sha: actual,
    recorded,
    problem:
      recorded && recorded !== actual
        ? 'source/recording.wav does not match source/recording.json: the recording was replaced or damaged'
        : null,
  };
}

/**
 * The recording's transcript on its own clock (seconds into source/recording.wav). Ingest
 * writes it with each beat's share; a project ingested before that is rebuilt once from its
 * still-unedited beat metadata.
 */
export function ensureTranscript(root: string): Transcript {
  const existing = readTranscript(root);
  if (existing) return existing;
  const sb = readStoryboardFile(root),
    fps = sb.format?.fps ?? 30;
  const beats = sb.beats
    .map((b) => ({ b, meta: readMeta(root, b.id) }))
    .filter((x): x is { b: Beat; meta: RecordedMeta } => isRecorded(x.meta));
  if (!beats.length)
    throw new Error('No beat replays source/recording.wav; nothing to edit.');
  if (beats.some((x) => x.meta.source.removed?.length))
    throw new Error(
      'source/words.json is missing but beats were already edited; restore it from a revision.',
    );
  const { rate, samples } = loadSource(root);
  const offset = Math.min(...beats.map((x) => x.meta.source.start));
  const words: TranscriptWord[] = [];
  for (const { b, meta } of beats) {
    const f0 = Math.round((meta.source.start - offset) * fps),
      f1 = Math.round((meta.source.end - offset) * fps),
      start = f0 / fps,
      i0 = words.length;
    for (const w of meta.words ?? [])
      words.push({
        w: w.w,
        t0: round(start + w.t0, 4),
        t1: round(start + w.t1, 4),
        ...(b.speaker ? { speaker: b.speaker } : {}),
        ...(meta.alignment?.kind === 'measured' ? {} : { estimated: true }),
      });
    meta.source = {
      ...meta.source,
      offset,
      fps,
      span: [f0, f1],
      words: [i0, words.length],
    };
    writeJSONAtomic(metaPath(root, b.id), meta);
  }
  const transcript = {
    version: 1,
    file: SOURCE,
    rate,
    fps,
    offset,
    duration: round(samples / rate, 4),
    words,
  };
  writeJSONAtomic(path.join(root, 'source', 'words.json'), transcript);
  if (!fs.existsSync(path.join(root, 'source', 'recording.json')))
    writeJSONAtomic(path.join(root, 'source', 'recording.json'), {
      file: SOURCE,
      input:
        (sb.sources?.find((s) => s.id === 'recording')?.title ?? '').replace(
          /^Recording:\s*/,
          '',
        ) || null,
      offset,
      rate,
      duration: transcript.duration,
      sha256: sha256File(path.join(root, SOURCE)),
      note: 'Rebuilt from beat metadata; offset is where this file starts in the original recording.',
    });
  return transcript;
}
