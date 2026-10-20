import fs from 'node:fs';

import path from 'node:path';
import { prepareProject } from '../../film/prepare.mjs';

import {
  ID,
  checkId,
  readJSONFile,
  restoreObject,
  reviewPath,
  withLock,
  writeJSONAtomic,
} from './store.mjs';

import { reviewTimeline } from './revisions-timeline.mjs';
import {
  decodeRevisionMeta,
  decodeTimeline,
  type PreparedContext,
  type RevisionMeta,
  type Timeline,
} from './revisions-model.mjs';

export const revDir = (root: string, id: string): string =>
  reviewPath(root, 'revisions', checkId('revision', id));

export interface LoadedRevision {
  meta: RevisionMeta;
  timeline: Timeline;
}

export function listRevisions(root: string): RevisionMeta[] {
  const dir = reviewPath(root, 'revisions');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(
      (d) =>
        ID.revision.test(d) &&
        fs.existsSync(path.join(dir, d, 'revision.json')),
    )
    .map((d) =>
      decodeRevisionMeta(readJSONFile(path.join(dir, d, 'revision.json'))),
    )
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
}

export function loadRevision(root: string, id: string): LoadedRevision {
  const dir = revDir(root, id);
  if (!fs.existsSync(path.join(dir, 'revision.json')))
    throw new Error(`No revision ${id}. Run revisions DIR to list them.`);
  return {
    meta: decodeRevisionMeta(readJSONFile(path.join(dir, 'revision.json'))),
    timeline: decodeTimeline(readJSONFile(path.join(dir, 'timeline.json'))),
  };
}

export const latestRevision = (
  root: string,
  test: (r: RevisionMeta) => boolean = () => true,
): RevisionMeta | null => listRevisions(root).filter(test).at(-1) ?? null;

/** The newest revision a person could have watched (one with a full video). */
export const latestWatchable = (root: string): RevisionMeta | null =>
  latestRevision(root, (r) =>
    (r.videos ?? []).some((v) => v.retained !== false),
  );

/** Record a change to a revision's receipts (videos, previews, notes); content never changes. */
export function updateRevision(
  root: string,
  id: string,
  fn: (meta: RevisionMeta) => void,
): RevisionMeta {
  return withLock(root, () => {
    const file = path.join(revDir(root, id), 'revision.json');
    const meta = decodeRevisionMeta(readJSONFile(file));
    fn(meta);
    writeJSONAtomic(file, meta);
    return meta;
  });
}

/**
 * Rebuild a revision's project in `dir` from stored objects (verified by hash). Rendering it
 * uses today's renderer and fonts; the receipt says when those differ from the original.
 */
export function materialize(
  root: string,
  id: string,
  dir: string,
): RevisionMeta {
  const { meta } = loadRevision(root, id);
  fs.mkdirSync(dir, { recursive: true });
  for (const [rel, object] of Object.entries(meta.inputs ?? {})) {
    const dest = path.resolve(dir, rel);
    if (!dest.startsWith(path.resolve(dir) + path.sep))
      throw new Error(
        `Revision ${id} names a file outside the project: ${rel}`,
      );
    restoreObject(root, object, dest);
  }
  return meta;
}

/** The working copy's timeline (prepared like a rough draft; no native work). */
export async function workingTimeline(
  root: string,
): Promise<{ ctx: PreparedContext; timeline: Timeline }> {
  const ctx: PreparedContext = await prepareProject(root, {
    draft: true,
    rough: true,
  });
  return { ctx, timeline: reviewTimeline(ctx) };
}
