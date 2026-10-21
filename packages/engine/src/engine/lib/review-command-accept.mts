import type { RawOptions } from '../commands/options.mjs';
import type { Decision } from './notes-model.mjs';
import { addDecision, setNoteStatus } from './notes.mjs';
import { rejectRevision } from './edit-loop.mjs';

import { writeReviewPage } from './review-page.mjs';

import { checkId } from './store.mjs';
import type { ReviewContext } from './review-command-contracts.mjs';
import { list, who, json } from './review-command-common.mjs';
export async function acceptCommand(ctx: ReviewContext): Promise<void> {
  const { cmd, dir, o, positionals } = ctx;

  const rev = checkId('revision', positionals[1] ?? '');

  const by = who(o, { need: cmd });

  if (by.role !== 'human')
    throw new Error(
      `${cmd} records a person's decision; in one-shot work use decide.`,
    );

  if (cmd === 'reject') {
    const r = await rejectRevision(dir, {
      revision: rev,
      note: o.note,
      by: by.name,
      said: o.said,
    });
    if (o.json) return json(r);
    return console.log(
      [
        `rejected ${rev} (${r.decision}); the state before is saved as ${r.restorePoint}, the result as ${r.now}`,
        r.restored.length
          ? `restored from ${r.parent}: ${r.restored.join(', ')}`
          : 'nothing restored',
        ...r.conflicts.map((c) => `  left alone: ${c}`),
        o.note ? `${o.note} is open again.` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  const scope = acceptedScope(o);

  const d = addDecision(dir, {
    action: 'accept',
    role: 'human',
    by: by.name,
    said: o.said,
    revision: rev,
    scope,
  });

  if (o.note)
    setNoteStatus(dir, o.note, 'accepted', { revision: rev, by: by.name });

  writeReviewPage(dir);

  return console.log(
    `${d.id}: ${by.name} accepted ${rev}${acceptedDescription(o)}: “${o.said}”`,
  );
}

function acceptedScope(o: RawOptions): Decision['scope'] {
  if (o.note) return { note: checkId('note', o.note) };
  if (o.beats) return { beats: list(o.beats) };
  if (o.checkpoint) return { checkpoint: o.checkpoint };
  return {};
}
function acceptedDescription(o: RawOptions): string {
  if (o.note) return ` for ${o.note}`;
  if (o.beats) return ` (${o.beats})`;
  if (o.checkpoint) return ` as the ${o.checkpoint}`;
  return '';
}
