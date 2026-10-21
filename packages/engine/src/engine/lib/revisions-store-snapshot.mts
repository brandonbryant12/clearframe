import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prepareProject } from '../../film/prepare.mjs';
import { readEdits } from './recording-model.mjs';
import {
  canonical,
  fingerprint,
  nextId,
  putObject,
  sha256,
  withLock,
  writeAtomic,
  writeJSONAtomic,
} from './store.mjs';

import { reviewTimeline } from './revisions-timeline.mjs';

import type {
  PreparedContext,
  RevisionMeta,
  Timeline,
} from './revisions-model.mjs';

import {
  loadRevision,
  listRevisions,
  revDir,
} from './revisions-store-read.mjs';
import { lineageOf, editsSince } from './revisions-store-lineage.mjs';

import { collectInputs, contentIdOf } from './revisions-store-inputs.mjs';

export interface SnapshotOptions {
  ctx?: PreparedContext;
  kind?: string;
  label?: string;
  reason?: string;
  notes?: string[];
  by?: string;
  force?: boolean;
}

export interface Snapshot {
  revision: RevisionMeta;
  timeline: Timeline;
  created: boolean;
}

/** Store a JSON text by content (through a temporary file) and name its object. */
export function putText(root: string, text: string, prefix: string): string {
  const file = path.join(
    os.tmpdir(),
    `${prefix}-${process.pid}-${Date.now()}.json`,
  );
  fs.writeFileSync(file, text);
  try {
    return putObject(root, file, { sha: sha256(text), ext: '.json' }).object;
  } finally {
    fs.rmSync(file, { force: true });
  }
}

export interface NewRevision {
  id: string;
  latest: RevisionMeta | undefined;
  ctx: PreparedContext;
  timeline: Timeline;
  contentId: string;
  objects: Record<string, string>;
  job: string;
  options: SnapshotOptions;
}

export function revisionRecord(root: string, n: NewRevision): RevisionMeta {
  const { id, latest, ctx, timeline, options } = n;
  const { kind = 'snapshot', label, reason, notes = [], by } = options;
  const edits = readEdits(root);
  const prev = latest ? loadRevision(root, latest.id).timeline : null;
  return {
    id,
    parent: latest?.id ?? null,
    createdAt: new Date().toISOString(),
    kind,
    ...(label ? { label } : {}),
    ...(reason ? { reason } : {}),
    ...(by ? { by } : {}),
    contentId: n.contentId,
    inputId: ctx.manifest.inputId,
    renderer: {
      sourceHash: ctx.manifest.rendererSourceHash,
      fonts: fingerprint(ctx.manifest.fontHashes),
      plan: ctx.manifest.planSha256,
    },
    frames: timeline.frames,
    fps: timeline.fps,
    duration: timeline.duration,
    beats: timeline.beats.length,
    placeholders: ctx.placeholders ?? [],
    unfinished: ctx.unfinished ?? [],
    estimatedTiming: timeline.beats
      .filter((b) => b.vo && b.vo.timing !== 'measured')
      .map((b) => b.id),
    notes,
    lastEdit: edits.at(-1)?.id ?? null,
    lineage: lineageOf(prev, timeline, editsSince(edits, latest)),
    inputs: n.objects,
    job: n.job,
    videos: [],
    previews: [],
  };
}

/**
 * Save the project's current state as a revision (or return the latest one when nothing
 * changed). Inputs are preserved by content; the job and timeline are written beside it.
 */
export async function snapshot(
  root: string,
  options: SnapshotOptions = {},
): Promise<Snapshot> {
  const ctx: PreparedContext =
    options.ctx ?? (await prepareProject(root, { draft: true, rough: true }));
  const timeline = reviewTimeline(ctx);
  const inputs = collectInputs(root, ctx);
  const contentId = contentIdOf(inputs, ctx.manifest);
  return withLock(root, () => {
    const list = listRevisions(root),
      latest = list.at(-1);
    if (latest && latest.contentId === contentId && !options.force)
      return {
        revision: latest,
        timeline: loadRevision(root, latest.id).timeline,
        created: false,
      };
    const id = nextId(
      'r',
      list.map((r) => r.id),
    );
    const objects: Record<string, string> = {};
    for (const [rel, sha] of Object.entries(inputs))
      objects[rel] = putObject(root, path.join(root, rel), { sha }).object;
    const job = putText(root, canonical(ctx.job), 'cf-job');
    const meta = revisionRecord(root, {
      id,
      latest,
      ctx,
      timeline,
      contentId,
      objects,
      job,
      options,
    });
    const dir = revDir(root, id);
    writeJSONAtomic(path.join(dir, 'timeline.json'), timeline);
    writeAtomic(
      path.join(dir, 'storyboard.json'),
      fs.readFileSync(path.join(root, 'storyboard.json')),
    );
    writeJSONAtomic(path.join(dir, 'revision.json'), meta);
    return { revision: meta, timeline, created: true };
  });
}
