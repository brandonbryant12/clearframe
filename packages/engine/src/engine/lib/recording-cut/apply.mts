import path from 'node:path';

import { writeJSONAtomic } from '../store.mjs';
import { logEdit } from '../recording-model.mjs';
import { rebuild } from '../recording-slices.mjs';

import {
  atomically,
  beatIn,
  recordedMeta,
  touchedFiles,
} from '../recording-context.mjs';
import type { EditAuthor, EditPart, Removal } from '../recording-model.mjs';

import type { EditContext } from '../recording-select.mjs';
import type { CutReport } from './contracts.mjs';

/** Write a planned edit: removals into metadata, rebuilt slices, deleted beats, the log. */
export function apply(
  root: string,
  ctx: EditContext,
  report: CutReport,
  opts: { by: EditAuthor; note?: string },
): void {
  atomically(
    root,
    touchedFiles(
      report.beats.map((p) => p.beat),
      ['source/words.json'],
    ),
    () => applyNow(root, ctx, report, opts),
  );
}

export function applyNow(
  root: string,
  ctx: EditContext,
  report: CutReport,
  { by, note }: { by: EditAuthor; note?: string },
): void {
  const sb = ctx.sb,
    entries: EditPart[] = [],
    at = new Date().toISOString();
  if (report.beats.filter((p) => p.deleted).length >= sb.beats.length)
    throw new Error('That would remove every beat.');
  const removals = new Map<string, Removal[]>();
  for (const p of report.beats) {
    const x = beatIn(ctx, p.beat);
    if (p.deleted) {
      const i = sb.beats.findIndex((b) => b.id === p.beat);
      entries.push({
        beat: p.beat,
        deleted: true,
        after: sb.beats[i - 1]?.id ?? null,
        storyboard: sb.beats[i],
        ...(x.meta ? { meta: x.meta } : {}),
      });
      sb.beats.splice(i, 1);
    } else if (p.removal)
      removals.set(p.beat, [...(removals.get(p.beat) ?? []), p.removal]);
  }
  for (const [id, list] of removals) {
    const meta = structuredClone(recordedMeta(beatIn(ctx, id)));
    meta.source.removed = [
      ...(meta.source.removed ?? []),
      ...list.map((r) => ({ ...r, by, at, ...(note ? { note } : {}) })),
    ];
    const { text } = rebuild(root, id, meta, ctx.src, ctx.transcript, ctx.fps);
    const beat = sb.beats.find((b) => b.id === id);
    if (beat) beat.vo = text;
    entries.push({ beat: id, removals: list.length });
  }
  writeJSONAtomic(path.join(root, 'storyboard.json'), sb);
  logEdit(root, {
    id: report.id,
    op: report.op,
    words: report.words,
    seconds: report.seconds,
    beats: entries,
    by,
    ...(note ? { note } : {}),
  });
}
