import fs from 'node:fs';
import path from 'node:path';

import {
  impact,
  loadRevision,
  snapshot,
  workingTimeline,
  type BeatChange,
  type LoadedRevision,
  type Timeline,
} from './revisions.mjs';
import { setNoteStatus, addDecision } from './notes.mjs';
import {
  readEdits,
  readMeta,
  voMetaOrNull,
  type EditEntry,
  type VoMeta,
} from './recording-model.mjs';
import { checkId, nextId, restoreObject, reviewPath } from './store.mjs';

import { writeReviewPage } from './review-page.mjs';
import {
  beatFiles,
  insertInOrder,
  orderSince,
  overlappingSources,
  parentOrder,
  readWorkingStoryboard,
  restoreFiles,
  same,
  sharedRewrites,
  storedJSON,
  storyboardOf,
  writeStoryboard,
} from './edit-loop-beats.mjs';

import type { Beat, Storyboard } from '../domain.mjs';
type BackOp = { id: string; op: 'replace' | 'drop' | 'insert' };

/** Which beats can go back, before any file is touched; anything edited since is a conflict. */
function planBack(
  changes: BeatChange[],
  C: LoadedRevision,
  W: Timeline,
  sb: Storyboard,
  revision: string,
): { back: BackOp[]; conflicts: string[] } {
  const back: BackOp[] = [],
    conflicts: string[] = [];
  const inW = (id: string) => W.beats.find((b) => b.id === id);
  for (const x of changes) {
    const c = C.timeline.beats.find((b) => b.id === x.id);
    const w = inW(x.id);
    if (x.status === 'content') {
      if (!w || w.prints.authored !== c?.prints.authored)
        conflicts.push(`${x.id} was edited after ${revision}`);
      else back.push({ id: x.id, op: 'replace' });
    } else if (x.status === 'added') {
      if (w && w.prints.authored !== c?.prints.authored)
        conflicts.push(`${x.id} (added by ${revision}) was edited since`);
      else back.push({ id: x.id, op: 'drop' });
    } else if (x.status === 'removed' && !sb.beats.some((b) => b.id === x.id))
      back.push({ id: x.id, op: 'insert' });
  }
  return { back, conflicts };
}

const filmOf = (s: Storyboard): Omit<Storyboard, 'beats'> => {
  const { beats: _beats, ...rest } = s;
  return rest;
};

// Film settings, when the candidate changed them and nobody has since.
function restoreFilm(
  sb: Storyboard,
  sbP: Storyboard,
  sbC: Storyboard,
  revision: string,
  restored: string[],
  conflicts: string[],
): void {
  if (same(filmOf(sbP), filmOf(sbC))) return;
  if (!same(filmOf(sb), filmOf(sbC))) {
    conflicts.push(`film settings were edited after ${revision}`);
    return;
  }
  Object.assign(sb, filmOf(sbP));
  for (const k of Object.keys(filmOf(sbC)))
    if (!(k in filmOf(sbP))) Reflect.deleteProperty(sb, k);
  restored.push('film settings');
}

function beatOf(sb: Storyboard, id: string, revision: string): Beat {
  const beat = sb.beats.find((x) => x.id === id);
  if (!beat) throw new Error(`${revision} has no beat ${id}.`);
  return beat;
}

export interface RejectRequest {
  revision: string;
  note?: string;
  by?: string;
  said?: string;
}
export interface RejectResult {
  revision: string;
  parent: string;
  restorePoint: string;
  now: string;
  restored: string[];
  conflicts: string[];
  decision: string;
}

function applyBack(
  sb: Storyboard,
  sbP: Storyboard,
  back: BackOp[],
  edits: EditEntry[],
  revision: string,
): void {
  for (const b of back) {
    if (b.op === 'drop') {
      sb.beats = sb.beats.filter((x) => x.id !== b.id);
      continue;
    }
    const old = beatOf(sbP, b.id, revision);
    if (b.op === 'replace')
      sb.beats[sb.beats.findIndex((x) => x.id === b.id)] = old;
    else
      insertInOrder(
        sb,
        old,
        sbP.beats.map((x) => x.id),
        edits,
      );
  }
}

/**
 * Undo a candidate's changes where nobody has edited since: beats it changed go back to its
 * parent, beats it added go, beats it removed return. Anything edited after the candidate is a
 * conflict and is left alone (named in the report), as is a shared media file another beat
 * still uses, and a beat whose recording another beat now plays. The state before is saved.
 */
