import fs from 'node:fs';

import path from 'node:path';

import type { Beat, ResolvedStoryboard } from '../../domain.mjs';

import { ffmpeg, hashOf } from '../util.mjs';

import { readNarration } from '../speech-meta.mjs';
import type { Take } from './contracts.mjs';

export const narrated = (b: Beat): b is Beat & { vo: string } => Boolean(b.vo);

/** Beats whose take on disk was recorded for their current words. */
export function currentTakes(
  sb: ResolvedStoryboard,
  vo: string,
  beat: string | undefined,
): Take[] {
  return sb.beats
    .filter(narrated)
    .filter((b) => !beat || b.id === beat)
    .map((b) => ({
      id: b.id,
      vo: b.vo,
      wav: path.join(vo, `${b.id}.wav`),
      metaFile: path.join(vo, `${b.id}.json`),
    }))
    .filter(
      (x) =>
        fs.existsSync(x.wav) &&
        readNarration(x.metaFile)?.meta.textHash === hashOf(x.vo),
    );
}

/** A slice of an imported recording was measured at import against the whole recording and its script. */
export function measuredAtImport(x: Take): boolean {
  const m = readNarration(x.metaFile)?.meta;
  return m?.provider === 'imported' && m.alignment?.kind === 'measured';
}

/** Why there is nothing to align: an imported recording is its own narration. */
export function nothingToAlign(
  root: string,
  sb: ResolvedStoryboard,
  vo: string,
  beat: string | undefined,
): Error {
  // Ingest measured its words already, and its takes stop matching when someone rewrites `vo`
  // instead of cutting the recording.
  if (!fs.existsSync(path.join(root, 'source', 'recording.wav')))
    return new Error(
      'No current narration takes to align; record or import voice first.',
    );
  const changed = sb.beats
    .filter(narrated)
    .filter(
      (b) =>
        (!beat || b.id === beat) &&
        fs.existsSync(path.join(vo, `${b.id}.json`)),
    )
    .filter(
      (b) =>
        readNarration(path.join(vo, `${b.id}.json`))?.meta.textHash !==
        hashOf(b.vo),
    )
    .map((b) => b.id);
  const changedNames =
    changed.slice(0, 6).join(', ') + (changed.length > 6 ? ' …' : '');
  return new Error(
    changed.length
      ? `This film plays an imported recording, and the vo of ${changedNames} no longer matches what was recorded. A recording is edited with cut, uncut, split and merge (docs/editing.md), never by rewriting vo: put the words back (or ingest again) and use those.`
      : 'This film plays an imported recording, whose words were measured when it was ingested (source/words.json); there are no voice takes to align. Its timings are already measured: go on with sheet and draft.',
  );
}

/** A 16 kHz mono copy of a take, the form the recognizers read; each take keeps its own clock. */
export async function whisperWav(source: string, out: string): Promise<string> {
  await ffmpeg(['-y', '-i', source, '-ac', '1', '-ar', '16000', out]);
  return out;
}
