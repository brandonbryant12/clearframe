import fs from 'node:fs';

import path from 'node:path';
import { prepareProjectSync } from '../../film/prepare.mjs';

import { fingerprint, sha256File } from './store.mjs';

import type { PreparedContext, RevisionManifest } from './revisions-model.mjs';

// Inputs that are not named by the prepared job but are read by the loader or by later edits:
// the recording and its transcript, the music bed's pointer, generated-voice takes, project
// sound files and the project library (which overrides palettes, treatments and sketches).
export const TRACKED_FILES = [
  'source/recording.wav',
  'source/words.json',
  'source/recording.json',
  'assets/music/bed.json',
];

export const TRACKED_DIRS = ['assets/vo/takes', 'assets/sfx', 'library'];

/** Files in the tracked locations as they are now: [relative path…]. */
export function trackedFiles(root: string): string[] {
  const out = TRACKED_FILES.filter((rel) => {
    const f = path.join(root, rel);
    return fs.existsSync(f) && fs.statSync(f).isFile();
  });
  const walk = (d: string): void =>
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile())
        out.push(path.relative(root, p).split(path.sep).join('/'));
    });
  for (const dir of TRACKED_DIRS) {
    const abs = path.join(root, dir);
    if (fs.existsSync(abs)) walk(abs);
  }
  return out;
}

/** Every file a render of the project reads, plus what a restore needs (sources, takes, library). */
export function collectInputs(
  root: string,
  ctx: PreparedContext,
): Record<string, string> {
  const inputs = { ...ctx.manifest.hashes };
  const add = (rel: string): void => {
    const file = path.join(root, rel);
    if (fs.existsSync(file) && fs.statSync(file).isFile())
      inputs[rel] ??= sha256File(file);
  };
  for (const rel of trackedFiles(root)) add(rel);
  for (const b of ctx.timing.beats)
    if (b.vo) {
      add(`assets/vo/${b.id}.wav`);
      add(`assets/vo/${b.id}.json`);
    }
  return Object.fromEntries(
    Object.entries(inputs).sort(([a], [b]) => a.localeCompare(b)),
  );
}

/** A state's identity: its inputs, the renderer and the fonts. Same id, same film. */
export const contentIdOf = (
  inputs: Record<string, string>,
  manifest: RevisionManifest,
): string =>
  fingerprint({
    inputs,
    renderer: manifest.rendererSourceHash,
    fonts: manifest.fontHashes,
  });

export interface WorkingContent {
  ctx: PreparedContext;
  inputs: Record<string, string>;
  contentId: string;
}

/**
 * The working copy's identity, synchronously (no native work): prepared like a rough draft so
 * placeholders don't stop it. A final revision is current only if its contentId equals this.
 */
export function workingContent(root: string): WorkingContent {
  const ctx: PreparedContext = prepareProjectSync(root, {
    draft: true,
    rough: true,
  });
  const inputs = collectInputs(root, ctx);
  return { ctx, inputs, contentId: contentIdOf(inputs, ctx.manifest) };
}
