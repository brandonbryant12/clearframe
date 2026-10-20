import { createStaging, stageJobMedia } from './preparation/media.mjs';
import {
  recordAudioInputs,
  attachVoiceLevels,
  recordSoundInputs,
  stageFonts,
} from './preparation/resources.mjs';
// Prepare a project for the renderer: build the job, stage media, measure voice levels and
// record the input hashes a render must match.
import fs from 'node:fs';
import path from 'node:path';
import { createJob } from './job.mjs';
import {
  FILM as ROOT,
  sha256,
  sceneHash,
  engineCommand,
} from '../scene/engine.mjs';
import { compilePlan, writePlan } from '../scene/compile.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import {
  computeTiming,
  captionCues,
  toSRT,
  toVTT,
} from '../engine/lib/timing.mjs';
import { writeJSON } from '../engine/lib/util.mjs';
import { footageProblems } from '../engine/lib/continuity.mjs';

import type {
  PrepareOptions,
  PreparedContext,
  PreparedJob,
  PreparedManifest,
} from './preparation/contracts.mjs';
import { profileOf } from './preparation/contracts.mjs';
import { roughStandIns } from './preparation/rough.mjs';
export { roughStandIns } from './preparation/rough.mjs';
export { classifyAudit } from './preparation/audit.mjs';
export { checkProject } from './preparation/check.mjs';
export type {
  PreparedContext,
  PrepareOptions,
  CheckResult,
} from './preparation/contracts.mjs';
/** Prepare synchronously (nothing in preparation waits); prepareProject is the async form. */
export async function prepareProject(
  root: string,
  options: PrepareOptions = {},
): Promise<PreparedContext> {
  return prepareProjectSync(root, options);
}
/**
 * The job a render of the working copy is asked to draw, before any media is staged: the pure
 * half of preparation. `jobSha256` names it, so a receipt can be checked against the working copy
 * (a palette, treatment or library edit changes the film without changing any hashed file)
 * without rewriting build/native under a render that may be running.
 */
export function preparedJob(
  root: string,
  { draft = false, rough = false }: PrepareOptions = {},
): PreparedJob {
  root = fs.realpathSync(root);
  const loaded = loadStoryboard(root),
    computed = computeTiming(root);
  const { sb, timing, placeholders, unfinished, allowed } = roughStandIns(
    root,
    loaded,
    computed,
    { rough },
  );
  const result = createJob(sb, timing, { draft: draft || rough });
  if (result.errors.length) throw new Error(result.errors.join('\n'));
  return {
    root,
    sb,
    timing,
    placeholders,
    unfinished,
    allowed,
    result,
    jobSha256: sha256(JSON.stringify(result.job)),
  };
}
export function prepareProjectSync(
  root: string,
  { draft = false, rough = false }: PrepareOptions = {},
): PreparedContext {
  const prepared = preparedJob(root, { draft, rough });
  root = prepared.root;
  const { sb, timing, placeholders, unfinished, allowed, result, jobSha256 } =
    prepared;
  const dir = path.join(root, 'build/native'),
    media = path.join(dir, 'media');
  fs.mkdirSync(media, { recursive: true });
  const staging = createStaging(root, sb, media);
  const { stage, assetFile, hashes } = staging;
  const footage = stageJobMedia(staging, result.job, timing);
  // The scene plan: native stages and their footage, compiled for the renderer.
  const compiled = compilePlan(
    { root, sb, timing, job: result.job, stage, assetFile },
    { rough },
  );
  result.warnings.push(...compiled.warnings);
  footage.push(...compiled.footage);
  for (const jb of result.job.beats) {
    if (compiled.settle[jb.id] != null)
      jb.settle_seconds = Math.max(
        jb.settle_seconds,
        Math.min(compiled.settle[jb.id], jb.frames / result.job.fps),
      );
    // A stage beat's block draws only its heading and source line.
    if (jb.block === 'stage')
      jb.props = Object.fromEntries(
        Object.entries(jb.props).filter(([k]) =>
          ['title', 'kicker', 'source', 'land'].includes(k),
        ),
      );
  }
  // The same footage shown again over the same seconds is a loop by another name.
  const reuse = footageProblems(footage);
  if (reuse.errors.length) throw new Error(reuse.errors.join(' '));
  result.warnings.push(...reuse.warnings);
  recordAudioInputs(timing, staging);
  attachVoiceLevels(timing, result, root);
  const sounds = recordSoundInputs(timing, sb, result, staging);
  const fontHashes = stageFonts(staging);
  writeJSON(path.join(dir, 'job.json'), result.job);
  const planFile = path.join(dir, 'plan.json');
  writePlan(dir, compiled.plan);
  writeJSON(path.join(root, 'build/timing.json'), timing);
  fs.writeFileSync(
    path.join(root, 'build/captions.srt'),
    toSRT(captionCues(timing)),
  );
  fs.writeFileSync(
    path.join(root, 'build/captions.vtt'),
    toVTT(captionCues(timing)),
  );
  const rendererSourceHash = sceneHash();
  const planSha256 = sha256(fs.readFileSync(planFile));
  const manifest: PreparedManifest = {
    version: 2,
    renderer: 'scene',
    rendererSourceHash,
    fontHashes,
    planSha256,
    jobSha256,
    provenance: compiled.provenance,
    hashes,
    ...(Object.keys(sounds).length ? { sounds } : {}),
    // What this render is made from. A cue file is among `hashes` (so also among a revision's
    // inputs and content id); a built-in cue is code, named by its recipe in `sounds`: it changes
    // this input id and the preview mix, not a revision's content id (which names inputs, not code).
    inputId: sha256(
      JSON.stringify({
        job: result.job,
        hashes,
        rendererSourceHash,
        fontHashes,
        planSha256,
        ...(Object.keys(sounds).length ? { sounds } : {}),
      }),
    ),
    draft: draft || rough,
    profile: profileOf({ draft, rough }),
    ...(placeholders.length ? { placeholders } : {}),
    ...(unfinished.length ? { unfinished } : {}),
    warnings: result.warnings,
  };
  writeJSON(path.join(dir, 'manifest.json'), manifest);
  return {
    ...result,
    root,
    sb,
    timing,
    dir,
    media,
    manifest,
    placeholders,
    unfinished,
    allowed,
  };
}
export function unchanged(ctx: PreparedContext): void {
  if (sceneHash() !== ctx.manifest.rendererSourceHash)
    throw new Error('Renderer source changed during the render; run again.');
  for (const [file, hash] of Object.entries(ctx.manifest.fontHashes))
    if (sha256(fs.readFileSync(path.join(ROOT, 'assets/fonts', file))) !== hash)
      throw new Error('Font changed during the render; run again.');
  for (const [file, hash] of Object.entries(ctx.manifest.hashes))
    if (sha256(fs.readFileSync(path.join(ctx.root, file))) !== hash)
      throw new Error(`Input changed during render: ${file}. Run again.`);
}
/** Run a command with the project's engine (see scene/engine.mjs). */
export const nativeCommand = engineCommand;
