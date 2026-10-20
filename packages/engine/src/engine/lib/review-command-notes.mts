import type { DisplayLocation } from './review-page-rows.mjs';
import { errorMessage } from './errors.mjs';
import fs from 'node:fs';

import { loadRevision, workingTimeline } from './revisions.mjs';
import { readNotes, importNotes, formatTime, locate } from './notes.mjs';

import { writeReviewPage } from './review-page.mjs';

import { checkId } from './store.mjs';
import type { ReviewContext } from './review-command-contracts.mjs';
import { json } from './review-command-common.mjs';
export async function notesCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o } = ctx;

  if (o.import) {
    const data: unknown = JSON.parse(fs.readFileSync(o.import, 'utf8'));
    const added = importNotes(dir, data, { by: o.by });
    writeReviewPage(dir);
    return console.log(
      `Imported ${added.length} note(s): ${added.map((n) => `${n.id} (${n.anchor?.beat ?? 'film'})`).join(', ')}`,
    );
  }

  const notes = readNotes(dir);

  // Where each note is now (the working copy), or in a named revision.
  let target = null;
  if (o.rev)
    target = {
      id: checkId('revision', o.rev),
      timeline: loadRevision(dir, o.rev).timeline,
    };
  else if (notes.length)
    target = { id: null, timeline: (await workingTimeline(dir)).timeline };

  const rows = notes
    .filter((n) => !o.status || n.status === o.status)
    .map((n) => {
      let where: DisplayLocation;
      try {
        where = target ? locate(dir, n, target) : { state: 'current' };
      } catch (e) {
        where = { state: 'unknown', reason: errorMessage(e) };
      }
      return { ...n, where };
    });

  if (o.json) return json(rows);

  if (!rows.length) return console.log('No notes.');

  return console.log(
    [
      `where each note is in ${target?.id ?? 'the working copy'}:`,
      ...rows.map(
        (n) =>
          `${n.id} ${n.status.padEnd(9)} ${n.where.state.padEnd(9)} ${n.revision}${n.anchor ? ` ${formatTime(n.anchor.at)} ${n.anchor.beat}` : ' film'}${n.where.beat && n.where.beat !== n.anchor?.beat ? ` → ${n.where.beat}` : ''}${n.where.at != null && n.anchor && Math.abs(n.where.at - n.anchor.at) > 0.01 ? ` @ ${formatTime(n.where.at)}` : ''}  ${n.text.split('\n')[0].slice(0, 80)}${n.where.reason ? `\n      ${n.where.reason}` : ''}`,
      ),
    ].join('\n'),
  );
}
