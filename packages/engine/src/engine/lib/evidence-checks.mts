import fs from 'node:fs';
import path from 'node:path';
import { sha256File } from './store.mjs';
import { REPO_DIR } from './util.mjs';
import { FILM, sceneHash } from '../../scene/engine.mjs';
import { preparedJob } from '../../film/prepare.mjs';
import { errorMessage } from './errors.mjs';
import type {
  EvidenceState,
  EvidenceOptions,
  VideoReceipt,
} from './evidence-contracts.mjs';
/** A repo- or project-relative path that stays inside `base`, else null. */
function inside(base: string, rel: unknown): string | null {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel)) return null;
  const file = path.resolve(base, rel);
  return file.startsWith(path.resolve(base) + path.sep) ? file : null;
}

export function checkRecordedVideo(
  r: VideoReceipt,
  { invalid }: EvidenceState,
  probe: EvidenceOptions['probe'],
): void {
  if (!Number.isInteger(r.frames) || !Number.isFinite(r.fps))
    invalid.push('the render receipt records no frame count or frame rate');
  if (probe) {
    const v = probe.streams?.find((s) => s.codec_type === 'video');
    if (
      v &&
      Number.isInteger(r.width) &&
      Number.isInteger(r.height) &&
      (v.width !== r.width || v.height !== r.height)
    )
      invalid.push(
        `the video is ${v.width}×${v.height}; its receipt says ${r.width}×${r.height}`,
      );
    if (
      v &&
      Number(v.nb_frames) > 0 &&
      Number.isInteger(r.frames) &&
      Number(v.nb_frames) !== r.frames
    )
      invalid.push(
        `the video has ${v.nb_frames} frames; its receipt says ${r.frames}`,
      );
  }
}
export function checkProjectInputs(
  r: VideoReceipt,
  { root, invalid, stale, evidence }: EvidenceState,
): void {
  // The project as it is now.
  for (const [rel, hash] of Object.entries(r.hashes ?? {})) {
    const input = inside(root, rel);
    if (!input || typeof hash !== 'string')
      invalid.push(
        `the render receipt names an input outside the project: ${rel}`,
      );
    else if (!fs.existsSync(input))
      stale.push(`Input missing since rendering: ${rel}`);
    else if (sha256File(input) !== hash)
      stale.push(`Input changed since rendering: ${rel}`);
  }
  evidence.checked.push(
    `${Object.keys(r.hashes ?? {}).length} hashed inputs (storyboard, media, voice, music, sound cues)`,
  );
}
export function checkTimeline(
  r: VideoReceipt,
  { stale }: EvidenceState,
  timing: EvidenceOptions['timing'],
): void {
  if (
    timing &&
    Number.isInteger(r.frames) &&
    (timing.frames !== r.frames || timing.fps !== r.fps)
  )
    stale.push(
      `Timeline differs from the encoded video: it has ${r.frames} frames at ${r.fps} fps, the storyboard now ${timing.frames} at ${timing.fps}`,
    );
}
export function checkRenderer(
  r: VideoReceipt,
  { stale, evidence }: EvidenceState,
): void {
  if (typeof r.rendererSourceHash === 'string') {
    if (r.rendererSourceHash !== sceneHash())
      stale.push('the renderer source has changed since this render');
    evidence.checked.push('renderer source');
  } else
    evidence.unchecked.push('renderer source (the receipt does not record it)');
}
export function checkFonts(
  r: VideoReceipt,
  { stale, evidence }: EvidenceState,
): void {
  if (r.fontHashes && typeof r.fontHashes === 'object') {
    for (const [name, hash] of Object.entries(r.fontHashes)) {
      const font = inside(path.join(FILM, 'assets/fonts'), name);
      if (!font || !fs.existsSync(font) || sha256File(font) !== hash)
        stale.push(`bundled font changed since rendering: ${name}`);
    }
    evidence.checked.push('bundled fonts');
  } else
    evidence.unchecked.push('bundled fonts (the receipt does not record them)');
}
export function checkFinishing(
  r: VideoReceipt,
  { stale, evidence }: EvidenceState,
): void {
  if (r.finishingSourceHashes && typeof r.finishingSourceHashes === 'object') {
    for (const [rel, hash] of Object.entries(r.finishingSourceHashes)) {
      const code = inside(REPO_DIR, rel);
      if (!code || !fs.existsSync(code) || sha256File(code) !== hash)
        stale.push(
          `the finishing code that mixes and places the sound has changed since rendering: ${rel}`,
        );
    }
    evidence.checked.push('finishing code (mix and sound placement)');
  } else
    evidence.unchecked.push('finishing code (the receipt does not record it)');
}
export function checkPreparedJob(
  r: VideoReceipt,
  { root, stale, evidence }: EvidenceState,
): void {
  // The film the working copy would draw: a library, palette or treatment edit changes it with no
  // hashed file changing. Receipts from before this check carry no job identity.
  if (typeof r.jobSha256 === 'string') {
    try {
      const profile = evidence.profile;
      const now = preparedJob(root, {
        draft: profile !== 'final',
        rough: profile === 'rough',
      }).jobSha256;
      if (now !== r.jobSha256)
        stale.push(
          'the film the working copy would draw has changed since this render (a library, palette, treatment or engine edit)',
        );
    } catch (e) {
      stale.push(
        `the working copy no longer prepares: ${errorMessage(e).split('\n')[0]}`,
      );
    }
    evidence.checked.push('prepared job');
  } else
    evidence.unchecked.push(
      'prepared job (a receipt from before job identity: library or engine edits are not detected)',
    );
}