export async function rejectRevision(
  root: string,
  { revision, note, by, said }: RejectRequest,
): Promise<RejectResult> {
  checkId('revision', revision);
  const C = loadRevision(root, revision);
  if (!C.meta.parent)
    throw new Error(`${revision} has no parent to go back to.`);
  const P = loadRevision(root, C.meta.parent);
  const parentInputs = P.meta.inputs ?? {};
  const { revision: point } = await snapshot(root, {
    kind: 'restore-point',
    reason: `before rejecting ${revision}`,
    force: true,
  });
  const { timeline: W } = await workingTimeline(root);
  const sb = readWorkingStoryboard(root);
  const sbNow = structuredClone(sb);
  const edits = readEdits(root);
  const sbP = storyboardOf(root, P.meta.id),
    sbC = storyboardOf(root, C.meta.id);
  const changes = impact(P.timeline, C.timeline, {
    lineage: C.meta.lineage,
  }).beats;
  const restored: string[] = [];
  const { back, conflicts } = planBack(changes, C, W, sb, revision);
  const restoring = new Set(back.map((b) => b.id));
  const files = new Map<string, string>();
  for (const b of back.filter((x) => x.op !== 'drop'))
    for (const rel of beatFiles(
      beatOf(sbP, b.id, P.meta.id),
      sbP.assets ?? [],
      parentInputs,
    ))
      files.set(rel, parentInputs[rel]);
  const rewrites = sharedRewrites(root, [...files], restoring, sbNow);
  const sharedFiles = new Set(rewrites.map((s) => s.file));
  for (const s of rewrites)
    conflicts.push(
      `${s.file} is also used by ${s.beats.join(', ')}, edited since; left as it is`,
    );
  applyBack(sb, sbP, back, edits, revision);
  // A recorded beat that comes back must not replay recording another beat plays now.
  const metaFor = (id: string): VoMeta | null =>
    restoring.has(id) && back.find((b) => b.id === id)?.op !== 'drop'
      ? voMetaOrNull(storedJSON(root, parentInputs[`assets/vo/${id}.json`]))
      : readMeta(root, id);
  const twice = overlappingSources(root, sb, metaFor);
  if (twice.length)
    throw new Error(
      `Rejecting ${revision} would play the same recording twice (${twice.map((p) => p.join(' and ')).join('; ')}): it was split, merged or cut since. Restore the whole revision instead (restore DIR ${P.meta.id}); nothing was changed.`,
    );
  restoreFiles(
    root,
    [...files].filter(([rel]) => !sharedFiles.has(rel)),
  );
  restored.push(...back.map((b) => b.id));
  // Beat order: if the candidate rearranged beats and nobody has rearranged them since, the
  // parent's order comes back, with the beats this reject returned in their places and edits
  // made since (splits, merges, new beats) kept.
  const order = orderSince(sbP, sbC, sbNow, edits);
  if (order === 'candidate') {
    parentOrder(sb, sbP, edits);
    restored.push('beat order');
  } else if (order === 'since')
    conflicts.push(
      `the beat order was changed after ${revision}; left as it is`,
    );
  restoreFilm(sb, sbP, sbC, revision, restored, conflicts);
  // Recording edits restore the transcript files of the parent when the candidate changed them.
  for (const rel of ['source/words.json'])
    if (parentInputs[rel] && C.meta.inputs?.[rel] !== parentInputs[rel])
      restoreObject(root, parentInputs[rel], path.join(root, rel));
  writeStoryboard(root, sb);
  const decision = addDecision(root, {
    action: 'reject',
    role: 'human',
    by,
    said,
    revision,
    scope: note ? { note } : {},
  });
  if (note)
    setNoteStatus(root, note, 'open', {
      revision,
      by,
      reason: `${revision} rejected: ${said}`,
    });
  fs.appendFileSync(
    reviewPath(root, 'edits.jsonl'),
    JSON.stringify({
      id: nextId(
        'x',
        readEdits(root).map((e) => e.id),
      ),
      op: 'reject',
      of: revision,
      beats: restored,
      conflicts,
      at: new Date().toISOString(),
    }) + '\n',
  );
  const { revision: after } = await snapshot(root, {
    kind: 'restored',
    reason: `rejected ${revision}: restored ${restored.join(', ') || 'nothing'} from ${P.meta.id}`,
  });
  writeReviewPage(root);
  return {
    revision,
    parent: P.meta.id,
    restorePoint: point.id,
    now: after.id,
    restored,
    conflicts,
    decision: decision.id,
  };
}
