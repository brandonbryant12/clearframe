import {
  type Note,
  type NoteAnchor,
  addNote,
  parseStamp,
  parseTime,
  formatTime,
  readKeeps,
} from './notes.mjs';
import { loadRevision } from './revisions.mjs';

import { writeReviewPage } from './review-page.mjs';

import type { ReviewContext } from './review-command-contracts.mjs';
import { list, json } from './review-command-common.mjs';
export async function noteCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o, opts, positionals } = ctx;

  const raw = positionals.slice(1).join(' ');

  const stamp = parseStamp(raw);

  const at = stamp?.at ?? opts.at;

  const n = addNote(dir, {
    text: stamp?.text ?? raw,
    revision: stamp?.revision ?? o.rev,
    at,
    to: o.to != null ? parseTime(o.to) : stamp?.to,
    beat: o.beat ?? stamp?.beat,
    element: o.element,
    keep: list(o.keep) ?? [],
    scope: o.scope,
    by: o.by,
    agent: !!o.agent,
    via: stamp ? 'page' : 'cli',
  });

  writeReviewPage(dir);

  if (o.json) return json(n);

  const a = n.anchor;

  return console.log(
    [
      `${n.id} on ${n.revision}${revisionChoice(dir, n, !!(o.rev || stamp))}: ${n.scope}`,
      anchorDescription(a),
      ...(a?.near?.length
        ? [
            `  near the cut to ${a.near.map((x) => x.beat).join(', ')}: if the person meant that beat, add --beat ID`,
          ]
        : []),
      ...(n.keep?.length
        ? [
            `  keeps: ${readKeeps(dir)
              .filter((k) => k.note === n.id)
              .map((k) => `${k.id} (${k.what})`)
              .join(', ')}`,
          ]
        : []),
    ].join('\n'),
  );
}

function revisionChoice(dir: string, note: Note, explicit: boolean): string {
  if (explicit) return '';
  if (loadRevision(dir, note.revision).meta.videos?.length)
    return ' (the newest cut with a video; pass --rev if the person watched another)';
  return ' (the newest revision; it has no video, so pass --rev if the person watched something else)';
}
function anchorDescription(a: NoteAnchor | null): string {
  if (!a) return '  the whole film';
  const more =
    (a.beats?.length ?? 0) > 1 ? ` (+ ${(a.beats?.length ?? 1) - 1} more)` : '';
  const end = a.to != null ? `–${formatTime(a.to)}` : '';
  const words = a.words ? ` · “${a.words}”` : '';
  const source = a.source?.original
    ? ` · recording ${formatTime(a.source.original[0])}–${formatTime(a.source.original[1])}`
    : '';
  const element = a.element ? ` · element ${a.element}` : '';
  return `  ${a.beat}${more} at ${formatTime(a.at)}${end}${words}${source}${element}`;
}
