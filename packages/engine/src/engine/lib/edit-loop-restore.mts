import { prepareProjectSync } from '../../film/prepare.mjs';
import { useProject } from '../../film/library.mjs';
import {
  loadRevision,
  snapshot,
  workingContent,
  reviewTimeline,
  trackedFiles,
  type LoadedRevision,
  type PreparedContext,
} from './revisions.mjs';
import { addDecision } from './notes.mjs';
import {
  readEdits,
  readMeta,
  voMetaOrNull,
  wasOf,
  type VoMeta,
} from './recording-model.mjs';
import { checkId, fingerprint } from './store.mjs';
import { errorMessage } from './errors.mjs';
import { writeReviewPage } from './review-page.mjs';
import {
  beatFiles,
  insertInOrder,
  objectSha,
  overlappingSources,
  readWorkingStoryboard,
  restoreFiles,
  setAside,
  sharedRewrites,
  storedJSON,
  storyboardOf,
  writeStoryboard,
  type SharedRewrite,
} from './edit-loop-beats.mjs';

import type { Beat, Storyboard } from '../domain.mjs';
export { rejectRevision } from './edit-loop-reject.mjs';
export type { RejectRequest, RejectResult } from './edit-loop-reject.mjs';
function beatOf(sb: Storyboard, id: string, revision: string): Beat {
  const beat = sb.beats.find((x) => x.id === id);
  if (!beat) throw new Error(`${revision} has no beat ${id}.`);
  return beat;
}

export interface Verification {
  state: 'exact' | 'inputs' | 'differs';
  contentId?: string;
  error?: string;
  missing?: string[];
  extra?: string[];
  changed?: string[];
  renderer?: string;
  fonts?: string;
  look?: string;
}

/** How the working copy now compares with revision R: exact, inputs-only, or what differs. */
function verifyAgainst(root: string, R: LoadedRevision): Verification {
  let w;
  try {
    w = workingContent(root);
  } catch (e) {
    return {
      state: 'differs',
      error: `the restored project does not prepare: ${errorMessage(e).split('\n')[0]}`,
    };
  }
  if (w.contentId === R.meta.contentId)
    return { state: 'exact', contentId: w.contentId };
  const want = Object.fromEntries(
    Object.entries(R.meta.inputs ?? {}).map(
      ([rel, o]): [string, string | null] => [rel, objectSha(o)],
    ),
  );
  const missing = Object.keys(want).filter((rel) => !w.inputs[rel]);
  const extra = Object.keys(w.inputs).filter((rel) => !want[rel]);
  const changed = Object.keys(want).filter(
    (rel) => w.inputs[rel] && w.inputs[rel] !== want[rel],
  );
  const renderer =
    w.ctx.manifest.rendererSourceHash !== R.meta.renderer?.sourceHash;
  const fonts =
    fingerprint(w.ctx.manifest.fontHashes) !== R.meta.renderer?.fonts;
  const inputsMatch = !missing.length && !extra.length && !changed.length;
  const look = reviewTimeline(w.ctx).film.look === R.timeline.film.look;
  return {
    state: inputsMatch ? 'inputs' : 'differs',
    ...(missing.length ? { missing } : {}),
    ...(extra.length ? { extra } : {}),
    ...(changed.length ? { changed } : {}),
    renderer: renderer ? 'changed since' : 'same',
    fonts: fonts ? 'changed since' : 'same',
    look: look
      ? 'same'
      : 'differs (the shared or built-in library may have changed)',
  };
}

export interface RestoreRequest {
  revision: string;
  beats?: string[];
  by?: string;
  said?: string;
  role?: string;
  shared?: boolean;
}
export interface AsideFile {
  file: string;
  to: string;
  why: string;
}
export interface RestoreResult {
  revision: string;
  restorePoint?: string;
  now?: string;
  restored: string[];
  unchanged?: boolean;
  alsoChanged?: SharedRewrite[];
  aside?: AsideFile[];
  verified?: Verification | { state: 'exact' };
  decision?: string;
}

function restoringFiles(
  R: LoadedRevision,
  sbR: Storyboard,
  sb: Storyboard,
  restoring: Set<string>,
  revision: string,
): Map<string, string> {
  const inputs = R.meta.inputs ?? {};
  const files = new Map<string, string>();
  for (const id of restoring) {
    const old = sbR.beats.find((b) => b.id === id);
    if (!old) throw new Error(`${revision} has no beat ${id}.`);
    if (!sb.beats.some((b) => b.id === id)) {
      const heirs = sb.beats
        .filter((b) => (wasOf(b) ?? []).includes(id))
        .map((b) => b.id);
      if (heirs.length)
        throw new Error(
          `${id} became ${heirs.join(' + ')} since ${revision}; restore those, or the whole revision. Nothing was changed.`,
        );
    }
    for (const rel of beatFiles(old, sbR.assets ?? [], inputs))
      files.set(rel, inputs[rel]);
  }
  return files;
}

