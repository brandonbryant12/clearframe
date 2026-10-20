import fs from 'node:fs';
import path from 'node:path';
import { editParts, type EditEntry } from './recording-model.mjs';
import {
  loadSource,
  masterState,
  slicePieces,
  type SourceAudio,
} from './recording-slices.mjs';

import { errorMessage } from './errors.mjs';

import type { CurrentSource } from './targets.mjs';

export const byHuman = (e: EditEntry | undefined): boolean => {
  const by: unknown = e?.by;
  return (
    typeof by === 'object' && by !== null && 'role' in by && by.role === 'human'
  );
};

export const personCut = (e: EditEntry): boolean =>
  ['cut', 'pauses'].includes(e.op) && byHuman(e);

/**
 * Source sample ranges the person had removed: removals made by cuts the edit log shows they
 * asked for (a removal record's own `by` is not taken on trust), and the beats they cut whole.
 */
export function personRemoved(
  now: CurrentSource,
  edits: EditEntry[],
): number[][] {
  const theirs = new Set(edits.filter(personCut).map((e) => e.id));
  const spans = now.removals
    .filter((r) => theirs.has(r.id))
    .map((r) => r.samples);
  const transcript = now.transcript;
  if (!transcript) return spans;
  for (const e of edits.filter(personCut))
    for (const p of editParts(e)) {
      const source = p.meta?.source;
      if (!p.deleted || !source) continue;
      for (const x of slicePieces(
        { source },
        { rate: transcript.rate, fps: source.fps ?? 30 },
      ))
        if (!('pad' in x)) spans.push([x.from, x.to]);
    }
  return spans;
}

export interface RecordingNow {
  sha: string | null;
  problem: string | null;
  src?: SourceAudio;
}

/** The master as it is now, read once: its state and its samples (to check slices against). */
export function recordingNow(root: string): RecordingNow {
  if (!fs.existsSync(path.join(root, 'source', 'recording.wav')))
    return masterState(root);
  let src;
  try {
    src = loadSource(root);
  } catch (e) {
    return {
      sha: null,
      problem: `source/recording.wav cannot be read (${errorMessage(e)})`,
    };
  }
  return { ...masterState(root, src.sha), src };
}
