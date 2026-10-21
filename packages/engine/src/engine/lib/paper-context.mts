import fs from 'node:fs';
import path from 'node:path';
import { computeTiming } from './timing.mjs';
import { readJSONFile } from './store.mjs';
import { readStoryboardFile, readEdits } from './recording-model.mjs';
import { ensureTranscript } from './recording.mjs';
import { isRecord } from './errors.mjs';
import type { Transcript } from './recording-model.mjs';
export function paperContext(root: string) {
  const timing = computeTiming(root),
    sb = readStoryboardFile(root);
  const raw = new Map(sb.beats.map((b) => [b.id, b]));
  const record = readJSONFile(
    path.join(root, 'source', 'recording.json'),
    null,
  );
  const manifest = isRecord(record) ? record : null;
  let transcript: Transcript | null = null;
  try {
    if (fs.existsSync(path.join(root, 'source', 'recording.wav')))
      transcript = ensureTranscript(root);
  } catch {}
  return {
    root,
    timing,
    sb,
    raw,
    manifest,
    transcript,
    edits: readEdits(root),
  };
}
export type PaperContext = ReturnType<typeof paperContext>;