async function restoreBeats(
  root: string,
  R: LoadedRevision,
  sbR: Storyboard,
  request: RestoreRequest & { beats: string[] },
): Promise<RestoreResult> {
  const { revision, beats, by, said, role = 'human', shared = false } = request;
  const sb = readWorkingStoryboard(root);
  const sbNow = structuredClone(sb);
  const restoring = new Set(beats.map((id) => checkId('beat', id)));
  const files = restoringFiles(R, sbR, sb, restoring, revision);
  const names = [...restoring].join(', ');
  const rewrites = sharedRewrites(root, [...files], restoring, sbNow);
  if (rewrites.length && !shared)
    throw new Error(
      `Restoring ${names} would also change other beats: ${rewrites.map((r) => `${r.file} (used by ${r.beats.join(', ')})`).join('; ')}. Add --shared to change them too, or restore the whole revision. Nothing was changed.`,
    );
  for (const id of restoring) {
    const old = beatOf(sbR, id, revision);
    const at = sb.beats.findIndex((b) => b.id === id);
    if (at >= 0) sb.beats[at] = old;
    else
      insertInOrder(
        sb,
        old,
        sbR.beats.map((b) => b.id),
        readEdits(root),
      );
  }
  const inputs = R.meta.inputs ?? {};
  const metaFor = (id: string): VoMeta | null =>
    restoring.has(id)
      ? voMetaOrNull(storedJSON(root, inputs[`assets/vo/${id}.json`]))
      : readMeta(root, id);
  const twice = overlappingSources(root, sb, metaFor);
  if (twice.length)
    throw new Error(
      `Restoring ${names} would play the same recording twice (${twice.map((p) => p.join(' and ')).join('; ')}). Restore the beats that replaced it too, or the whole revision. Nothing was changed.`,
    );
  const { revision: point } = await snapshot(root, {
    kind: 'restore-point',
    reason: `before restoring ${names} from ${revision}`,
    force: true,
  });
  restoreFiles(root, [...files]);
  writeStoryboard(root, sb);
  const decision = addDecision(root, {
    action: 'restore',
    role,
    by,
    said,
    reason: `restored ${names} from ${revision}`,
    revision,
  });
  const { revision: after } = await snapshot(root, {
    kind: 'restored',
    reason: `restored ${names} from ${revision}`,
  });
  writeReviewPage(root);
  return {
    revision,
    restorePoint: point.id,
    now: after.id,
    restored: [...restoring],
    ...(rewrites.length ? { alsoChanged: rewrites } : {}),
    decision: decision.id,
  };
}

// Media the loader would now pick instead of the revision's (an image of another format, a bed).
function setAsidePicked(
  root: string,
  inputs: Record<string, string>,
  point: string,
  revision: string,
  aside: AsideFile[],
): void {
  for (let pass = 0; pass < 4; pass++) {
    useProject(null);
    let ctx: PreparedContext;
    try {
      ctx = prepareProjectSync(root, { draft: true, rough: true });
    } catch {
      return; // verifyAgainst reports why
    }
    const picked = Object.keys(ctx.manifest.hashes).filter(
      (rel) => !inputs[rel] && /^assets\/(img|clips|music|sfx)\//.test(rel),
    );
    if (!picked.length) return;
    for (const rel of picked)
      aside.push({
        file: rel,
        to: setAside(root, rel, point),
        why: `the loader picked it over ${revision}'s own`,
      });
  }
}

async function restoreWhole(
  root: string,
  R: LoadedRevision,
  { revision, by, said, role = 'human' }: RestoreRequest,
): Promise<RestoreResult> {
  useProject(null);
  if (workingContent(root).contentId === R.meta.contentId)
    return {
      revision,
      unchanged: true,
      restored: [],
      verified: { state: 'exact' },
    };
  const inputs = R.meta.inputs ?? {};
  const { revision: point } = await snapshot(root, {
    kind: 'restore-point',
    reason: `before restoring ${revision}`,
    force: true,
  });
  restoreFiles(root, Object.entries(inputs));
  const aside: AsideFile[] = [];
  for (const rel of trackedFiles(root))
    if (!inputs[rel])
      aside.push({
        file: rel,
        to: setAside(root, rel, point.id),
        why: `${revision} did not have it`,
      });
  setAsidePicked(root, inputs, point.id, revision, aside);
  useProject(null);
  const verified = verifyAgainst(root, R);
  const decision = addDecision(root, {
    action: 'restore',
    role,
    by,
    said,
    reason: `restored everything from ${revision}`,
    revision,
  });
  const { revision: after } = await snapshot(root, {
    kind: 'restored',
    reason: `restored all from ${revision}`,
  });
  writeReviewPage(root);
  return {
    revision,
    restorePoint: point.id,
    now: after.id,
    restored: ['whole revision'],
    aside,
    verified,
    decision: decision.id,
  };
}

/**
 * Restore a whole revision (or some of its beats) into the working copy. Explicit and
 * recoverable: the current state is first saved as a revision, and every file comes from the
 * object store, checked against its hash.
 * - Whole: the revision's files are written, tracked inputs it did not have (library
 *   overrides, takes, sound files, the music bed's pointer) are moved aside into
 *   review/aside/<restore point>/, as is any media the loader would now pick over the
 *   revision's own; then the result is verified against the revision (exact, or inputs-only
 *   when the renderer or fonts changed since, or a list of differences).
 * - Some beats: refused when a media file they need differs and other beats use it (unless
 *   `shared`), or when a recorded beat would replay recording another beat plays now.
 */
export async function restoreRevision(
  root: string,
  request: RestoreRequest,
): Promise<RestoreResult> {
  checkId('revision', request.revision);
  const R = loadRevision(root, request.revision);
  const sbR = storyboardOf(root, request.revision);
  const beats = request.beats;
  if (beats?.length) return restoreBeats(root, R, sbR, { ...request, beats });
  return restoreWhole(root, R, request);
}
