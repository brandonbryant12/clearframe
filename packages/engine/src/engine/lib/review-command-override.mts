import { latestRevision } from './revisions.mjs';
import { readKeeps, addDecision } from './notes.mjs';

import { checkId } from './store.mjs';
import type { ReviewContext } from './review-command-contracts.mjs';
import { who } from './review-command-common.mjs';
export async function overrideCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o } = ctx;

  const by = who(o, { need: 'override' });

  if (by.role !== 'human')
    throw new Error('Only the person can lift their own keep.');

  const k = readKeeps(dir).find((x) => x.id === checkId('keep', o.keep ?? ''));

  if (!k) throw new Error(`No keep ${o.keep}.`);

  const rev = o.rev ?? latestRevision(dir)?.id;

  if (!rev) throw new Error('No revision to override a keep against.');
  const d = addDecision(dir, {
    action: 'override',
    role: 'human',
    by: by.name,
    said: o.said,
    revision: rev,
    scope: { keep: k.id },
  });

  return console.log(
    `${d.id}: ${by.name} allowed an edit that breaks ${k.id} (${k.what}). Pass --override ${k.id} to revise.`,
  );
}
