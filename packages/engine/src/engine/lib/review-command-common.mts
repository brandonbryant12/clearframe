import path from 'node:path';
import {
  listRevisions,
  workingTimeline,
  type ImpactReport,
} from './revisions.mjs';
import {
  readNotes,
  parseTime,
  formatTime,
  locate,
  keepConflicts,
} from './notes.mjs';

import { sentenceAt, sentenceAtTime } from './targets.mjs';

import { checkId } from './store.mjs';
import type { RawOptions, CommandOptions } from '../commands/options.mjs';

import type { CutReport } from './recording-cut.mjs';
import type { Selection } from './recording-select.mjs';
import type { ReviewAuthor } from './review-command-contracts.mjs';
export const json = (value: unknown): void =>
  console.log(JSON.stringify(value, null, 2));
export const rel = (f: string): string => path.relative(process.cwd(), f);
export const list = (v: unknown): string[] | undefined =>
  v == null
    ? undefined
    : String(v)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
export const ms = (n: number): string =>
  n >= 60000
    ? `${Math.floor(n / 60000)} min ${Math.round((n % 60000) / 1000)} s`
    : `${(n / 1000).toFixed(1)} s`;
/** Who is asking: a named person (--by) or the agent itself (--agent). */
export function who(
  o: RawOptions,
  { need }: { need?: string } = {},
): ReviewAuthor {
  if (o.agent && o.by)
    throw new Error(
      'Use --by NAME for a person, or --agent for your own decision; not both.',
    );
  if (o.agent) return { role: 'agent' };
  if (o.by) return { role: 'human', name: String(o.by).slice(0, 80) };
  if (need)
    throw new Error(
      `${need} needs --by NAME (the person) and --said "their words".`,
    );
  return { role: 'agent' };
}
export function rangeOf(o: RawOptions): { from: number; to: number } {
  const m = /^(.+?)(?:-|\.\.)(.+)$/.exec(String(o.range));
  if (!m) throw new Error('--range is from-to, e.g. 1:10-1:20');
  return { from: parseTime(m[1]), to: parseTime(m[2]) };
}
export function printImpact(r: ImpactReport): string {
  return [
    `${r.from} → ${r.to}`,
    ...r.summary.map((s) => `  ${s}`),
    ...r.beats
      .filter((x) => !['unchanged'].includes(x.status))
      .slice(0, 40)
      .map(
        (x) =>
          `  ${x.status.padEnd(10)} ${x.id.padEnd(12)} ${(x.reasons ?? []).join('; ')}`,
      ),
  ].join('\n');
}

/**
 * What a note or a time in a revision points at, as exact words of the recording now. The
 * note is located first (lineage, quoted words, recording time): a stale, orphaned or already
 * addressed note is refused, never turned into a search for the same text elsewhere. Without
 * --words the note's sentence is taken by its words' identity in the source transcript; with
 * --words, only the beats the note is about now are searched.
 */
async function noteSelection(
  dir: string,
  o: RawOptions,
  noteId: string,
): Promise<Selection> {
  const note = readNotes(dir).find((n) => n.id === checkId('note', noteId));
  if (!note) throw new Error(`No note ${o.note}.`);
  if (!note.anchor)
    throw new Error(
      `Note ${note.id} is about the whole film; name the words to cut with --words and --beat.`,
    );
  const target = { id: null, timeline: (await workingTimeline(dir)).timeline };
  const where = locate(dir, note, target);
  if (where.state === 'addressed')
    throw new Error(
      `Note ${note.id} is already addressed: ${where.reason}. Nothing was cut.`,
    );
  if (['stale', 'orphaned'].includes(where.state) || !where.beat)
    throw new Error(
      `Note ${note.id} is ${where.state}: ${where.reason ?? 'its moment cannot be found'}. Show the person the old moment and ask; nothing was cut.`,
    );
  if (o.words) {
    const within = new Set([where.beat]);
    for (const id of note.anchor.beats ?? []) {
      const w = locate(
        dir,
        {
          ...note,
          anchor: { ...note.anchor, beat: id, beats: [id], words: '' },
        },
        target,
      );
      if (w.beat && !['stale', 'orphaned'].includes(w.state))
        within.add(w.beat);
    }
    return {
      words: o.words,
      within: [...within],
      nth: o.nth == null ? undefined : Number(o.nth),
    };
  }
  const t = sentenceAt(dir, {
    revision: note.revision,
    anchor: { ...note.anchor, beat: note.anchor.beat ?? where.beat },
  });
  return {
    source: t.source,
    label: `The sentence note ${note.id} points at (“${t.text}”)`,
  };
}
export async function pointedSelection(
  dir: string,
  o: RawOptions,
  opts: CommandOptions,
): Promise<Selection> {
  if (o.note) return noteSelection(dir, o, o.note);
  const rev = o.rev
    ? checkId('revision', o.rev)
    : [...listRevisions(dir)].reverse().find((r) => (r.videos ?? []).length)
        ?.id;
  if (!rev)
    throw new Error('No revision to read the time against; pass --rev.');
  if (opts.at == null)
    throw new Error('A time is required for this selection.');
  const t = sentenceAtTime(dir, { revision: rev, at: opts.at });
  return {
    source: t.source,
    label: `The sentence at ${formatTime(opts.at)} in ${rev} (“${t.text}”)`,
  };
}

/** Refuse a planned cut that would break a keep (nothing has been cut yet). */
export function guardKeeps(
  dir: string,
  plans: CutReport[],
  by: ReviewAuthor,
  overrides: string[],
): void {
  const conflicts = keepConflicts(dir, plans, { by, overrides });
  if (!conflicts.length) return;
  const [{ keep: k, beats }] = conflicts;
  throw new Error(
    k.what === 'voice'
      ? `${k.id} keeps the voice of ${beats.join(', ')} (“${k.said ?? ''}”); a cut there needs the person's request: pass --by NAME with what they asked. Nothing was cut.`
      : `${k.id} keeps the words of ${beats.join(', ')} (“${k.said ?? ''}”) and this cut removes some of them. Ask the person; if they agree: override DIR --keep ${k.id} --by NAME --said "…", then cut … --override ${k.id}. Nothing was cut.`,
  );
}
