import { addDecision } from './notes.mjs';

import { writeReviewPage } from './review-page.mjs';

import { checkId } from './store.mjs';
import type { ReviewContext } from './review-command-contracts.mjs';

export async function decideCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o, positionals } = ctx;

  const rev = checkId('revision', positionals[1] ?? '');

  if (!o.reason)
    throw new Error('decide needs --reason (what you decided and why).');

  if (o.by)
    throw new Error(
      'decide records the agent’s own call; a person’s verdict is accept --by NAME.',
    );

  const d = addDecision(dir, {
    action: 'decide',
    role: 'agent',
    reason: o.reason,
    revision: rev,
    scope: o.checkpoint ? { checkpoint: o.checkpoint } : {},
  });

  writeReviewPage(dir);

  return console.log(
    `${d.id}: agent decision on ${rev}${o.checkpoint ? ` (${o.checkpoint})` : ''}, recorded as an agent decision (not a person's acceptance).`,
  );
}
