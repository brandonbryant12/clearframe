// The state a recording edit works on, and the all-or-nothing write it makes.
import fs from 'node:fs';
import path from 'node:path';
import {
  ensureTranscript,
  loadSource,
  masterState,
} from './recording-slices.mjs';
import {
  isRecorded,
  readMeta,
  readStoryboardFile,
} from './recording-model.mjs';
import type { RecordedMeta } from './recording-model.mjs';
import type { ContextBeat, EditContext } from './recording-select.mjs';

export function context(root: string): EditContext {
  const sb = readStoryboardFile(root),
    fps = sb.format?.fps ?? 30;
  const transcript = ensureTranscript(root);
  const src = loadSource(root);
  // Beats are rebuilt from the master: never from one that is not the recording ingested.
  const { problem } = masterState(root, src.sha);
  if (problem)
    throw new Error(
      `${problem}. Recording edits rebuild beats from it, so nothing was changed; restore it from a revision (restore DIR rNNN).`,
    );
  if (src.rate !== transcript.rate)
    throw new Error('source/recording.wav does not match source/words.json.');
  const beats = sb.beats.map((b, index) => ({
    b,
    index,
    meta: readMeta(root, b.id),
  }));
  return { sb, fps, transcript, src, beats };
}

/** The context entry of a beat the edit planned from (always present: plans come from the context). */
export function beatIn(ctx: EditContext, id: string): ContextBeat {
  const x = ctx.beats.find((y) => y.b.id === id);
  if (!x) throw new Error(`No beat ${id}.`);
  return x;
}

/** A beat's metadata when it replays the recording; edits only plan for such beats. */
export function recordedMeta(x: ContextBeat): RecordedMeta {
  if (!isRecorded(x.meta))
    throw new Error(`${x.b.id} does not replay the recording.`);
  return x.meta;
}

/**
 * Run `fn`; if it throws, put every listed file back as it was (or remove it if it did not
 * exist). Edits touch several files (slices, metadata, the storyboard, the log): a failure part
 * way must not leave some of them changed.
 */
export function atomically<T>(root: string, rels: string[], fn: () => T): T {
  const saved = [...new Set(rels)].map((rel): [string, Buffer | null] => {
    const file = path.join(root, rel);
    return [file, fs.existsSync(file) ? fs.readFileSync(file) : null];
  });
  try {
    return fn();
  } catch (e) {
    for (const [file, data] of saved)
      if (data == null) fs.rmSync(file, { force: true });
      else fs.writeFileSync(file, data);
    throw e;
  }
}
export const touchedFiles = (
  beats: string[],
  extra: string[] = [],
): string[] => [
  'storyboard.json',
  'review/edits.jsonl',
  ...beats.flatMap((id) => [`assets/vo/${id}.wav`, `assets/vo/${id}.json`]),
  ...extra,
];
