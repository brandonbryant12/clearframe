import fs from 'node:fs';

import path from 'node:path';

import { objectFile, putObject, reviewPath, withLock } from './store.mjs';
import { isRecord } from './errors.mjs';

import type { RevisionMeta, RevisionVideo } from './revisions-model.mjs';
import type { RenderReceipt } from '../domain.mjs';
import { putText } from './revisions-store-snapshot.mjs';
import { updateRevision, listRevisions } from './revisions-store-read.mjs';

export type VideoReceipt = RenderReceipt & { encoder?: string };

/**
 * Attach a rendered video to its revision. Review videos are kept for the newest `keep`
 * revisions plus any a person accepted; older ones are released (the record stays, marked).
 */
export function attachVideo(
  root: string,
  id: string,
  {
    file,
    receipt,
    profile,
    keep = 3,
  }: { file: string; receipt: VideoReceipt; profile: string; keep?: number },
): RevisionMeta {
  const { object, sha256: sha } = putObject(root, file, {
    sha: receipt.outputSha256,
    ext: '.mp4',
  });
  const receiptObject = putText(
    root,
    JSON.stringify(receipt, null, 2) + '\n',
    'cf-receipt',
  );
  const meta = updateRevision(root, id, (m) => {
    m.videos = [
      ...(m.videos ?? []).filter((v) => v.sha256 !== sha),
      {
        profile,
        object,
        sha256: sha,
        receipt: receiptObject,
        frames: receipt.frames,
        encoder: receipt.encoder,
        renderedAt: new Date().toISOString(),
        retained: true,
      },
    ];
  });
  pruneVideos(root, keep);
  return meta;
}

/** Objects any revision still names: inputs, jobs, receipts, previews and kept videos. */
export function neededObjects(
  revs: RevisionMeta[],
  release: Set<string>,
): Set<string> {
  const needed = new Set<string>();
  for (const r of revs) addNeededObjects(r, release, needed);

  return needed;
}

export function releaseVideo(
  root: string,
  v: RevisionVideo,
  needed: Set<string>,
  freed: string[],
): void {
  if (!v.retained) return;
  if (!needed.has(v.object)) {
    fs.rmSync(path.join(root, ...v.object.split('/')), { force: true });
    freed.push(v.object);
  }
  v.retained = false;
  v.releasedAt = new Date().toISOString();
}

/**
 * Release the videos of all but the newest `keep` revisions that have one (a person's accepted
 * revisions are always kept). A released video's object is deleted unless something else still
 * names it: another kept video, any revision's inputs, job or receipts, or a preview.
 */
export function pruneVideos(root: string, keep = 3): string[] {
  return withLock(root, () => {
    const accepted = new Set(
      readDecisionsLight(root)
        .filter((d) => d.action === 'accept' && d.role === 'human')
        .map((d) => d.revision),
    );
    const revs = listRevisions(root);
    const withVideo = revs.filter((r) =>
      (r.videos ?? []).some((v) => v.retained),
    );
    const release = new Set(
      withVideo
        .slice(0, Math.max(0, withVideo.length - keep))
        .filter((r) => !accepted.has(r.id))
        .map((r) => r.id),
    );
    if (!release.size) return [];
    const needed = neededObjects(revs, release);
    const freed: string[] = [];
    for (const id of release)
      updateRevision(root, id, (m) => {
        for (const v of m.videos ?? []) releaseVideo(root, v, needed, freed);
      });
    return freed;
  });
}

export function readDecisionsLight(root: string): Record<string, unknown>[] {
  const file = reviewPath(root, 'decisions.jsonl');
  return fs.existsSync(file)
    ? fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l): unknown => JSON.parse(l))
        .filter(isRecord)
    : [];
}

/** Path of a revision's retained video, or null. */
export function revisionVideo(
  root: string,
  meta: RevisionMeta,
  profile?: string,
): (RevisionVideo & { file: string | null }) | null {
  const v = [...(meta.videos ?? [])]
    .reverse()
    .find((x) => x.retained !== false && (!profile || x.profile === profile));
  return v
    ? { ...v, file: objectFile(root, v.object, { verify: false }) }
    : null;
}

export function addNeededObjects(
  r: RevisionMeta,
  release: Set<string>,
  needed: Set<string>,
): void {
  for (const o of Object.values(r.inputs ?? {})) needed.add(o);
  if (r.job) needed.add(r.job);
  for (const v of r.videos ?? []) {
    if (v.receipt) needed.add(v.receipt);
    if (v.retained && !release.has(r.id)) needed.add(v.object);
  }
  for (const side of (r.previews ?? []).flatMap((p) => [p.before, p.after]))
    if (side?.object) needed.add(side.object);
}
