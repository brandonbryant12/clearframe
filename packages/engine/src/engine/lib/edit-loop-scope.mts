import {
  sequenceMoves,
  type ImpactReport,
  type Timeline,
} from './revisions.mjs';
import { locate, checkKeeps, readDecisions, type Note } from './notes.mjs';
import { editBeatIds, editParts, readEdits } from './recording-model.mjs';
import { checkId } from './store.mjs';

import type { DeclaredScope, ScopeViolation } from './edit-loop-contracts.mjs';
/** Beats a note is about in the working copy, found by content (never by timestamp alone). */
export function noteBeats(
  root: string,
  note: Note,
  timeline: Timeline,
): DeclaredScope {
  if (note.scope === 'film')
    return { film: true, beats: timeline.beats.map((b) => b.id) };
  const where = locate(root, note, { id: null, timeline });
  const mine = readEdits(root).filter((e) => e.note === note.id);
  if (where.state === 'addressed' && !where.beat)
    return {
      film: false,
      beats: [...new Set(mine.flatMap((e) => editParts(e).map((p) => p.beat)))],
      where,
    };
  if (['stale', 'orphaned'].includes(where.state))
    throw new Error(
      `Note ${note.id} is ${where.state}: ${where.reason}. Show the person the old moment and ask before editing.`,
    );
  const ids = new Set(where.beat ? [where.beat] : []);
  // A range or chapter note covers its other beats too, followed through lineage.
  for (const id of note.anchor?.beats ?? []) {
    const anchor = note.anchor
      ? { ...note.anchor, beat: id, beats: [id], words: '' }
      : null;
    const w = locate(root, { ...note, anchor }, { id: null, timeline });
    if (w.beat) ids.add(w.beat);
  }
  // A recording edit made for this note (cut --note) declares the beats it touched.
  for (const e of mine) for (const id of editBeatIds(e)) ids.add(id);
  return { film: false, beats: [...ids], where };
}

/** Out-of-scope edits: content changes (or additions, removals) beyond the declared beats. */
export function scopeViolations(
  report: ImpactReport,
  { beats, film }: { beats: string[]; film: boolean },
): ScopeViolation[] {
  const allowed = new Set(beats);
  const out: ScopeViolation[] = [];
  if (film) return out;
  // Moving the note's own beats is in scope; any other beat out of its order relative to the
  // rest is not.
  if (report.order?.reordered) {
    const others = (id: string): boolean => !allowed.has(id);
    const { moved } = sequenceMoves(
      (report.order.before ?? []).filter(others),
      (report.order.after ?? []).filter(others),
    );
    if (moved.length)
      out.push({
        what: 'order',
        message: `the order of beats changed: ${moved.join(', ')} moved, outside the note's beats`,
      });
  }
  if (report.film.look === 'changed')
    out.push({
      what: 'film look',
      message: 'the film look changed, but the note is not film-wide',
    });
  if (report.film.sound === 'changed')
    out.push({
      what: 'sound',
      message:
        'the music or mix settings changed, but the note is not film-wide',
    });
  if (report.film.voice === 'changed')
    out.push({
      what: 'voice',
      message: 'the voice settings changed, but the note is not film-wide',
    });
  out.push(...beatScopeViolations(report, allowed));
  return out;
}

export function declaredScope(
  root: string,
  note: Note,
  timeline: Timeline,
  scope: string | undefined,
  reason: string | undefined,
): DeclaredScope {
  const declared = noteBeats(root, note, timeline);
  if (scope === 'film') declared.film = true;
  else if (scope) {
    if (!reason)
      throw new Error(
        'Widening a note’s scope needs --reason (what made the extra beats part of this note).',
      );
    for (const id of scope.split(','))
      declared.beats.push(checkId('beat', id.trim()));
  }
  return declared;
}

// An override is the person's call, recorded before the edit is accepted as a candidate.
export function checkGuards(
  root: string,
  note: Note,
  timeline: Timeline,
  report: ImpactReport,
  declared: DeclaredScope,
  overrides: string[],
): void {
  const outside = scopeViolations(report, declared);
  if (outside.length)
    throw new Error(
      `Changes outside note ${note.id}'s scope (${declared.film ? 'film' : declared.beats.join(', ')}):\n  - ${outside.map((o) => o.message).join('\n  - ')}\nRevert them, or widen with --scope ID,ID --reason "why".`,
    );
  const granted = new Set(
    readDecisions(root)
      .filter((d) => d.action === 'override' && d.role === 'human')
      .map((d) => d.scope?.keep),
  );
  for (const k of overrides)
    if (!granted.has(k))
      throw new Error(
        `No recorded override for ${k}: record the person's decision with override DIR --keep ${k} --by NAME --said "…".`,
      );
  const broken = checkKeeps(root, timeline, { overrides });
  if (broken.length)
    throw new Error(
      `This edit breaks a keep:\n  - ${broken.map((b) => `${b.keep} (${b.what}): ${b.message}`).join('\n  - ')}\nAsk the person; if they agree, record it with override --keep ${broken[0].keep} --by NAME --said "…" and pass --override.`,
    );
}

function beatScopeViolations(
  report: ImpactReport,
  allowed: Set<string>,
): ScopeViolation[] {
  const out: ScopeViolation[] = [];
  for (const x of report.beats) {
    if (x.status === 'content' && !allowed.has(x.id))
      out.push({
        beat: x.id,
        message: `${x.id} changed (${(x.reasons ?? []).join('; ')})`,
      });
    if (
      x.status === 'added' &&
      !allowed.has(x.id) &&
      !x.from?.some((f) => allowed.has(f))
    )
      out.push({ beat: x.id, message: `${x.id} was added` });
    if (
      x.status === 'removed' &&
      !allowed.has(x.id) &&
      !x.into?.some((f) => allowed.has(f))
    )
      out.push({ beat: x.id, message: `${x.id} was removed` });
  }
  return out;
}
