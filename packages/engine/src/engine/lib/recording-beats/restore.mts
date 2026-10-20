import path from 'node:path';

import { checkId, nextId, withLock, writeJSONAtomic } from '../store.mjs';
import {
  editParts,
  isRecorded,
  logEdit,
  readEdits,
  readMeta,
} from '../recording-model.mjs';
import { rebuild } from '../recording-slices.mjs';

import { context } from '../recording-context.mjs';
import type { EditEntry, EditPart } from '../recording-model.mjs';
import type { EditContext } from '../recording-select.mjs';

import { AGENT } from './contracts.mjs';
import type { ByOption } from './contracts.mjs';

export function uncutTargets(
  root: string,
  edits: EditEntry[],
  id: string | undefined,
  beat: string | undefined,
): EditEntry[] {
  const undone = new Set(
    edits.filter((e) => e.op === 'uncut').flatMap((e) => e.of ?? []),
  );
  if (id) {
    checkId('cut', id);
    const e = edits.find(
      (x) => x.id === id && ['cut', 'pauses'].includes(x.op),
    );
    if (!e) throw new Error(`No cut ${id} in review/edits.jsonl.`);
    if (undone.has(id)) throw new Error(`${id} was already undone.`);
    return [e];
  }
  if (beat) {
    const meta = readMeta(root, beat);
    if (!isRecorded(meta))
      throw new Error(`${beat} does not replay the recording.`);
    const ids = new Set((meta.source.removed ?? []).map((r) => r.id));
    const targets = edits.filter((e) => ids.has(e.id));
    if (!targets.length) throw new Error(`${beat} has nothing cut.`);
    return targets;
  }
  throw new Error('uncut needs --cut ID or --beat ID.');
}

/** Put a beat the cut removed whole back after the beat it followed; false when it is already there. */
export function restoreDeleted(
  root: string,
  ctx: EditContext,
  e: EditEntry,
  part: EditPart,
): boolean {
  const sb = ctx.sb;
  if (sb.beats.some((b) => b.id === part.beat)) return false;
  const after = part.after
    ? sb.beats.findIndex((b) => b.id === part.after)
    : -1;
  if (part.after && after < 0)
    throw new Error(
      `${e.id} removed ${part.beat} after ${part.after}, which no longer exists; use restore instead.`,
    );
  if (!part.storyboard || !isRecorded(part.meta))
    throw new Error(
      `${e.id} did not record ${part.beat}; use restore instead.`,
    );
  sb.beats.splice(after + 1, 0, part.storyboard);
  const meta = structuredClone(part.meta);
  rebuild(root, part.beat, meta, ctx.src, ctx.transcript, ctx.fps);
  sb.beats[after + 1].vo = meta.text;
  return true;
}

/** Take one cut's removals out of a beat's slice; false when the beat had none from it. */
export function restoreRemovals(
  root: string,
  ctx: EditContext,
  e: EditEntry,
  part: EditPart,
): boolean {
  const sb = ctx.sb;
  const meta = readMeta(root, part.beat);
  const beat = sb.beats.find((b) => b.id === part.beat);
  if (!meta || !beat)
    throw new Error(
      `${e.id} cut ${part.beat}, which has since been split, merged or removed; use restore instead.`,
    );
  if (!isRecorded(meta))
    throw new Error(`${part.beat} does not replay the recording.`);
  const before = meta.source.removed?.length ?? 0;
  meta.source.removed = (meta.source.removed ?? []).filter(
    (r) => r.id !== e.id,
  );
  if (meta.source.removed.length === before) return false;
  const { text } = rebuild(
    root,
    part.beat,
    meta,
    ctx.src,
    ctx.transcript,
    ctx.fps,
  );
  beat.vo = text;
  return true;
}

/** Undo a cut (or every removal in a beat): restore the words from the master. */
export function uncut(
  root: string,
  { id, beat }: { id?: string; beat?: string } = {},
  { by = AGENT }: ByOption = {},
): EditEntry {
  return withLock(root, () => {
    const ctx = context(root);
    const edits = readEdits(root);
    const targets = uncutTargets(root, edits, id, beat);
    const restored: string[] = [];
    for (const e of targets.reverse()) {
      for (const part of editParts(e).reverse()) {
        if (beat && part.beat !== beat) continue;
        const back = part.deleted
          ? restoreDeleted(root, ctx, e, part)
          : restoreRemovals(root, ctx, e, part);
        if (back) restored.push(part.beat);
      }
    }
    writeJSONAtomic(path.join(root, 'storyboard.json'), ctx.sb);
    const entry: EditEntry = {
      id: nextId(
        'u',
        edits.map((x) => x.id),
      ),
      op: 'uncut',
      of: targets.map((t) => t.id),
      beats: restored,
      by,
    };
    logEdit(root, entry);
    return entry;
  });
}
