import {
  impact,
  lineageOf,
  listRevisions,
  loadRevision,
  snapshot,
  updateRevision,
  workingTimeline,
  reviewTimeline,
  type ImpactReport,
  type PreparedContext,
} from './revisions.mjs';
import { readNotes, setNoteStatus, readKeeps } from './notes.mjs';
import { readEdits } from './recording-model.mjs';
import { checkId } from './store.mjs';
import { phase } from './runlog.mjs';
import { writeComparePage, writeReviewPage } from './review-page.mjs';

import type { Side } from './edit-loop-contracts.mjs';
import { declaredScope, checkGuards } from './edit-loop-scope.mjs';
import { passages } from './edit-loop-passages.mjs';
export * from './edit-loop-contracts.mjs';
export { scopeViolations } from './edit-loop-scope.mjs';
export { rejectRevision, restoreRevision } from './edit-loop-restore.mjs';
export type {
  RejectRequest,
  RejectResult,
  RestoreRequest,
  RestoreResult,
  Verification,
} from './edit-loop-restore.mjs';
export interface ReviseRequest {
  note: string;
  scope?: string;
  reason?: string;
  handles?: number;
  overrides?: string[];
  label?: string;
  render?: boolean;
}

const unchangedSince = (report: ImpactReport): boolean =>
  report.counts.content == null &&
  report.counts.added == null &&
  report.counts.removed == null &&
  !report.order.reordered &&
  !['look', 'sound', 'voice', 'data'].some((k) => report.film[k] === 'changed');

/**
 * Turn the working copy into a candidate revision for a note: check the edit stayed inside
 * the note's beats (or the scope given) and broke no keep, save the revision, render the
 * affected passages before and after, write the compare page and mark the note applied.
 */
export async function revise(
  root: string,
  {
    note: noteId,
    scope,
    reason,
    handles = 2,
    overrides = [],
    label,
    render = true,
  }: ReviseRequest,
) {
  checkId('note', noteId);
  const note = readNotes(root).find((n) => n.id === noteId);
  if (!note) throw new Error(`No note ${noteId}.`);
  const base = listRevisions(root).at(-1);
  if (!base)
    throw new Error(
      'No revision to compare against: render or snapshot the film first.',
    );
  const A = loadRevision(root, base.id);
  const { ctx, timeline } = await phase('prepare', () => workingTimeline(root));
  const declared = declaredScope(root, note, timeline, scope, reason);
  const lineage = lineageOf(A.timeline, timeline, readEdits(root));
  const report = impact(A.timeline, timeline, {
    lineage,
    from: base.id,
    to: 'candidate',
  });
  checkGuards(root, note, timeline, report, declared, overrides);
  if (unchangedSince(report))
    throw new Error(
      `Nothing changed since ${base.id}; edit the film for note ${note.id} first.`,
    );
  const { revision: rev, created } = await phase('revision', () =>
    snapshot(root, {
      ctx,
      kind: 'candidate',
      label,
      reason: `note ${note.id}: ${note.text.slice(0, 160)}`,
      notes: [note.id],
    }),
  );
  if (!created) throw new Error(`The working copy matches ${rev.id} already.`);
  const B: Side = { meta: rev, timeline };
  const shown = render
    ? await passages(root, { A, B, report, handles, ctxB: ctx, tag: rev.id })
    : [];
  updateRevision(root, rev.id, (m) => {
    m.previews = shown.map((p) => ({
      beats: p.beats,
      removed: p.removed,
      before: p.before
        ? {
            object: p.before.object ?? null,
            revision: base.id,
            frames: p.before.range?.frames,
          }
        : null,
      after: p.after
        ? {
            object: p.after.object ?? null,
            frames: p.after.range?.frames,
            verified: p.after.verified ?? null,
          }
        : null,
    }));
    m.impact = {
      from: base.id,
      summary: report.summary,
      counts: report.counts,
    };
  });
  setNoteStatus(root, note.id, 'applied', {
    revision: rev.id,
    reason: report.summary[0],
  });
  const page = writeComparePage(root, {
    A,
    B: loadRevision(root, rev.id),
    report,
    passages: shown,
    note,
  });
  writeReviewPage(root);
  return {
    revision: rev.id,
    base: base.id,
    note: note.id,
    report,
    passages: shown,
    unrendered: Math.max(0, report.passages.length - shown.length),
    page,
    declared,
  };
}

/** Before/after for two revisions (B may be 'working'). */
export async function compareRevisions(
  root: string,
  {
    from,
    to,
    handles = 2,
  }: { from: string; to?: string | null; handles?: number },
) {
  const A = loadRevision(root, checkId('revision', from));
  let B: Side, ctxB: PreparedContext | undefined;
  if (to === 'working' || to == null) {
    const w = await workingTimeline(root);
    B = { meta: null, timeline: w.timeline };
    ctxB = w.ctx;
  } else B = loadRevision(root, checkId('revision', to));
  // A revision's stored lineage is relative to its parent; otherwise derive it for this pair.
  const lineage =
    B.meta?.parent === A.meta.id
      ? B.meta.lineage
      : lineageOf(A.timeline, B.timeline, readEdits(root));
  const report = impact(A.timeline, B.timeline, {
    lineage,
    from,
    to: to ?? 'working',
  });
  const shown = await passages(root, {
    A,
    B,
    report,
    handles,
    ctxB,
    tag: `cmp-${from}-${to ?? 'working'}`,
  });
  const page = writeComparePage(root, { A, B, report, passages: shown });
  return { report, passages: shown, page };
}

export { reviewTimeline, readKeeps };
